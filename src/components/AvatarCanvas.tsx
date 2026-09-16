"use client";

import { useEffect, useRef, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent } from "react";
import { hingePoint, type Box } from "@/lib/geometry";
import { AvatarScene, type AvatarImage } from "@/lib/render";
import type { AvatarConfig } from "@/lib/types";

interface Layout {
  scale: number;
  cssWidth: number;
  cssHeight: number;
  sceneWidth: number;
  sceneHeight: number;
  padLeft: number;
  padTop: number;
}

export interface AvatarCanvasProps {
  image: AvatarImage;
  bounds: Box;
  config: AvatarConfig;
  /** Read every frame, so the animation never re-renders React. */
  openValueRef: MutableRefObject<number>;
  /** Which motion the current flap uses. Defaults to the first in the pool. */
  variantRef?: MutableRefObject<number>;
  className?: string;
  /** Draws the split line and lets the user drag it. Editor only. */
  interactive?: boolean;
  onSplitDrag?: (splitY: number) => void;
  /** Checkerboard behind the avatar so transparency is obvious. Editor only. */
  showTransparencyGrid?: boolean;
}

export function AvatarCanvas({
  image,
  bounds,
  config,
  openValueRef,
  variantRef,
  className,
  interactive = false,
  onSplitDrag,
  showTransparencyGrid = false,
}: AvatarCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<AvatarScene | null>(null);
  const layoutRef = useRef<Layout | null>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [dragging, setDragging] = useState(false);

  // Keep the scene in step with the config without rebuilding it per frame.
  if (!sceneRef.current) sceneRef.current = new AvatarScene(image, config, bounds);
  useEffect(() => {
    sceneRef.current?.update(config, bounds, image);
  }, [config, bounds, image]);

  // Fit the padded render box into whatever space the page gives us.
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const measure = () => {
      const scene = sceneRef.current;
      if (!scene) return;
      const { width: sceneWidth, height: sceneHeight } = scene.size;
      const rect = container.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;

      const scale = Math.min(rect.width / sceneWidth, rect.height / sceneHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = Math.max(1, Math.round(sceneWidth * scale * dpr));
      canvas.height = Math.max(1, Math.round(sceneHeight * scale * dpr));
      canvas.style.width = `${sceneWidth * scale}px`;
      canvas.style.height = `${sceneHeight * scale}px`;

      const next: Layout = {
        scale,
        cssWidth: sceneWidth * scale,
        cssHeight: sceneHeight * scale,
        sceneWidth,
        sceneHeight,
        padLeft: scene.padding.left,
        padTop: scene.padding.top,
      };
      layoutRef.current = next;
      setLayout(next);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [config, bounds]);

  // The render loop. Paused while the tab is hidden so an unwatched OBS
  // source is not burning a core.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    let elapsed = 0;
    let last = performance.now();

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const currentLayout = layoutRef.current;
      const scene = sceneRef.current;
      if (!currentLayout || !scene) return;
      elapsed += Math.min(now - last, 100) / 1000;
      last = now;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      scene.draw(ctx, openValueRef.current, variantRef?.current ?? 0, elapsed, dpr, currentLayout.scale);
    };

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else if (!frame) {
        last = performance.now();
        frame = requestAnimationFrame(loop);
      }
    };

    if (!document.hidden) frame = requestAnimationFrame(loop);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [openValueRef, variantRef]);

  /** Pointer position -> split position as a fraction of image height. */
  const splitFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = layoutRef.current;
    const canvas = canvasRef.current;
    if (!current || !canvas || !onSplitDrag) return;
    const rect = canvas.getBoundingClientRect();
    const imageY = (event.clientY - rect.top) / current.scale - current.padTop;
    onSplitDrag(Math.min(0.98, Math.max(0.02, imageY / config.imageHeight)));
  };

  const guide = layout ? splitGuide(config, bounds, layout) : null;

  return (
    <div ref={containerRef} className={`relative flex items-center justify-center overflow-hidden ${className ?? ""}`}>
      <div className="relative" style={layout ? { width: layout.cssWidth, height: layout.cssHeight } : undefined}>
        {showTransparencyGrid && (
          <div
            aria-hidden
            className="absolute inset-0 rounded-md opacity-70"
            style={{
              backgroundImage:
                "linear-gradient(45deg, #e7e6e1 25%, transparent 25%), linear-gradient(-45deg, #e7e6e1 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e7e6e1 75%), linear-gradient(-45deg, transparent 75%, #e7e6e1 75%)",
              backgroundSize: "18px 18px",
              backgroundPosition: "0 0, 0 9px, 9px -9px, -9px 0",
            }}
          />
        )}
        <canvas ref={canvasRef} className="relative block" />
        {interactive && layout && guide && (
          <div
            className="absolute inset-0 cursor-ns-resize touch-none"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              setDragging(true);
              splitFromPointer(event);
            }}
            onPointerMove={(event) => {
              if (dragging) splitFromPointer(event);
            }}
            onPointerUp={(event) => {
              event.currentTarget.releasePointerCapture(event.pointerId);
              setDragging(false);
            }}
            onPointerCancel={() => setDragging(false)}
          >
            <svg className="h-full w-full overflow-visible" aria-hidden>
              <line
                x1={guide.x1}
                y1={guide.y1}
                x2={guide.x2}
                y2={guide.y2}
                stroke="#ffffff"
                strokeWidth={dragging ? 5 : 4}
              />
              <line
                x1={guide.x1}
                y1={guide.y1}
                x2={guide.x2}
                y2={guide.y2}
                stroke="#d8232a"
                strokeWidth={dragging ? 3 : 2}
                strokeDasharray="7 5"
              />
              <circle cx={guide.hingeX} cy={guide.hingeY} r={7} fill="#d8232a" stroke="#ffffff" strokeWidth={2} />
            </svg>
            <p className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 rounded-md border-[1.5px] border-ink bg-paper px-2 py-1 text-[11px] font-semibold">
              Drag the line to move the mouth
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** The split line and hinge dot, in CSS pixels relative to the canvas. */
function splitGuide(config: AvatarConfig, bounds: Box, layout: Layout) {
  const theta = (config.splitAngle * Math.PI) / 180;
  const centreY = config.splitY * config.imageHeight;
  const halfWidth = config.imageWidth / 2;
  const toCss = (x: number, y: number) => ({
    x: (x + layout.padLeft) * layout.scale,
    y: (y + layout.padTop) * layout.scale,
  });
  const left = toCss(0, centreY - halfWidth * Math.tan(theta));
  const right = toCss(config.imageWidth, centreY + halfWidth * Math.tan(theta));
  // Same hinge the renderer uses, so the dot never lies about the pivot.
  const pivot = hingePoint(config, bounds);
  const hinge = toCss(pivot.x, pivot.y);
  return { x1: left.x, y1: left.y, x2: right.x, y2: right.y, hingeX: hinge.x, hingeY: hinge.y };
}
