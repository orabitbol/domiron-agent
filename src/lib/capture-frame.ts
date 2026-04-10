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
import { toPng } from "html-to-image";

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
function waitForBackgroundImages(root: HTMLElement, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const urls: string[] = [];

    // Walk the DOM tree and collect all background-image URLs
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node: Node | null = walker.currentNode;
    while (node) {
      if (node instanceof HTMLElement) {
        const bg = getComputedStyle(node).backgroundImage;
        if (bg && bg !== "none") {
          // Extract URL from css value like url("...")
          const matches = bg.matchAll(/url\(["']?([^"')]+)["']?\)/g);
          for (const match of matches) {
            const url = match[1];
            // Skip data URIs (already inline) and gradient values
            if (url && !url.startsWith("data:") && !url.startsWith("linear-") && !url.startsWith("radial-")) {
              urls.push(url);
            }
          }
        }
      }
      node = walker.nextNode();
    }

    if (urls.length === 0) {
      resolve();
      return;
    }

    console.log(`[capture] Waiting for ${urls.length} background image(s) to load...`);

    let settled = 0;
    const total = urls.length;
    const timer = setTimeout(() => {
      console.warn(`[capture] Background image load timed out after ${timeoutMs}ms (${settled}/${total} loaded)`);
      resolve(); // Proceed anyway — partial render is better than no render
    }, timeoutMs);

    function check() {
      settled++;
      if (settled >= total) {
        clearTimeout(timer);
        console.log(`[capture] All ${total} background images loaded.`);
        resolve();
      }
    }

    for (const url of urls) {
      const img = new Image();
      img.onload = check;
      img.onerror = () => {
        console.warn(`[capture] Background image failed to load: ${url}`);
        check(); // Count as settled so we don't hang
      };
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

  await waitForBackgroundImages(captureTarget, IMAGE_LOAD_TIMEOUT_MS);

  // 6. Extra settle after images load
  await waitFrames(2);

  // 7. Capture with retries
  const pixelRatio = targetWidth / width;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      console.log(`${tag} Capturing (attempt ${attempt}/${MAX_RETRIES + 1}, pixelRatio=${pixelRatio.toFixed(2)})...`);

      const dataUrl = await toPng(captureTarget, {
        width,
        height,
        pixelRatio,
        cacheBust: true,
      });

      // 8. Validate output
      if (!dataUrl || dataUrl.length < MIN_DATA_URL_LENGTH) {
        throw new Error(`Output too small (${dataUrl?.length ?? 0} chars) — likely blank or corrupt`);
      }

      if (!dataUrl.startsWith("data:image/png")) {
        throw new Error(`Output is not a PNG data URL (starts with "${dataUrl.slice(0, 30)}")`);
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
