import { Topbar } from "@/components/layout/topbar";
import { RequestForm } from "@/components/requests/request-form";

export default function NewRequestPage() {
  return (
    <div>
      <Topbar title="בקשה חדשה" showAction={false} />
      <div className="p-6">
        <RequestForm />
      </div>
    </div>
  );
}
