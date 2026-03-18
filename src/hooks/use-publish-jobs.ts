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
  createdAt: string;
  updatedAt: string;
  draft: {
    id: string;
    hook: string | null;
    format: string;
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

export function useMarkPublished() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/publish-jobs/${id}/mark-published`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "שגיאה בסימון הפוסט");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
