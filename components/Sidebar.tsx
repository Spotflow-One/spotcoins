"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getNavItems } from "@/lib/nav-items";
import { cn } from "@/lib/utils";

type SidebarProps = {
  isAdmin: boolean;
  showAdminLink?: boolean;
};

export function Sidebar({ isAdmin, showAdminLink = false }: SidebarProps) {
  const pathname = usePathname();
  const items = getNavItems(isAdmin, { includeAdminLink: showAdminLink });

  return (
    <aside className="fixed left-0 top-0 z-30 hidden h-[100dvh] w-64 shrink-0 flex-col overflow-hidden border-r border-border bg-background/40 backdrop-blur md:flex">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 py-6">
        <Link href="/dashboard" className="mb-8 flex shrink-0 items-center gap-2.5 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-border bg-card">
            <Image src="/logomark.png" alt="Spotcoin" width={18} height={18} />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight text-foreground">Spotcoin</span>
            <span className="text-[11px] text-muted">Recognition</span>
          </div>
        </Link>

        <nav className="flex shrink-0 flex-col gap-1">
          {items.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" &&
                item.href !== "/admin" &&
                pathname.startsWith(`${item.href}/`)) ||
              (item.href === "/admin" && pathname.startsWith("/admin"));
            return (
              <Link
                key={`${item.href}-${item.label}`}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "border border-border-strong bg-card text-foreground"
                    : "border border-transparent text-muted hover:bg-card hover:text-foreground",
                )}
              >
                <Icon size={16} className="shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto shrink-0 rounded-[16px] border border-border bg-card p-4 pt-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Tip</p>
          <p className="mt-1.5 text-xs leading-relaxed text-foreground/80">
            Send a recognition on Fridays — small streaks build big culture.
          </p>
        </div>
      </div>
    </aside>
  );
}
