"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getNavItems } from "@/lib/nav-items";
import { cn } from "@/lib/utils";

type BottomNavProps = {
  isAdmin: boolean;
  showAdminLink?: boolean;
};

export function BottomNav({ isAdmin, showAdminLink = false }: BottomNavProps) {
  const pathname = usePathname();
  const items = getNavItems(isAdmin, { includeAdminLink: showAdminLink });

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-nav/90 px-2 py-2 pb-[max(env(safe-area-inset-bottom),8px)] backdrop-blur supports-[backdrop-filter]:bg-nav/70 md:hidden">
      <div className="mx-auto flex w-full max-w-md items-stretch justify-around overflow-x-auto">
        {items.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" &&
              item.href !== "/admin" &&
              pathname.startsWith(`${item.href}/`)) ||
            (item.href === "/admin" && pathname.startsWith("/admin"));
          const Icon = item.icon;
          return (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              className="flex min-w-[3.25rem] flex-1 flex-col items-center gap-1 py-1"
              aria-current={isActive ? "page" : undefined}
            >
              <span
                className={cn(
                  "flex h-8 w-12 items-center justify-center rounded-full transition-colors",
                  isActive ? "bg-card text-foreground" : "text-muted/70",
                )}
              >
                <Icon size={18} />
              </span>
              <span
                className={cn(
                  "max-w-[4.5rem] truncate text-center text-[10px] font-medium",
                  isActive ? "text-foreground" : "text-muted/70",
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
