"use client";

import { useState } from "react";
import { getSession, signIn, signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";

import {
  resolveCredentialsLoginDestination,
  type LoginMode,
} from "@/lib/credentialsLoginDestination";
import { getSlackOAuthLoginMessage } from "@/lib/slackOAuthLoginMessages";

export type { LoginMode };

type CredentialsLoginFormProps = {
  mode: LoginMode;
};

export function CredentialsLoginForm({ mode }: CredentialsLoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const passwordUpdated = searchParams.get("reset") === "1";
  const slackOAuthStatus = searchParams.get("slack");
  const slackOAuthMessage = getSlackOAuthLoginMessage(slackOAuthStatus);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateLabel = `${new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })} · Lagos`;

  const subtitle =
    mode === "admin"
      ? "Sign in with an admin account to manage your Spotcoin workspace."
      : "Enter your work email to sign in to your Spotcoin account.";
  const heading = mode === "admin" ? "Admin sign in" : "Welcome";

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password.");
        setLoading(false);
        return;
      }

      const session = await getSession();
      const role = session?.user?.role;
      const destination = resolveCredentialsLoginDestination({
        mode,
        role,
        redirectRaw: searchParams.get("redirect"),
      });

      if (!destination.ok) {
        await signOut({ redirect: false });
        setError("This account does not have admin access.");
        setLoading(false);
        return;
      }

      router.push(destination.path);
    } catch {
      setError("Invalid email or password.");
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        background: "#0d0d0d",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 16px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 900,
          height: 500,
          background:
            "radial-gradient(ellipse 70% 60% at 50% 0%, rgba(255,255,255,0.07) 0%, transparent 100%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 900,
          height: 500,
          background:
            "radial-gradient(ellipse 50% 40% at 50% 0%, rgba(200,160,120,0.04) 0%, transparent 100%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            justifyContent: "center",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "#1a1a1a",
              border: "1px solid rgba(255,255,255,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Image src="/logomark.png" alt="Spotcoin mark" width={22} height={22} />
          </div>
          <p style={{ margin: 0, fontSize: 16 }}>
            <span style={{ fontWeight: 500, color: "#e8e8e8" }}>Spotcoin</span>
            <span style={{ fontWeight: 400, color: "#555" }}>
              {mode === "admin" ? " Admin" : " Internal"}
            </span>
          </p>
        </div>

        <h1
          style={{
            margin: 0,
            marginBottom: 6,
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: "-0.6px",
            color: "#f0f0f0",
            textAlign: "center",
          }}
        >
          Spotcoin
        </h1>
        <p
          suppressHydrationWarning
          style={{
            margin: 0,
            marginBottom: 36,
            fontSize: 14,
            color: "#4a4a4a",
            textAlign: "center",
          }}
        >
          {dateLabel}
        </p>

        <section
          style={{
            width: "100%",
            maxWidth: 420,
            background: "#161616",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 20,
            padding: "28px 24px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Sparkles size={15} color="#f0f0f0" />
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#f0f0f0" }}>{heading}</p>
          </div>

          <p
            style={{
              margin: 0,
              marginBottom: 24,
              fontSize: 13,
              color: "#555",
              lineHeight: 1.65,
            }}
          >
            {subtitle}
          </p>

          {passwordUpdated ? (
            <div
              style={{
                marginBottom: 16,
                background: "rgba(34,197,94,0.08)",
                border: "1px solid rgba(34,197,94,0.22)",
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 13,
                color: "#86efac",
                lineHeight: 1.5,
              }}
            >
              Password updated. Sign in with your new password.
            </div>
          ) : null}

          {slackOAuthMessage ? (
            <div
              role="alert"
              style={{
                marginBottom: 16,
                background:
                  slackOAuthStatus === "connected"
                    ? "rgba(34,197,94,0.08)"
                    : "rgba(245,158,11,0.08)",
                border:
                  slackOAuthStatus === "connected"
                    ? "1px solid rgba(34,197,94,0.22)"
                    : "1px solid rgba(245,158,11,0.25)",
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 13,
                color: slackOAuthStatus === "connected" ? "#86efac" : "#fcd34d",
                lineHeight: 1.55,
              }}
            >
              {slackOAuthMessage}
            </div>
          ) : null}

          <label
            htmlFor="email"
            style={{
              display: "block",
              marginBottom: 8,
              fontSize: 13,
              fontWeight: 500,
              color: "#c0c0c0",
            }}
          >
            Email
          </label>
          <input
            id="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="you@company.com"
            type="email"
            style={{
              width: "100%",
              background: "#1e1e1e",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
              padding: "14px 16px",
              fontSize: 14,
              color: "#f0f0f0",
              fontFamily: "inherit",
              outline: "none",
              marginBottom: 14,
              transition: "border-color 0.15s, background 0.15s",
            }}
          />

          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            style={{
              width: "100%",
              background: "#1e1e1e",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
              padding: "14px 16px",
              fontSize: 14,
              color: "#f0f0f0",
              fontFamily: "inherit",
              outline: "none",
              marginBottom: 20,
              transition: "border-color 0.15s, background 0.15s",
            }}
          />

          <div style={{ textAlign: "right", marginBottom: 16 }}>
            <Link
              href="/forgot-password"
              style={{
                fontSize: 13,
                color: "#888",
                textDecoration: "none",
              }}
            >
              Forgot password?
            </Link>
          </div>

          {error ? (
            <div
              style={{
                marginBottom: 12,
                background: "rgba(239,68,68,0.07)",
                border: "1px solid rgba(239,68,68,0.18)",
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 13,
                color: "#ef4444",
              }}
            >
              {error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleSignIn}
            disabled={loading || !email || !password}
            style={{
              width: "100%",
              background: "#efefef",
              color: "#0a0a0a",
              border: "none",
              borderRadius: 12,
              padding: "15px 20px",
              fontSize: 15,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "background 0.1s, opacity 0.1s, transform 0.1s",
              opacity: loading ? 0.88 : 1,
            }}
          >
            {loading ? (
              <span
                style={{
                  width: 14,
                  height: 14,
                  border: "2px solid rgba(0,0,0,0.15)",
                  borderTopColor: "#0a0a0a",
                  borderRadius: "50%",
                  animation: "spin 0.7s linear infinite",
                }}
              />
            ) : (
              <>
                Continue
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </section>

        <p
          style={{
            marginTop: 20,
            textAlign: "center",
            fontSize: 12,
            color: "#2e2e2e",
          }}
        >
          {mode === "admin" ? (
            <>
              Looking for the employee app?{" "}
              <Link href="/login" style={{ color: "#555", textDecoration: "underline" }}>
                User sign in
              </Link>
            </>
          ) : (
            "By continuing you agree to recognise great work."
          )}
        </p>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        input::placeholder {
          color: rgba(255,255,255,0.18);
        }
        input:focus {
          border-color: rgba(255,255,255,0.2) !important;
          background: #222222 !important;
        }
        button:hover {
          background: #e0e0e0 !important;
        }
        button:active {
          opacity: 0.88 !important;
          transform: scale(0.99);
        }
      `}</style>
    </main>
  );
}
