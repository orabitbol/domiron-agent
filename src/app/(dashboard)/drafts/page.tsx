import { Topbar } from "@/components/layout/topbar";
import { EmptyState } from "@/components/shared/empty-state";
import { PenLine } from "lucide-react";

export default function DraftsPage() {
  return (
    <div>
      <Topbar title="טיוטות" />
      <div className="p-6">
        <EmptyState
          icon={PenLine}
          title="אין טיוטות עדיין"
          description="טיוטות יופיעו כאן לאחר יצירת בקשות תוכן"
        />
      </div>
    </div>
  );
}
