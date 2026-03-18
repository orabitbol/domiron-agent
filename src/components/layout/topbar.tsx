import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TopbarProps {
  title: string;
  showAction?: boolean;
}

export function Topbar({ title, showAction = true }: TopbarProps) {
  return (
    <header
      className="flex items-center justify-between px-6 py-4 border-b"
      style={{
        backgroundColor: "#1A1D27",
        borderColor: "#2D3148",
      }}
    >
      <h1 className="text-lg font-semibold" style={{ color: "#F1F5F9" }}>
        {title}
      </h1>
      {showAction && (
        <Link href="/requests/new">
          <Button
            size="sm"
            className="gap-2 font-medium"
            style={{ backgroundColor: "#6B5CF6", color: "#ffffff" }}
          >
            <Plus className="w-4 h-4" />
            בקשה חדשה
          </Button>
        </Link>
      )}
    </header>
  );
}
