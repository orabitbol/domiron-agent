import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0F1117" }}>
      <Sidebar />
      <main
        className="min-h-screen"
        style={{ marginRight: "224px" }}
      >
        {children}
      </main>
    </div>
  );
}
