import { Box, Point, Polygon, polygonPath, splitPieces } from "./geometry";
import {
  FlapKind,
  FlapMotion,
  Padding,
  applyFlap,
  flapMotion,
  flapPool,
  renderSize,
} from "./flap";
import type { AvatarConfig } from "./types";

export type AvatarImage = HTMLImageElement | ImageBitmap | HTMLCanvasElement;

interface Derived {
  top: Polygon;
  bottom: Polygon;
  edge: [Point, Point] | null;
  pool: FlapKind[];
  pad: Padding;
  width: number;
  height: number;
}

function derive(config: AvatarConfig, bounds: Box): Derived {
  const { top, bottom, edge } = splitPieces(config);
  const { width, height, pad } = renderSize(config, bounds);
  return { top, bottom, edge, pool: flapPool(config.flapVariety), pad, width, height };
}

/**
 * Holds everything that only changes when the config changes, plus the
 * scratch canvas used to mask the mouth interior. One instance per canvas,
 * reused every frame.
 */
export class AvatarScene {
  private derived: Derived;
  private mouthCanvas: HTMLCanvasElement | null = null;

  constructor(
    private image: AvatarImage,
    private config: AvatarConfig,
    private bounds: Box,
  ) {
    this.derived = derive(config, bounds);
  }

  update(config: AvatarConfig, bounds: Box, image?: AvatarImage): void {
    if (image) this.image = image;
    this.config = config;
    this.bounds = bounds;
    this.derived = derive(config, bounds);
  }

  get size(): { width: number; height: number } {
    return { width: this.derived.width, height: this.derived.height };
  }

  get padding(): Padding {
    return this.derived.pad;
  }

  /**
   * Draws one frame.
   *
   * @param openValue 0-1, how far open the mouth is.
   * @param variant   Which motion this flap is using, indexed into the pool.
   * @param timeSec   Seconds since the loop started, drives the idle sway.
   * @param scale     Extra scale applied on top of the device pixel ratio.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    openValue: number,
    variant: number,
    timeSec: number,
    dpr: number,
    scale: number,
  ): void {
    const config = this.config;
    const { top, bottom, pool, pad, width, height } = this.derived;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width * scale * dpr, height * scale * dpr);
    if (config.background !== "transparent") {
      ctx.fillStyle = config.background === "green" ? "#00b140" : config.backgroundColor;
      ctx.fillRect(0, 0, width * scale * dpr, height * scale * dpr);
    }

    const unit = dpr * scale;
    // Everything below is drawn in image coordinates; this puts the image
    // rectangle inside the padded canvas.
    ctx.setTransform(unit, 0, 0, unit, pad.left * unit, pad.top * unit);

    ctx.save();
    this.applySway(ctx, timeSec);

    const kind = pool[Math.min(pool.length - 1, Math.max(0, variant))] ?? "primary";
    const motion = flapMotion(kind, config, this.bounds, openValue);
    const moving = Math.abs(motion.angle) > 1e-4 || Math.hypot(motion.offset.x, motion.offset.y) > 0.01;

    // 1. Bottom piece, untouched.
    ctx.save();
    ctx.beginPath();
    polygonPath(ctx, bottom);
    ctx.clip();
    ctx.drawImage(this.image as CanvasImageSource, 0, 0, config.imageWidth, config.imageHeight);
    ctx.restore();

    // 2. Mouth interior, filling the gap the movement opens up.
    if (config.mouthInterior && moving) {
      const mouth = this.renderMouthInterior(motion);
      if (mouth) ctx.drawImage(mouth, 0, 0, config.imageWidth, config.imageHeight);
    }

    // 3. Top piece, moved. The clip is applied after the transform so the
    // polygon travels with the piece.
    ctx.save();
    ctx.translate(motion.offset.x, motion.offset.y);
    ctx.translate(motion.pivot.x, motion.pivot.y);
    ctx.rotate(motion.angle);
    ctx.translate(-motion.pivot.x, -motion.pivot.y);
    ctx.beginPath();
    polygonPath(ctx, top);
    ctx.clip();
    ctx.drawImage(this.image as CanvasImageSource, 0, 0, config.imageWidth, config.imageHeight);
    ctx.restore();

    ctx.restore();
  }

  /** Idle sway is applied to the whole group so the two pieces stay joined. */
  private applySway(ctx: CanvasRenderingContext2D, timeSec: number): void {
    const config = this.config;
    if (!config.idleSway || config.swayAmount <= 0) return;
    const pivot = {
      x: this.bounds.x + this.bounds.w / 2,
      y: this.bounds.y + this.bounds.h,
    };
    const angle = ((config.swayAmount * Math.PI) / 180) * Math.sin(timeSec * config.swaySpeed * Math.PI * 2);
    ctx.translate(pivot.x, pivot.y);
    ctx.rotate(angle);
    ctx.translate(-pivot.x, -pivot.y);
  }

