"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { FileText, PenLine, CalendarClock, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    label: "בקשות תוכן",
    href: "/requests",
    icon: FileText,
  },
  {
    label: "טיוטות",
    href: "/drafts",
    icon: PenLine,
  },
  {
    label: "תור פרסום",
    href: "/queue",
    icon: CalendarClock,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="fixed top-0 right-0 h-full flex flex-col border-l z-40"
      style={{
        width: "224px",
        backgroundColor: "#1A1D27",
        borderColor: "#2D3148",
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-4 py-5 border-b"
        style={{ borderColor: "#2D3148" }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: "#6B5CF6" }}
        >
          <span className="text-white font-bold text-sm">D</span>
        </div>
        <span className="font-semibold text-base" style={{ color: "#F1F5F9" }}>
          Domiron
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "text-white"
                  : "hover:bg-white/5"
              )}
              style={
                isActive
                  ? { backgroundColor: "#6B5CF6", color: "#ffffff" }
                  : { color: "#94A3B8" }
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-4 border-t pt-3" style={{ borderColor: "#2D3148" }}>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full transition-colors hover:bg-white/5"
          style={{ color: "#94A3B8" }}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span>התנתק</span>
        </button>
      </div>
    </aside>
  );
}
