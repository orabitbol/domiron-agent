"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PublishJobStatus } from "@/types";

export type PublishJobWithDraft = {
  id: string;
  status: PublishJobStatus;
  platform: string;
  publishMethod: string;
  scheduledDate: string | null;
  publishedAt: string | null;
  cancelledAt: string | null;
  externalPostId: string | null;
  publishedUrl: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  draft: {
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
    request: {
      title: string;
      platform: string;
      contentType: string;
    };
  };
};

const QUERY_KEY = ["publish-jobs"] as const;

export function usePublishJobs() {
  return useQuery<PublishJobWithDraft[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/publish-jobs");
      if (!res.ok) throw new Error("שגיאה בטעינת תור הפרסום");
      const body = await res.json();
      return body.data;
    },
  });
}

export type PublishAttemptResult = {
  platform: string;
  success: boolean;
  externalPostId: string | null;
  publishedUrl: string | null;
  failureReason: string | null;
};

export type MarkPublishedResponse = {
  data: PublishJobWithDraft;
  publishStatus: "PUBLISHED" | "FAILED";
  results: PublishAttemptResult[];
};

export function useMarkPublished() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      args: string | { id: string; slideImageUrls?: string[] }
    ): Promise<MarkPublishedResponse> => {
      const id = typeof args === "string" ? args : args.id;
      const slideImageUrls = typeof args === "string" ? undefined : args.slideImageUrls;
      const res = await fetch(`/api/publish-jobs/${id}/mark-published`, {
        method: "POST",
        ...(slideImageUrls
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ slideImageUrls }),
            }
          : {}),
      });
      // 4xx / 5xx = unexpected error (bad state, server crash, missing env vars).
      // A Meta API failure returns 200 with publishStatus: "FAILED".
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "שגיאה בפרסום הפוסט");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useRetryPublishJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const res = await fetch(`/api/publish-jobs/${id}/retry`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "שגיאה באיפוס עבודת הפרסום");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
