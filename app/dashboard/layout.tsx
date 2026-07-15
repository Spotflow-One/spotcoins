import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const isAdminUser = session.user.role === "ADMIN";

  // Dashboard always uses the employee shell, even for ADMIN session users
  // who entered via /login. Their role is still ADMIN for API authorization.
  return (
    <AppShell isAdmin={false} role={session.user.role} showAdminLink={isAdminUser}>
      {children}
    </AppShell>
  );
}
