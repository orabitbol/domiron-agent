"use client";

/**
 * Export engine hook.
 *
 * Renders each export frame into a hidden offscreen container,
 * captures it with html-to-image at the target resolution,
 * bundles all PNGs into a zip with jszip, and triggers download.
 *
 * For single-image exports (POST), downloads the PNG directly.
 */

import { useState, useCallback, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { toPng } from "html-to-image";
import JSZip from "jszip";
import type { DraftFull } from "@/hooks/use-drafts";
import { ContentFormat } from "@/types";
import { type ContentAngle } from "./preview-primitives";
import {
  EXPORT_SIZES,
  PostExportFrame,
  CarouselSlideExportFrame,
  StoryFrameExportFrame,
  ReelSceneExportFrame,
  buildCarouselSlides,
  buildStoryFrames,
  buildReelScenes,
} from "./export-frames";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ExportJob {
  filename: string;
  element: ReactElement;
  width: number;
  height: number;
  targetWidth: number;
  targetHeight: number;
}

interface ExportState {
  isExporting: boolean;
  progress: number; // 0–1
  currentFile: string;
}

// ─── Capture helper ──────────────────────────────────────────────────────────

/**
 * Renders a React element into a hidden offscreen container,
 * captures it as a PNG data URL, then cleans up.
 */
async function captureFrameAsPng(
  element: ReactElement,
  width: number,
  height: number,
  targetWidth: number,
  targetHeight: number,
): Promise<string> {
  // Create offscreen container
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

  // Render the React element
  const root = createRoot(container);

  await new Promise<void>((resolve) => {
    root.render(element);
    // Wait for two animation frames to ensure paint
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  // Capture with html-to-image
  const captureTarget = container.firstElementChild as HTMLElement;
  if (!captureTarget) {
    root.unmount();
    document.body.removeChild(container);
    throw new Error("Export frame did not render");
  }

  const pixelRatio = targetWidth / width;
  const dataUrl = await toPng(captureTarget, {
    width,
    height,
    pixelRatio,
    cacheBust: true,
    // Skip elements that use backdrop-filter (causes CORS issues in some browsers)
    filter: (node: HTMLElement) => {
      // Keep all nodes — backdrop-filter renders acceptably in most browsers
      return true;
    },
  });

  // Cleanup
  root.unmount();
  document.body.removeChild(container);

  return dataUrl;
}

/** Convert a data URL to a Uint8Array for zip inclusion. */
function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Trigger a browser download from a Blob. */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Job builders ────────────────────────────────────────────────────────────

function buildExportJobs(draft: DraftFull, angle: ContentAngle): ExportJob[] {
  const format = draft.format as ContentFormat;
  const sq = EXPORT_SIZES.square;
  const vt = EXPORT_SIZES.vertical;

  switch (format) {
    case ContentFormat.STATIC: {
      return [{
        filename: "post.png",
        element: <PostExportFrame draft={draft} angle={angle} />,
        ...sq,
      }];
    }

    case ContentFormat.CAROUSEL: {
      const slides = buildCarouselSlides(draft);
      return slides.map((slide, i) => ({
        filename: `carousel_${i + 1}.png`,
        element: (
          <CarouselSlideExportFrame
            draft={draft}
            angle={angle}
            slideIndex={i}
            totalSlides={slides.length}
            slide={slide}
          />
        ),
        ...sq,
      }));
    }

    case ContentFormat.STORY: {
      const frames = buildStoryFrames(draft);
      return frames.map((frame, i) => ({
        filename: `story_${i + 1}.png`,
        element: (
          <StoryFrameExportFrame
            draft={draft}
            angle={angle}
            frame={frame}
            isFirst={i === 0}
          />
        ),
        ...vt,
      }));
    }

    case ContentFormat.REEL: {
      const scenes = buildReelScenes(draft);
      return scenes.map((scene, i) => ({
        filename: `reel_${i + 1}.png`,
        element: (
          <ReelSceneExportFrame
            draft={draft}
            angle={angle}
            scene={scene}
            isFirst={i === 0}
          />
        ),
        ...vt,
      }));
    }

    default: {
      return [{
        filename: "post.png",
        element: <PostExportFrame draft={draft} angle={angle} />,
        ...sq,
      }];
    }
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useExportAssets(draft: DraftFull, angle: ContentAngle) {
  const [state, setState] = useState<ExportState>({
    isExporting: false,
    progress: 0,
    currentFile: "",
  });

  const exportAssets = useCallback(async () => {
    setState({ isExporting: true, progress: 0, currentFile: "" });

    try {
      const jobs = buildExportJobs(draft, angle);

      // Single file → direct PNG download (no zip needed)
      if (jobs.length === 1) {
        const job = jobs[0];
        setState({ isExporting: true, progress: 0.5, currentFile: job.filename });

        const dataUrl = await captureFrameAsPng(
          job.element, job.width, job.height, job.targetWidth, job.targetHeight,
        );

        // Convert to blob and download
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        downloadBlob(blob, job.filename);

        setState({ isExporting: false, progress: 1, currentFile: "" });
        return;
      }

      // Multiple files → bundle into zip
      const zip = new JSZip();

      for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        setState({
          isExporting: true,
          progress: i / jobs.length,
          currentFile: job.filename,
        });

        const dataUrl = await captureFrameAsPng(
          job.element, job.width, job.height, job.targetWidth, job.targetHeight,
        );
        zip.file(job.filename, dataUrlToUint8Array(dataUrl));
      }

      setState({ isExporting: true, progress: 0.95, currentFile: "יוצר ZIP..." });

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const format = draft.format?.toLowerCase() ?? "export";
      const zipName = `domiron_${format}_assets.zip`;
      downloadBlob(zipBlob, zipName);

      setState({ isExporting: false, progress: 1, currentFile: "" });
    } catch (err) {
      console.error("[export] Failed:", err);
      setState({ isExporting: false, progress: 0, currentFile: "" });
      throw err;
    }
  }, [draft, angle]);

  return {
    exportAssets,
    isExporting: state.isExporting,
    progress: state.progress,
    currentFile: state.currentFile,
  };
}
