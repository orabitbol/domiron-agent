"use client";

/**
 * Client-side carousel slide image generator for the publish flow.
 *
 * Reuses the same export-frame renderers and html-to-image capture
 * that the preview export button uses. Generates base64 PNG data URIs
 * for each carousel slide, ready to be uploaded to Cloudinary.
 */

import { createRoot } from "react-dom/client";
import { toPng } from "html-to-image";
import {
  EXPORT_SIZES,
  CarouselSlideExportFrame,
  buildCarouselSlides,
} from "@/components/drafts/preview/export-frames";
import { detectAngle } from "@/components/drafts/preview/preview-primitives";
import type { DraftFull, CarouselSlide } from "@/hooks/use-drafts";

/** Draft shape from the publish-jobs API (subset of DraftFull) */
interface PublishDraft {
  id: string;
  hook: string | null;
  format: string;
  mediaUrl: string | null;
  facebookCaption: string | null;
  instagramCaption: string | null;
  cta: string | null;
  carouselSlides: Array<{ text: string }> | null;
  storyFrames: Array<{ order: number; text: string; isLogoFrame?: boolean }> | null;
  visualDirection: string | null;
  hashtags: string[];
}

/**
 * Capture a single React element as a PNG data URI by rendering it
 * into a hidden offscreen DOM container.
 */
async function captureFrameAsPng(
  element: React.ReactElement,
  width: number,
  height: number,
  targetWidth: number,
): Promise<string> {
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

  const root = createRoot(container);
  await new Promise<void>((resolve) => {
    root.render(element);
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

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
  });

  root.unmount();
  document.body.removeChild(container);
  return dataUrl;
}

/**
 * Generate PNG data URIs for each carousel slide.
 * Returns an array of base64 data URIs ready for upload.
 */
export async function generateCarouselSlideImages(
  draft: PublishDraft
): Promise<string[]> {
  // Adapt the publish-jobs draft shape to DraftFull shape for the export frames
  const draftFull = {
    ...draft,
    requestId: "",
    goal: null,
    bestAngle: null,
    adminNotes: null,
    whyThisMatters: null,
    status: "PENDING_REVIEW" as const,
    version: 1,
    request: { id: "", title: "", platform: "", contentType: "", status: "", contentPillar: null, instructions: null },
    publishJob: null,
    createdAt: "",
    updatedAt: "",
  } as DraftFull;

  const angle = detectAngle(draft.visualDirection);
  const slides = buildCarouselSlides(draftFull);
  const sq = EXPORT_SIZES.square;

  console.log(`[carousel-export] Generating ${slides.length} slide images...`);

  const images: string[] = [];

  for (let i = 0; i < slides.length; i++) {
    console.log(`[carousel-export]   Rendering slide ${i + 1}/${slides.length}...`);

    const element = (
      <CarouselSlideExportFrame
        draft={draftFull}
        angle={angle}
        slideIndex={i}
        totalSlides={slides.length}
        slide={slides[i]}
      />
    );

    const dataUrl = await captureFrameAsPng(
      element,
      sq.width,
      sq.height,
      sq.targetWidth,
    );

    images.push(dataUrl);
    console.log(`[carousel-export]   Slide ${i + 1} captured (${(dataUrl.length / 1024).toFixed(0)} KB base64)`);
  }

  console.log(`[carousel-export] All ${images.length} slides generated.`);
  return images;
}
