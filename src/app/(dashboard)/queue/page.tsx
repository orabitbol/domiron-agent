import { Topbar } from "@/components/layout/topbar";
import { EmptyState } from "@/components/shared/empty-state";
import { CalendarClock } from "lucide-react";

export default function QueuePage() {
  return (
    <div>
      <Topbar title="תור פרסום" />
      <div className="p-6">
        <EmptyState
          icon={CalendarClock}
          title="תור הפרסום ריק"
          description="פוסטים מאושרים יוצגו כאן לפי תאריך פרסום"
        />
      </div>
    </div>
  );
}
