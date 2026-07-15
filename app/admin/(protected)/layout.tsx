import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { pathnameFromHeaders, searchFromHeaders } from "@/lib/adminRequestPath";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/db";

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const headerList = await headers();
  const pathname = pathnameFromHeaders(headerList);
  const search = searchFromHeaders(headerList);

  if (!session?.user?.id) {
    const login = new URL("/admin/login", "https://internal.local");
    const returnPath = pathname && pathname.startsWith("/admin") ? pathname : "/admin";
    if (returnPath !== "/admin/login") {
      login.searchParams.set("redirect", `${returnPath}${search}`);
    }
    redirect(`${login.pathname}${login.search}`);
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: session.user.workspaceId },
    select: {
      onboardingComplete: true,
      values: {
        select: { id: true },
      },
    },
  });

  const shouldOnboard = !!workspace && !workspace.onboardingComplete && workspace.values.length === 0;
  if (shouldOnboard && pathname && pathname !== "/admin/onboarding") {
    redirect("/admin/onboarding");
  }

  return (
    <AppShell isAdmin role={session.user.role}>
      {children}
    </AppShell>
  );
}
