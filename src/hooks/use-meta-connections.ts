"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type MetaConnectionSafe = {
  id: string;
  platform: "INSTAGRAM" | "FACEBOOK";
  pageId: string;
  pageName: string;
  tokenExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const QUERY_KEY = ["meta-connections"] as const;

export function useMetaConnections() {
  return useQuery<MetaConnectionSafe[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/meta/connections");
      if (!res.ok) throw new Error("שגיאה בטעינת החיבורים");
      const body = await res.json();
      return body.data;
    },
  });
}

export function useDisconnectMeta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/meta/connections/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("שגיאה בניתוק החיבור");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
