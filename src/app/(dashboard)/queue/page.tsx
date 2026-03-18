"use client";

import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Topbar } from "@/components/layout/topbar";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { QueueTable } from "@/components/queue/queue-table";
import { usePublishJobs } from "@/hooks/use-publish-jobs";

export default function QueuePage() {
  const { data, isLoading, isError, refetch } = usePublishJobs();

  return (
    <div>
      <Topbar title="תור פרסום" showAction={false} />
      <div className="p-6">
        {isLoading && <TableSkeleton rows={5} />}

        {isError && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <p className="text-sm" style={{ color: "#94A3B8" }}>
              שגיאה בטעינת תור הפרסום
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
            icon={CalendarClock}
            title="אין תוכן בתור עדיין"
            description="אשרו טיוטות כדי להוסיף תוכן לתור"
          />
        )}

        {!isLoading && !isError && data && data.length > 0 && (
          <QueueTable jobs={data} />
        )}
      </div>
    </div>
  );
}
