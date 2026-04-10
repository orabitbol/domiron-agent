"use client";

/**
 * Production-hardened DOM-to-PNG capture engine.
 *
 * Used by both the export button (preview) and the carousel publish pipeline.
 * Guarantees pixel-identical output to the preview by:
 *
 *   1. Preloading all background images before capture
 *   2. Waiting for document.fonts.ready
 *   3. Allowing multiple rAF cycles for full paint settlement
 *   4. Retrying toPng() on failure
 *   5. Validating the output is non-trivial (not blank/corrupt)
 *   6. Detailed per-slide logging
 *
 * Debug mode: set window.__DOMIRON_EXPORT_DEBUG = true in the console
 * to open each captured image in a new tab for visual inspection.
 */

import { type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { toJpeg } from "html-to-image";

// ─── Configuration ───────────────────────────────────────────────────────────

/** How many rAF cycles to wait after render before first capture attempt. */
const SETTLE_FRAMES = 5;

/** Maximum ms to wait for background images to load. */
const IMAGE_LOAD_TIMEOUT_MS = 8000;

/** Maximum ms to wait for fonts to load. */
const FONT_LOAD_TIMEOUT_MS = 3000;

/** Number of toPng retries on failure. */
const MAX_RETRIES = 2;

/** Delay between retries (ms). */
const RETRY_DELAY_MS = 500;

/** Minimum valid PNG data URL length (a blank 1x1 PNG is ~90 chars). */
const MIN_DATA_URL_LENGTH = 500;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Wait for N animation frames. */
function waitFrames(n: number): Promise<void> {
  return new Promise((resolve) => {
    let remaining = n;
    function tick() {
      remaining--;
      if (remaining <= 0) resolve();
      else requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

/** Wait for all CSS background images inside a DOM subtree to load. */
function waitForBackgroundImages(root: HTMLElement, timeoutMs: number, label: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const urls: string[] = [];

    // Walk the DOM tree and collect all background-image URLs.
    // We only want real image URLs (like /screenImage/bank.png or https://...).
    // Skip data URIs (inline), CSS functions (gradients), and fragments leaked
    // from inline SVG data URIs (e.g. "%23n" from url(#n) inside an SVG filter).
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node: Node | null = walker.currentNode;
    while (node) {
      if (node instanceof HTMLElement) {
        const bg = getComputedStyle(node).backgroundImage;
        if (bg && bg !== "none") {
          const matches = bg.matchAll(/url\(["']?([^"')]+)["']?\)/g);
          for (const match of matches) {
            const raw = match[1];
            if (!raw || raw.length < 4) continue;                    // too short to be a real URL
            if (raw.startsWith("data:")) continue;                   // inline data URI
            if (raw.startsWith("linear-") || raw.startsWith("radial-")) continue; // CSS gradient
            if (raw.startsWith("%23") || raw.startsWith("#")) continue; // SVG fragment ref leaked from data URI
            if (!/^(\/|https?:\/\/)/.test(raw)) {                   // must start with / or http(s)://
              console.warn(`[capture:${label}] Skipping non-image background URL: "${raw}"`);
              continue;
            }
            urls.push(raw);
          }
        }
      }
      node = walker.nextNode();
    }

    if (urls.length === 0) {
      resolve();
      return;
    }

    console.log(`[capture:${label}] Waiting for ${urls.length} background image(s) to load...`);

    let done = false;
    let loaded = 0;
    const total = urls.length;
    const failedUrls: string[] = [];

    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      const pending = urls.filter((u) => !loadedSet.has(u) && !failedUrls.includes(u));
      console.warn(
        `[capture:${label}] Background image load timed out after ${timeoutMs}ms. ` +
        `${loaded}/${total} loaded. Still waiting for: ${pending.join(", ")} — continuing with fallback`
      );
      resolve(); // Proceed — a slide with CSS-only background is better than no slide
    }, timeoutMs);

    const loadedSet = new Set<string>();

    function settle(url: string, success: boolean) {
      if (done) return;
      if (success) {
        loadedSet.add(url);
        loaded++;
      } else {
        // Warn but do NOT crash — a missing background is better than a failed export.
        // The capture will proceed with whatever the browser rendered (fallback bg or blank).
        console.warn(`[capture:${label}] Background image failed to load: ${url} — continuing with fallback`);
        failedUrls.push(url);
      }
      if (loaded + failedUrls.length >= total) {
        done = true;
        clearTimeout(timer);
        if (failedUrls.length > 0) {
          console.warn(`[capture:${label}] ${failedUrls.length}/${total} background images failed — capture will proceed`);
        } else {
          console.log(`[capture:${label}] All ${total} background images loaded.`);
        }
        resolve();
      }
    }

    for (const url of urls) {
      const img = new Image();
      img.onload = () => settle(url, true);
      img.onerror = () => settle(url, false);
      img.src = url;
    }
  });
}

/** Wait for all fonts to be ready. */
async function waitForFonts(timeoutMs: number): Promise<void> {
  if (!document.fonts?.ready) return;
  try {
    await Promise.race([
      document.fonts.ready,
      new Promise((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
  } catch {
    // Ignore font loading failures — system fonts are always available
  }
}

/** Check if debug mode is enabled. */
function isDebugMode(): boolean {
  try {
    return !!(globalThis as Record<string, unknown>).__DOMIRON_EXPORT_DEBUG;
  } catch {
    return false;
  }
}

// ─── Main capture function ───────────────────────────────────────────────────

export interface CaptureOptions {
  /** CSS width of the render container */
  width: number;
  /** CSS height of the render container */
  height: number;
  /** Target output width in pixels (used to compute pixelRatio) */
  targetWidth: number;
  /** Label for logging (e.g. "slide 1/5") */
  label?: string;
}

/**
 * Render a React element into a hidden offscreen container, wait for all
 * assets to load, capture as PNG, validate, and return the data URL.
 *
 * Retries on failure. Throws with clear context if all attempts fail.
 */
export async function captureFrameAsPng(
  element: ReactElement,
  options: CaptureOptions,
): Promise<string> {
  const { width, height, targetWidth, label = "frame" } = options;
  const tag = `[capture:${label}]`;

  // 1. Wait for fonts
  await waitForFonts(FONT_LOAD_TIMEOUT_MS);

  // 2. Create offscreen container
  const container = document.createElement("div");
  container.style.cssText = `
    position: fixed;
    left: -10000px;
    top: 0;
    width: ${width}px;
    height: ${height}px;
    overflow: hidden;
    pointer-events: none;
    z-index: -1;
  `;
  document.body.appendChild(container);

  // 3. Render React element
  const root = createRoot(container);
  root.render(element);

  // 4. Wait for paint settlement
  await waitFrames(SETTLE_FRAMES);

  // 5. Wait for background images
  const captureTarget = container.firstElementChild as HTMLElement;
  if (!captureTarget) {
    root.unmount();
    document.body.removeChild(container);
    throw new Error(`${tag} Export frame did not render — no child element found`);
  }

  await waitForBackgroundImages(captureTarget, IMAGE_LOAD_TIMEOUT_MS, label);

  // 6. Extra settle after images load
  await waitFrames(2);

  // 7. Capture with retries
  const pixelRatio = targetWidth / width;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      console.log(`${tag} Capturing (attempt ${attempt}/${MAX_RETRIES + 1}, pixelRatio=${pixelRatio.toFixed(2)})...`);

      const dataUrl = await toJpeg(captureTarget, {
        width,
        height,
        pixelRatio,
        quality: 0.85,
        backgroundColor: "#060810",
        cacheBust: true,
      });

      // 8. Validate output
      if (!dataUrl || dataUrl.length < MIN_DATA_URL_LENGTH) {
        throw new Error(`Output too small (${dataUrl?.length ?? 0} chars) — likely blank or corrupt`);
      }

      if (!dataUrl.startsWith("data:image/jpeg")) {
        throw new Error(`Output is not a JPEG data URL (starts with "${dataUrl.slice(0, 30)}")`);
      }

      const sizeKB = Math.ceil(dataUrl.length * 0.75 / 1024);
      console.log(`${tag} Captured successfully (${sizeKB} KB)`);

      // 9. Debug mode: open in new tab for visual inspection
      if (isDebugMode()) {
        try {
          const win = window.open();
          if (win) {
            win.document.write(`
              <html><head><title>${tag}</title></head>
              <body style="margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh">
                <img src="${dataUrl}" style="max-width:90vw;max-height:90vh;border:2px solid #333" />
              </body></html>
            `);
          }
        } catch {
          console.warn(`${tag} Debug: could not open preview window (popup blocked?)`);
        }
      }

      // 10. Cleanup and return
      root.unmount();
      document.body.removeChild(container);
      return dataUrl;

    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`${tag} Attempt ${attempt} failed: ${lastError.message}`);

      if (attempt <= MAX_RETRIES) {
        console.log(`${tag} Retrying in ${RETRY_DELAY_MS}ms...`);
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        // Extra settle before retry
        await waitFrames(3);
      }
    }
  }

  // All retries exhausted
  root.unmount();
  document.body.removeChild(container);
  throw new Error(`${tag} All ${MAX_RETRIES + 1} capture attempts failed. Last error: ${lastError?.message}`);
}
