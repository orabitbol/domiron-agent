"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { DraftStatus } from "@/types";

// ─── Shared types ─────────────────────────────────────────────────────────────

export type StoryFrame = {
  order: number;
  text: string;
  isLogoFrame?: boolean;
};

export type DraftRequestSummary = {
  id: string;
  title: string;
  platform: string;
  contentType: string;
  sequenceDay: number | null;
};

export type DraftRequestFull = DraftRequestSummary & {
  contentPillar: string | null;
  instructions: string | null;
  status: string;
};

export type DraftPublishJob = {
  id: string;
  status: string;
  platform: string;
  scheduledDate: string | null;
  publishedAt: string | null;
};

export type DraftForList = {
  id: string;
  requestId: string;
  format: string;
  hook: string | null;
  status: DraftStatus;
  version: number;
  adminNotes: string | null;
  request: DraftRequestSummary;
  createdAt: string;
  updatedAt: string;
};

export type DraftFull = {
  id: string;
  requestId: string;
  format: string;
  hook: string | null;
  goal: string | null;
  bestAngle: string | null;
  facebookCaption: string | null;
  instagramCaption: string | null;
  storyFrames: StoryFrame[] | null;
  cta: string | null;
  hashtags: string[];
  visualDirection: string | null;
  whyThisMatters: string | null;
  adminNotes: string | null;
  status: DraftStatus;
  version: number;
  request: DraftRequestFull;
  publishJob: DraftPublishJob | null;
  createdAt: string;
  updatedAt: string;
};

// ─── Query keys ───────────────────────────────────────────────────────────────

const DRAFTS_KEY = ["drafts"] as const;
const draftKey = (id: string) => ["drafts", id] as const;
// Invalidated after any draft action that also changes a ContentRequest status
// (approve → COMPLETED, reject → CANCELLED, revision → REVISION_NEEDED).
const REQUESTS_KEY = ["requests"] as const;

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useDrafts() {
  return useQuery<DraftForList[]>({
    queryKey: DRAFTS_KEY,
    queryFn: async () => {
      const res = await fetch("/api/drafts");
      if (!res.ok) throw new Error("שגיאה בטעינת הטיוטות");
      const body = await res.json();
      return body.data;
    },
  });
}

export function useDraft(id: string) {
  return useQuery<DraftFull>({
    queryKey: draftKey(id),
    queryFn: async () => {
      const res = await fetch(`/api/drafts/${id}`);
      if (!res.ok) throw new Error("שגיאה בטעינת הטיוטה");
      const body = await res.json();
      return body.data;
    },
    enabled: !!id,
  });
}

export function useCreateDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: unknown) => {
      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "שגיאה ביצירת הטיוטה");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DRAFTS_KEY });
    },
  });
}

export function useApproveDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/drafts/${id}/approve`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "שגיאה באישור הטיוטה");
      }
      return res.json();
    },
    onSuccess: (_data, id) => {
      // Approval sets ContentRequest.status → COMPLETED; invalidate requests too.
      queryClient.invalidateQueries({ queryKey: DRAFTS_KEY });
      queryClient.invalidateQueries({ queryKey: draftKey(id) });
      queryClient.invalidateQueries({ queryKey: REQUESTS_KEY });
      queryClient.invalidateQueries({ queryKey: ["publish-jobs"] });
    },
  });
}

export function useRejectDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, note }: { id: string; note?: string }) => {
      const res = await fetch(`/api/drafts/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "שגיאה בדחיית הטיוטה");
      }
      return res.json();
    },
    onSuccess: (_data, { id }) => {
      // Rejection sets ContentRequest.status → CANCELLED; invalidate requests too.
      queryClient.invalidateQueries({ queryKey: DRAFTS_KEY });
      queryClient.invalidateQueries({ queryKey: draftKey(id) });
      queryClient.invalidateQueries({ queryKey: REQUESTS_KEY });
    },
  });
}

export function useRequestRevision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const res = await fetch(`/api/drafts/${id}/request-revision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "שגיאה בבקשת תיקון");
      }
      return res.json();
    },
    onSuccess: (_data, { id }) => {
      // Revision request sets ContentRequest.status → REVISION_NEEDED; invalidate requests too.
      queryClient.invalidateQueries({ queryKey: DRAFTS_KEY });
      queryClient.invalidateQueries({ queryKey: draftKey(id) });
      queryClient.invalidateQueries({ queryKey: REQUESTS_KEY });
    },
  });
}
