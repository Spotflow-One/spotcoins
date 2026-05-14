import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Activity, ArrowRight, BarChart2, Heart, Sparkles, Wallet } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardHeroName } from "@/components/dashboard/DashboardHeroName";

function formatHeroDate(date: Date) {
  const day = date.getDate();
  const month = date.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

function formatNaira(value: number) {
  return `₦${value.toLocaleString("en-NG")}`;
}

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      username: true,
      coinsToGive: true,
      spotTokensEarned: true,
      workspace: {
        select: {
          tokenValueNaira: true,
          name: true,
        },
      },
    },
  });

  if (!user) {
    redirect("/login");
  }

  const projectedValue = user.spotTokensEarned * user.workspace.tokenValueNaira;
  const today = new Date();
  const monthName = today.toLocaleString("en-US", { month: "long" });

  const featureCards = [
    {
      href: "/dashboard/feed",
      title: "Feed",
      subtitle: "See all recognitions",
      icon: Activity,
    },
    {
      href: "/dashboard/recognise",
      title: "Recognise",
      subtitle: "Send a Spotcoin",
      icon: Heart,
    },
    {
      href: "/dashboard/wallet",
      title: "My Wallet",
      subtitle: "Tokens and history",
      icon: Wallet,
    },
    {
      href: "/dashboard/leaderboard",
      title: "Leaderboard",
      subtitle: "Top this month",
      icon: BarChart2,
    },
  ];

  return (
    <section className="pb-10 pt-2">
      <div className="space-y-6">
        <header className="space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
            LAGOS · {formatHeroDate(today)}
          </p>
          <div>
            <DashboardHeroName username={user.username} name={user.name} email={user.email} />
            <p className="text-[32px] font-bold leading-[1.05] tracking-[-0.6px] text-muted">
              Build. Ship. Connect.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {user.coinsToGive > 0 ? (
              <Badge variant="accent">
                <Image src="/logomark.png" alt="Spotcoin" width={11} height={11} />
                {user.coinsToGive} coins to give
              </Badge>
            ) : (
              <Badge>
                <span className="h-1.5 w-1.5 rounded-full bg-muted" />
                No coins this month
              </Badge>
            )}
            <Badge>
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              {monthName} active
            </Badge>
          </div>
        </header>

        <article className="rounded-[20px] border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-border bg-card-2">
                <Image src="/logomark.png" alt="Spotcoin" width={14} height={14} />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-foreground">{user.workspace.name}</p>
                <p className="text-[11px] text-muted">Token wallet snapshot</p>
              </div>
            </div>
            <Badge>
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Live
            </Badge>
          </div>
          <div className="grid grid-cols-2 divide-x divide-border">
            <div className="px-5 py-4">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
                Coins to Give
              </p>
              <p className="mt-1.5 font-mono text-[32px] font-bold leading-none text-foreground">
                {user.coinsToGive}
              </p>
              <p className="mt-1.5 text-[11px] text-muted">Resets monthly</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
                Spot Tokens
              </p>
              <p className="mt-1.5 font-mono text-[32px] font-bold leading-none text-foreground">
                {user.spotTokensEarned}
              </p>
              <p className="mt-1.5 text-[11px] text-muted">≈ {formatNaira(projectedValue)}</p>
            </div>
          </div>
        </article>

        <Link
          href="/dashboard/recognise"
          className="group flex items-center gap-3 rounded-[16px] border border-border bg-card p-4 transition-colors hover:border-border-strong hover:bg-card-2"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-border bg-card-2">
            <Sparkles size={16} className="text-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Reward unlock hint</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">
              Reach your monthly streak to unlock bonus distribution.
            </p>
          </div>
          <ArrowRight size={16} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
        </Link>

        <div className="grid grid-cols-2 gap-3">
          {featureCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.href}
                href={card.href}
                className="group flex min-h-[124px] flex-col justify-between rounded-[16px] border border-border bg-card p-4 transition-colors hover:border-border-strong hover:bg-card-2"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-card-2">
                  <Icon size={15} className="text-foreground" />
                </div>
                <div>
                  <p className="text-base font-semibold leading-tight text-foreground">{card.title}</p>
                  <p className="mt-1 text-[11px] text-muted">{card.subtitle}</p>
                </div>
              </Link>
            );
          })}
        </div>

        <Button asChild className="w-full">
          <Link href="/dashboard/recognise">
            Send a Spotcoin
            <ArrowRight size={14} />
          </Link>
        </Button>

        {user.coinsToGive === 0 ? (
          <div className="rounded-[16px] border border-border bg-card p-4">
            <p className="text-sm font-semibold text-foreground">Your coins are currently empty</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Your coins refill on the 1st. Check back soon.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
