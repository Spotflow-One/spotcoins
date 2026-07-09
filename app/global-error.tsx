"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <div className="max-w-sm space-y-4 text-center">
          <h2 className="text-lg font-semibold">Something went wrong</h2>
          <p className="text-sm text-muted">An unexpected error occurred. Please try again.</p>
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
