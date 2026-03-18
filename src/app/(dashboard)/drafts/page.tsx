"use client";

import { PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Topbar } from "@/components/layout/topbar";
import { EmptyState } from "@/components/shared/empty-state";
import { GridSkeleton } from "@/components/shared/loading-skeleton";
import { DraftCard } from "@/components/drafts/draft-card";
import { useDrafts } from "@/hooks/use-drafts";

export default function DraftsPage() {
  const { data, isLoading, isError, refetch } = useDrafts();

  return (
    <div>
      <Topbar title="טיוטות" showAction={false} />
      <div className="p-6">
        {isLoading && <GridSkeleton items={4} />}

        {isError && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <p className="text-sm" style={{ color: "#94A3B8" }}>
              שגיאה בטעינת הטיוטות
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              style={{ borderColor: "#2D3148", color: "#94A3B8", backgroundColor: "transparent" }}
            >
              נסה שוב
            </Button>
          </div>
        )}

        {!isLoading && !isError && data?.length === 0 && (
          <EmptyState
            icon={PenLine}
            title="אין טיוטות עדיין"
            description="צרו בקשת תוכן ואז הוסיפו טיוטה כדי להתחיל"
          />
        )}

        {!isLoading && !isError && data && data.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            {data.map((draft) => (
              <DraftCard key={draft.id} draft={draft} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
