"use client";

/**
 * Client-side carousel slide image generator for the publish flow.
 *
 * Uses the production-hardened captureFrameAsPng() from lib/capture-frame,
 * which guarantees:
 *   - All background images are loaded before capture
 *   - Fonts are ready
 *   - Multiple rAF cycles for paint settlement
 *   - Retry on failure
 *   - Output validation (not blank/corrupt)
 *   - Debug mode for visual inspection
 */

import {
  EXPORT_SIZES,
  CarouselSlideExportFrame,
  buildCarouselSlides,
} from "@/components/drafts/preview/export-frames";
import { detectAngle } from "@/components/drafts/preview/preview-primitives";
import { captureFrameAsPng } from "@/lib/capture-frame";
import type { DraftFull } from "@/hooks/use-drafts";

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

  console.log(`[carousel-export] Generating ${slides.length} slide images (hardened pipeline)...`);

  const images: string[] = [];

  for (let i = 0; i < slides.length; i++) {
    const element = (
      <CarouselSlideExportFrame
        draft={draftFull}
        angle={angle}
        slideIndex={i}
        totalSlides={slides.length}
        slide={slides[i]}
      />
    );

    const dataUrl = await captureFrameAsPng(element, {
      width: sq.width,
      height: sq.height,
      targetWidth: sq.targetWidth,
      label: `carousel-slide ${i + 1}/${slides.length}`,
    });

    images.push(dataUrl);
  }

  console.log(`[carousel-export] All ${images.length} slides generated successfully.`);
  return images;
}
