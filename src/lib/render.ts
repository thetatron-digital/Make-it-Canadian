import {
  Box,
  Padding,
  Point,
  Polygon,
  hingePoint,
  polygonPath,
  renderSize,
  splitPieces,
} from "./geometry";
import type { AvatarConfig } from "./types";

export type AvatarImage = HTMLImageElement | ImageBitmap | HTMLCanvasElement;

interface Derived {
  top: Polygon;
  bottom: Polygon;
  edge: [Point, Point] | null;
  hinge: Point;
  pad: Padding;
  width: number;
  height: number;
}

function derive(config: AvatarConfig, bounds: Box): Derived {
  const { top, bottom, edge } = splitPieces(config);
  const { width, height, pad } = renderSize(config, bounds);
  return { top, bottom, edge, hinge: hingePoint(config, bounds), pad, width, height };
}

/**
 * Which way the top piece swings. A left hinge lifts the right-hand side,
 * a right hinge lifts the left-hand side, and a centre hinge pivots about
 * the middle of the line.
 */
function swingDirection(config: AvatarConfig): number {
  return config.hingeSide === "right" ? 1 : -1;
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
   * @param timeSec   Seconds since the loop started, drives the idle sway.
   * @param scale     Extra scale applied on top of the device pixel ratio.
   */
  draw(ctx: CanvasRenderingContext2D, openValue: number, timeSec: number, dpr: number, scale: number): void {
    const config = this.config;
    const { top, bottom, hinge, pad, width, height } = this.derived;

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

    const angle = swingDirection(config) * openValue * ((config.maxOpenAngle * Math.PI) / 180);

    // 1. Bottom piece, untouched.
    ctx.save();
    ctx.beginPath();
    polygonPath(ctx, bottom);
    ctx.clip();
    ctx.drawImage(this.image as CanvasImageSource, 0, 0, config.imageWidth, config.imageHeight);
    ctx.restore();

    // 2. Mouth interior, filling the gap the rotation opens up.
    if (config.mouthInterior && Math.abs(angle) > 1e-4) {
      const mouth = this.renderMouthInterior(angle);
      if (mouth) ctx.drawImage(mouth, 0, 0, config.imageWidth, config.imageHeight);
    }

    // 3. Top piece, hinged open. The clip is applied after the rotation so
    // the polygon travels with the piece.
    ctx.save();
    ctx.translate(hinge.x, hinge.y);
    ctx.rotate(angle);
    ctx.translate(-hinge.x, -hinge.y);
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
   * The wedge of mouth interior revealed by the swing. The top piece's edge
   * sweeps an arc around the hinge, so the gap is the sector between the
   * resting edge and the rotated edge - one sector on each side of the
   * hinge, which is also what makes a centre hinge look right.
   *
   * The result is masked by the artwork's own alpha, so the interior can
   * never spill outside the silhouette of the character.
   */
  private renderMouthInterior(angle: number): HTMLCanvasElement | null {
    const { edge, hinge } = this.derived;
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

    for (const end of edge) {
      const radius = Math.hypot(end.x - hinge.x, end.y - hinge.y);
      if (radius < 0.5) continue;
      const start = Math.atan2(end.y - hinge.y, end.x - hinge.x);
      mctx.beginPath();
      mctx.moveTo(hinge.x, hinge.y);
      mctx.arc(hinge.x, hinge.y, radius, start, start + angle, angle < 0);
      mctx.closePath();
      mctx.fill();
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
