"use client";

import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { eventCoverImgSrc } from "@/lib/eventCoverDisplayUrl";
import { cn } from "@/lib/utils";

type EventCoverMediaProps = {
  url: string | null;
  /** Outer frame: sizing, border, rounding (e.g. aspect-[2/1] w-full …) */
  frameClassName: string;
  iconSize?: number;
};

export function EventCoverMedia({ url, frameClassName, iconSize = 22 }: EventCoverMediaProps) {
  const resolved = eventCoverImgSrc(url);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [resolved]);

  if (!resolved || broken) {
    return (
      <div
        className={cn(
          "flex items-center justify-center border border-border bg-card-2 text-muted",
          frameClassName,
        )}
      >
        <CalendarDays size={iconSize} strokeWidth={1.25} aria-hidden />
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden border border-border bg-card-2", frameClassName)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolved}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center"
        loading="lazy"
        onError={() => setBroken(true)}
      />
    </div>
  );
}
