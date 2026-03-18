"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { RequestFormData } from "@/lib/validations/request";
import type { RequestStatus, DraftStatus } from "@/types";

export type RequestWithDraft = {
  id: string;
  title: string;
  platform: string;
  contentType: string;
  sequenceDay: number | null;
  contentPillar: string | null;
  instructions: string | null;
  targetPublishDate: string | null;
  status: RequestStatus;
  draft: { id: string; status: DraftStatus } | null;
  createdAt: string;
  updatedAt: string;
};

const QUERY_KEY = ["requests"] as const;

export function useRequests() {
  return useQuery<RequestWithDraft[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/requests");
      if (!res.ok) throw new Error("שגיאה בטעינת הבקשות");
      const body = await res.json();
      return body.data;
    },
  });
}

export function useCreateRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: RequestFormData) => {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "שגיאה ביצירת הבקשה");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useDeleteRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/requests/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "שגיאה במחיקת הבקשה");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
