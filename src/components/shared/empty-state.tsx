import { type LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ backgroundColor: "#1A1D27", border: "1px solid #2D3148" }}
      >
        <Icon className="w-8 h-8" style={{ color: "#6B5CF6" }} />
      </div>
      <h3 className="text-base font-semibold mb-1" style={{ color: "#F1F5F9" }}>
        {title}
      </h3>
      {description && (
        <p className="text-sm mb-4" style={{ color: "#94A3B8" }}>
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
