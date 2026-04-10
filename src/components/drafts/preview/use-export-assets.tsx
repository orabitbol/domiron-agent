"use client";

/**
 * Export engine hook.
 *
 * Renders each export frame using the production-hardened captureFrameAsPng(),
 * bundles all PNGs into a zip with jszip, and triggers download.
 *
 * For single-image exports (POST), downloads the PNG directly.
 */

import { useState, useCallback, type ReactElement } from "react";
import JSZip from "jszip";
import type { DraftFull } from "@/hooks/use-drafts";
import { ContentFormat } from "@/types";
import { type ContentAngle } from "./preview-primitives";
import { captureFrameAsPng } from "@/lib/capture-frame";
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

        const dataUrl = await captureFrameAsPng(job.element, {
          width: job.width,
          height: job.height,
          targetWidth: job.targetWidth,
          label: job.filename,
        });

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

        const dataUrl = await captureFrameAsPng(job.element, {
          width: job.width,
          height: job.height,
          targetWidth: job.targetWidth,
          label: job.filename,
        });
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
