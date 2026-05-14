import NextAuth from "next-auth";
import type { Session } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { error } from "@/lib/api";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: env.NEXTAUTH_SECRET,
  /** Required on Netlify (and other reverse proxies) so sign-in does not redirect to `/api/auth/error`. */
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;

        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const emailTrimmed = email.trim();
        if (!emailTrimmed || !password) {
          return null;
        }

        try {
          const user = await prisma.user.findFirst({
            where: {
              email: { equals: emailTrimmed, mode: "insensitive" },
              deletedAt: null,
            },
          });

          if (!user) {
            return null;
          }

          const isPasswordValid = await compare(password, user.passwordHash);
          if (!isPasswordValid) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            workspaceId: user.workspaceId,
          };
        } catch (err) {
          if (process.env.SPOTCOIN_LAUNCH_DEBUG === "1") {
            console.error("[auth.authorize]", err instanceof Error ? err.message : err);
          }
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = user.role;
        token.workspaceId = user.workspaceId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.role = token.role as "EMPLOYEE" | "MANAGER" | "ADMIN";
        session.user.workspaceId = token.workspaceId as string;
      }
      return session;
    },
  },
});

type RouteContext = {
  params?: Record<string, string>;
};

type NextRouteContext = {
  params?: Promise<Record<string, string>> | Record<string, string>;
};

type RouteHandler = (
  request: Request,
  context: RouteContext,
  session: Session,
) => Promise<Response>;

export function requireAuth(handler: RouteHandler) {
  return async (request: Request, context: NextRouteContext) => {
    const session = await auth();
    if (!session?.user?.id || !session.user.workspaceId) {
      return error(new AppError("Authentication required", "UNAUTHORIZED", 401));
    }
    const params = await Promise.resolve(context?.params ?? {});
    return handler(request, { params }, session);
  };
}

export function requireAdmin(handler: RouteHandler) {
  return async (request: Request, context: NextRouteContext) => {
    const session = await auth();
    if (!session?.user?.id || !session.user.workspaceId) {
      return error(new AppError("Authentication required", "UNAUTHORIZED", 401));
    }
    if (session.user.role !== "ADMIN") {
      return error(new AppError("Admin access required", "FORBIDDEN", 403));
    }
    const params = await Promise.resolve(context?.params ?? {});
    return handler(request, { params }, session);
  };
}

export function requireAdminOrManager(handler: RouteHandler) {
  return async (request: Request, context: NextRouteContext) => {
    const session = await auth();
    if (!session?.user?.id || !session.user.workspaceId) {
      return error(new AppError("Authentication required", "UNAUTHORIZED", 401));
    }
    if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
      return error(new AppError("Admin or manager access required", "FORBIDDEN", 403));
    }
    const params = await Promise.resolve(context?.params ?? {});
    return handler(request, { params }, session);
  };
}
