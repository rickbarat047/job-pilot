"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Scroll-triggered reveal without framer-motion (which never fired its
 * IntersectionObserver in production here). Renders inside a data-reveal
 * wrapper that starts hidden ONLY when scripting is enabled (CSS guard in
 * globals.css) and is always visible if JS never runs.
 */
export function Reveal({
  children,
  delay = 0,
  className,
  y = 16,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  y?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "-48px" },
    );
    io.observe(el);
    // Safety: reveal everything after 2.5s even if the observer misbehaves.
    const fallback = window.setTimeout(() => setShown(true), 2500);
    return () => {
      io.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      data-reveal=""
      data-revealed={shown ? "1" : "0"}
      style={{ "--reveal-y": `${y}px`, transitionDelay: delay ? `${delay}s` : undefined } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
