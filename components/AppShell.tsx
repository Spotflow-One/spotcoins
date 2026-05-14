import Image from "next/image";
import { BottomNav } from "@/components/BottomNav";
import { DashboardRoleProvider, type DashboardRole } from "@/components/DashboardRoleProvider";
import { Sidebar } from "@/components/Sidebar";

type AppShellProps = {
  children: React.ReactNode;
  isAdmin: boolean;
  role?: DashboardRole;
};

export function AppShell({ children, isAdmin, role = "EMPLOYEE" }: AppShellProps) {
  return (
    <main className="app-top-glow relative min-h-screen overflow-hidden bg-background">
      <div className="md:flex">
        <Sidebar isAdmin={isAdmin} />

        <div className="relative z-[1] min-w-0 flex-1 pb-28 md:pb-10 md:pl-64">
          <header className="flex items-center justify-between border-b border-border bg-background/70 px-5 py-3.5 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-border bg-card">
                <Image src="/logomark.png" alt="Spotcoin" width={16} height={16} />
              </div>
              <span className="text-sm font-semibold tracking-tight text-foreground">Spotcoin</span>
            </div>
            {isAdmin ? (
              <span className="rounded-full border border-border bg-card-2 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
                Admin
              </span>
            ) : null}
          </header>

          <div className="mx-auto w-full max-w-[480px] px-5 md:max-w-3xl md:px-8 md:pt-8">
            <DashboardRoleProvider role={role}>{children}</DashboardRoleProvider>
          </div>
        </div>
      </div>

      <BottomNav isAdmin={isAdmin} />
    </main>
  );
}
