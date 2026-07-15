"use client";

import { Suspense } from "react";

import { CredentialsLoginForm } from "@/components/CredentialsLoginForm";

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: "100vh",
            background: "#0d0d0d",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ color: "#555", fontSize: 14 }}>Loading…</span>
        </main>
      }
    >
      <CredentialsLoginForm mode="admin" />
    </Suspense>
  );
}