  /**
   * The mouth interior revealed by the movement.
   *
   * A pure pivot sweeps its edge along an arc, so the gap is a circular
   * sector either side of the hinge - two of them, which is what makes a
   * seesaw look right. Once the piece also travels, the gap becomes the
   * quadrilateral between the resting edge and the moved one, which is
   * exactly right for a straight lift.
   *
   * The result is masked by the artwork's own alpha, so the interior can
   * never spill outside the silhouette of the character.
   */
  private renderMouthInterior(motion: FlapMotion): HTMLCanvasElement | null {
    const { edge } = this.derived;
    if (!edge) return null;
    const config = this.config;

    if (!this.mouthCanvas) this.mouthCanvas = document.createElement("canvas");
    const canvas = this.mouthCanvas;
    if (canvas.width !== config.imageWidth || canvas.height !== config.imageHeight) {
      canvas.width = config.imageWidth;
      canvas.height = config.imageHeight;
    }
    const mctx = canvas.getContext("2d");
    if (!mctx) return null;

    mctx.setTransform(1, 0, 0, 1, 0, 0);
    mctx.globalCompositeOperation = "source-over";
    mctx.clearRect(0, 0, canvas.width, canvas.height);
    mctx.fillStyle = config.mouthColor;

    const travels = Math.hypot(motion.offset.x, motion.offset.y) > 0.01;
    if (travels) {
      const movedStart = applyFlap(motion, edge[0]);
      const movedEnd = applyFlap(motion, edge[1]);
      mctx.beginPath();
      mctx.moveTo(edge[0].x, edge[0].y);
      mctx.lineTo(edge[1].x, edge[1].y);
      mctx.lineTo(movedEnd.x, movedEnd.y);
      mctx.lineTo(movedStart.x, movedStart.y);
      mctx.closePath();
      mctx.fill();
    } else {
      const pivot = motion.pivot;
      for (const end of edge) {
        const radius = Math.hypot(end.x - pivot.x, end.y - pivot.y);
        if (radius < 0.5) continue;
        const start = Math.atan2(end.y - pivot.y, end.x - pivot.x);
        mctx.beginPath();
        mctx.moveTo(pivot.x, pivot.y);
        mctx.arc(pivot.x, pivot.y, radius, start, start + motion.angle, motion.angle < 0);
        mctx.closePath();
        mctx.fill();
      }
    }

    // Keep only the part that sits on the artwork.
    mctx.globalCompositeOperation = "destination-in";
    mctx.drawImage(this.image as CanvasImageSource, 0, 0, canvas.width, canvas.height);
    mctx.globalCompositeOperation = "source-over";
    return canvas;
  }
}

/**
 * A sensible OBS Browser Source size for this avatar: the padded render box
 * scaled so the long edge is about 600px, which reads well on a 1080p scene
 * without the streamer having to resize anything.
 */
export function obsDimensions(width: number, height: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  const scale = longest > 0 ? 600 / longest : 1;
  return {
    width: Math.max(64, Math.round((width * scale) / 2) * 2),
    height: Math.max(64, Math.round((height * scale) / 2) * 2),
  };
}
