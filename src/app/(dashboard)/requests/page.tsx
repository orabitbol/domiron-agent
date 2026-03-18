"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Topbar } from "@/components/layout/topbar";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { RequestsTable } from "@/components/requests/requests-table";
import { useRequests } from "@/hooks/use-requests";

export default function RequestsPage() {
  const { data, isLoading, isError, refetch } = useRequests();

  return (
    <div>
      <Topbar title="בקשות תוכן" />
      <div className="p-6">
        {isLoading && <TableSkeleton rows={5} />}

        {isError && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <p className="text-sm" style={{ color: "#94A3B8" }}>
              שגיאה בטעינת הבקשות
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
            icon={FileText}
            title="אין בקשות תוכן עדיין"
            description="צרו בקשת תוכן ראשונה כדי להתחיל"
            action={
              <Link href="/requests/new">
                <Button
                  size="sm"
                  style={{ backgroundColor: "#6B5CF6", color: "#ffffff" }}
                >
                  בקשה חדשה
                </Button>
              </Link>
            }
          />
        )}

        {!isLoading && !isError && data && data.length > 0 && (
          <RequestsTable requests={data} />
        )}
      </div>
    </div>
  );
}
