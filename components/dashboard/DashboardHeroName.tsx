"use client";

import { useEffect, useRef, useState } from "react";
import { dashboardHeroGreetingName } from "@/lib/publicDisplayName";

type HeroFields = {
  username: string | null;
  name: string | null;
  email: string;
};

export function DashboardHeroName(props: HeroFields) {
  const [name, setName] = useState(() => dashboardHeroGreetingName(props));
  const refreshGen = useRef(0);

  useEffect(() => {
    const id = ++refreshGen.current;
    setName(dashboardHeroGreetingName(props));

    const ac = new AbortController();
    void (async () => {
      try {
        const res = await fetch("/api/users/me", {
          cache: "no-store",
          credentials: "include",
          signal: ac.signal,
        });
        const j = (await res.json()) as { data?: HeroFields };
        if (id !== refreshGen.current) return;
        if (!res.ok || !j.data) return;
        setName(dashboardHeroGreetingName(j.data));
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    })();

    return () => ac.abort();
  }, [props.username, props.name, props.email]);

  return (
    <h1 className="text-[32px] font-bold leading-[1.05] tracking-[-0.6px] text-foreground">
      Hey {name}.
    </h1>
  );
}
