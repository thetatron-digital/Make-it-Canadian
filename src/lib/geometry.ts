import type { AvatarConfig, HingeSide } from "./types";

export interface Point {
  x: number;
  y: number;
}

export type Polygon = Point[];

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SplitLine {
  /** A point the line passes through. */
  origin: Point;
  /** Unit direction of the line. */
  dir: Point;
}

/**
 * The split line in image space. It always spans the whole image; `splitY`
 * is measured at the horizontal centre so tilting pivots about the middle
 * instead of sliding the mouth sideways.
 */
export function splitLine(config: AvatarConfig): SplitLine {
  const theta = (config.splitAngle * Math.PI) / 180;
  return {
    origin: { x: config.imageWidth / 2, y: config.splitY * config.imageHeight },
    dir: { x: Math.cos(theta), y: Math.sin(theta) },
  };
}

/**
 * Signed distance-ish value: negative above the line, positive below it,
 * zero on it. Used as the half-plane test for clipping.
 */
export function sideOf(line: SplitLine, p: Point): number {
  return line.dir.x * (p.y - line.origin.y) - line.dir.y * (p.x - line.origin.x);
}

function intersectWithLine(line: SplitLine, a: Point, b: Point): Point {
  const da = sideOf(line, a);
  const db = sideOf(line, b);
  const denom = da - db;
  // Parallel-ish segment: nothing meaningful to cut, keep the endpoint.
  if (Math.abs(denom) < 1e-9) return { x: b.x, y: b.y };
  const t = da / denom;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/**
 * Sutherland-Hodgman clip of a convex polygon against one side of the split
 * line. `keepNegative` selects the top piece, otherwise the bottom piece.
 * This is what makes tilt work: the halves come out as polygons, and a line
 * that exits through the left and right edges, or through the top and
 * bottom edges, is handled by the same code.
 */
export function clipToSide(poly: Polygon, line: SplitLine, keepNegative: boolean): Polygon {
  const inside = (p: Point) => (keepNegative ? sideOf(line, p) <= 0 : sideOf(line, p) >= 0);
  const out: Polygon = [];
  for (let i = 0; i < poly.length; i++) {
    const current = poly[i];
    const previous = poly[(i + poly.length - 1) % poly.length];
    const currentIn = inside(current);
    const previousIn = inside(previous);
    if (currentIn) {
      if (!previousIn) out.push(intersectWithLine(line, previous, current));
      out.push(current);
    } else if (previousIn) {
      out.push(intersectWithLine(line, previous, current));
    }
  }
  return out;
}

export function rectPolygon(w: number, h: number): Polygon {
  return [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
}

export interface SplitPieces {
  top: Polygon;
  bottom: Polygon;
  /** The split line clipped to the image rectangle, left endpoint first. */
  edge: [Point, Point] | null;
}

export function splitPieces(config: AvatarConfig): SplitPieces {
  const line = splitLine(config);
  const rect = rectPolygon(config.imageWidth, config.imageHeight);
  const top = clipToSide(rect, line, true);
  const bottom = clipToSide(rect, line, false);

  // The shared edge is the pair of points that lie on the line.
  const onLine = top.filter((p) => Math.abs(sideOf(line, p)) < 1e-6);
  let edge: [Point, Point] | null = null;
  if (onLine.length >= 2) {
    const sorted = [...onLine].sort((a, b) => a.x - b.x || a.y - b.y);
    edge = [sorted[0], sorted[sorted.length - 1]];
  }
  return { top, bottom, edge };
}

/**
 * The pivot. It always sits ON the line, and slides along the line as the
 * line tilts, so a crooked mouth still hinges from its own corner.
 * `bounds` is the alpha bounding box, so the hinge lands on the visible
 * artwork rather than on empty transparent margin.
 */
export function hingePoint(config: AvatarConfig, bounds: Box, side: HingeSide = config.hingeSide): Point {
  const line = splitLine(config);
  const x = hingeX(side, bounds);
  // Solve for the point on the line at this x. Vertical lines are impossible
  // here because the tilt is capped at +/-25 degrees.
  const t = (x - line.origin.x) / line.dir.x;
  return { x, y: line.origin.y + line.dir.y * t };
}

function hingeX(side: HingeSide, bounds: Box): number {
  if (side === "left") return bounds.x;
  if (side === "right") return bounds.x + bounds.w;
  return bounds.x + bounds.w / 2;
}

export function rotatePoint(p: Point, pivot: Point, radians: number): Point {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = p.x - pivot.x;
  const dy = p.y - pivot.y;
  return {
    x: pivot.x + dx * cos - dy * sin,
    y: pivot.y + dx * sin + dy * cos,
  };
}

export function polygonPath(ctx: CanvasRenderingContext2D | Path2D, poly: Polygon): void {
  if (poly.length === 0) return;
  ctx.moveTo(poly[0].x, poly[0].y);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
  ctx.closePath();
}
