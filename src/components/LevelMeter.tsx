"use client";

import { useEffect, useRef, type MutableRefObject } from "react";

/**
 * Live input meter. It reads the level ref directly on every frame instead
 * of going through React state - this runs at 60fps next to a canvas that
 * is already doing real work.
 */
export function LevelMeter({
  levelRef,
  openRef,
  threshold,
}: {
  levelRef: MutableRefObject<number>;
  openRef: MutableRefObject<number>;
  threshold: number;
}) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const dotRef = useRef<HTMLDivElement | null>(null);
  const peakRef = useRef(0);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      // The meter is scaled to 0-0.5 RMS: normal speech sits mid-bar.
      const level = Math.min(1, levelRef.current / 0.5);
      peakRef.current = Math.max(level, peakRef.current * 0.94);
      if (barRef.current) barRef.current.style.width = `${peakRef.current * 100}%`;
      if (dotRef.current) dotRef.current.style.opacity = openRef.current > 0 ? "1" : "0.25";
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [levelRef, openRef]);

  return (
    <div className="space-y-1">
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-ink ring-1 ring-edge">
        <div ref={barRef} className="h-full rounded-full bg-emerald-400 transition-[width] duration-75" style={{ width: "0%" }} />
        <div
          className="absolute top-0 h-full w-0.5 bg-maple"
          style={{ left: `${Math.min(100, (threshold / 0.5) * 100)}%` }}
          title="Noise gate"
        />
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <div ref={dotRef} className="h-2 w-2 rounded-full bg-maple" style={{ opacity: 0.25 }} />
        <span>Green is your voice. The red line is the gate — the mouth only moves to the right of it.</span>
      </div>
    </div>
  );
}
