"use client";

/**
 * Client-side image generators for the publish flow.
 *
 * Generates images for both POST (single) and CAROUSEL (multi-slide)
 * using the production-hardened captureFrameAsPng() from lib/capture-frame.
 */

import {
  EXPORT_SIZES,
  PostExportFrame,
  CarouselSlideExportFrame,
  buildCarouselSlides,
} from "@/components/drafts/preview/export-frames";
import { detectAngle } from "@/components/drafts/preview/preview-primitives";
import { captureFrameAsPng } from "@/lib/capture-frame";
import type { DraftFull } from "@/hooks/use-drafts";

/** Draft shape from the publish-jobs API (subset of DraftFull) */
export interface PublishDraft {
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

/** Adapt PublishDraft to DraftFull for export frame components. */
function toDraftFull(draft: PublishDraft): DraftFull {
  return {
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
}

/**
 * Generate a single 1080x1080 image for a POST draft.
 * Returns one base64 data URI.
 */
export async function generatePostImage(draft: PublishDraft): Promise<string> {
  const draftFull = toDraftFull(draft);
  const angle = detectAngle(draft.visualDirection);
  const sq = EXPORT_SIZES.square;

  console.log(`[post-export] Generating post image...`);

  const element = <PostExportFrame draft={draftFull} angle={angle} />;

  const dataUrl = await captureFrameAsPng(element, {
    width: sq.width,
    height: sq.height,
    targetWidth: sq.targetWidth,
    label: "post",
  });

  console.log(`[post-export] Post image generated.`);
  return dataUrl;
}

/**
 * Generate images for each carousel slide.
 * Returns an array of base64 data URIs.
 */
export async function generateCarouselSlideImages(draft: PublishDraft): Promise<string[]> {
  const draftFull = toDraftFull(draft);
  const angle = detectAngle(draft.visualDirection);
  const slides = buildCarouselSlides(draftFull);
  const sq = EXPORT_SIZES.square;

  console.log(`[carousel-export] Generating ${slides.length} slide images...`);

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

  console.log(`[carousel-export] All ${images.length} slides generated.`);
  return images;
}
