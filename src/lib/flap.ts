import { Box, Point, hingePoint, splitLine, splitPieces } from "./geometry";
import type { AvatarConfig, HingeSide } from "./types";

/**
 * The ways the top piece can move on a single flap.
 *
 * A mouth that always pivots from the same corner reads as a machine after
 * about ten seconds. Giving each flap its own motion is what makes it look
 * like someone talking rather than a hinge opening.
 */
export type FlapKind = "primary" | "secondary" | "lift" | "tertiary" | "swing";

/**
 * Ordered so raising the variety dial by one always adds the next most
 * useful motion. The first is whichever hinge the user picked, so variety 1
 * is exactly the original single-hinge look.
 */
export const FLAP_ORDER: FlapKind[] = ["primary", "secondary", "lift", "tertiary", "swing"];

export const MAX_VARIETY = FLAP_ORDER.length;

/**
 * The three pivots, starting from the one the user chose. Naming the slots
 * by position rather than by a fixed side is what keeps them distinct: with
 * a centre hinge, "your hinge" and "the seesaw" would otherwise be the same
 * motion, and the variety dial would quietly stop adding anything.
 */
function sideOrder(side: HingeSide): HingeSide[] {
  if (side === "left") return ["left", "right", "center"];
  if (side === "right") return ["right", "left", "center"];
  return ["center", "left", "right"];
}

/** Which pivot a hinge-based motion uses, or null when it does not pivot. */
export function hingeSideFor(kind: FlapKind, chosen: HingeSide): HingeSide | null {
  const order = sideOrder(chosen);
  if (kind === "primary") return order[0];
  if (kind === "secondary") return order[1];
  if (kind === "tertiary") return order[2];
  return null;
}

const SIDE_WORDS: Record<HingeSide, { label: string; blurb: string }> = {
  left: { label: "Left corner", blurb: "Pivots at the left, so the right side lifts." },
  right: { label: "Right corner", blurb: "Pivots at the right, so the left side lifts." },
  center: { label: "Middle", blurb: "Pivots in the centre: one side up, the other down." },
};

/** What to call a motion, given the hinge the user picked. */
export function flapLabel(kind: FlapKind, chosen: HingeSide): { label: string; blurb: string } {
  if (kind === "lift") {
    return { label: "Straight up", blurb: "No pivot at all — the top lifts, leaving an even gap." };
  }
  if (kind === "swing") {
    return { label: "Lift and tilt", blurb: "Rises and pivots at the same time." };
  }
  return SIDE_WORDS[hingeSideFor(kind, chosen) ?? chosen];
}

/** The motions in play at a given variety setting. */
export function flapPool(variety: number): FlapKind[] {
  const count = Math.min(MAX_VARIETY, Math.max(1, Math.round(variety)));
  return FLAP_ORDER.slice(0, count);
}

/**
 * How the top piece is displaced on this flap: rotate by `angle` about
 * `pivot`, then shift by `offset`. Every motion is expressible this way,
 * which keeps the renderer to a single code path.
 */
export interface FlapMotion {
  pivot: Point;
  angle: number;
  offset: Point;
}

const NO_OFFSET: Point = { x: 0, y: 0 };

/** A left hinge lifts the right-hand side, and vice versa. */
function directionFor(side: HingeSide): number {
  return side === "right" ? 1 : -1;
}

/** Length of the split line where it crosses the artwork. */
function edgeLength(config: AvatarConfig): number {
  const { edge } = splitPieces(config);
  if (!edge) return config.imageWidth;
  return Math.hypot(edge[1].x - edge[0].x, edge[1].y - edge[0].y);
}

/** Unit vector pointing away from the bottom piece, square to the split line. */
function liftDirection(config: AvatarConfig): Point {
  const { dir } = splitLine(config);
  return { x: dir.y, y: -dir.x };
}

/**
 * Work out the displacement for one flap.
 *
 * @param openValue 0-1, how far through the flap we are.
 */
export function flapMotion(kind: FlapKind, config: AvatarConfig, bounds: Box, openValue: number): FlapMotion {
  const full = (config.maxOpenAngle * Math.PI) / 180 * openValue;
  const side = config.hingeSide;

  switch (kind) {
    case "primary":
    case "secondary":
    case "tertiary": {
      const pivot = hingeSideFor(kind, side) ?? side;
      return { pivot: hingePoint(config, bounds, pivot), angle: directionFor(pivot) * full, offset: NO_OFFSET };
    }

    case "lift": {
      // Travel matched to how far a hinged flap's midpoint would move, so a
      // straight lift reads as the same size of movement.
      const distance = (edgeLength(config) / 2) * Math.sin(full);
      const direction = liftDirection(config);
      return {
        pivot: hingePoint(config, bounds, "center"),
        angle: 0,
        offset: { x: direction.x * distance, y: direction.y * distance },
      };
    }

    case "swing": {
      const distance = (edgeLength(config) / 4) * Math.sin(full);
      const direction = liftDirection(config);
      return {
        pivot: hingePoint(config, bounds, side),
        angle: directionFor(side) * full * 0.6,
        offset: { x: direction.x * distance, y: direction.y * distance },
      };
    }
  }
}

/** Apply a motion to a point, for bounds work and for drawing the mouth gap. */
export function applyFlap(motion: FlapMotion, p: Point): Point {
  const cos = Math.cos(motion.angle);
  const sin = Math.sin(motion.angle);
  const dx = p.x - motion.pivot.x;
  const dy = p.y - motion.pivot.y;
  return {
    x: motion.pivot.x + dx * cos - dy * sin + motion.offset.x,
    y: motion.pivot.y + dx * sin + dy * cos + motion.offset.y,
  };
}

export interface Padding {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * How far the artwork can travel outside the image rectangle once the top
 * piece moves and the whole thing sways. The canvas is padded by this so a
 * wide-open mouth is never clipped, and the OBS source size is derived from
 * it for the same reason.
 *
 * Every motion in the pool is measured, not just the current one: the
 * mouth may pick any of them mid-stream, and a canvas sized for a pivot
 * would crop a straight lift.
 */
export function renderPadding(config: AvatarConfig, bounds: Box): Padding {
  const { top } = splitPieces(config);
  const w = config.imageWidth;
  const h = config.imageHeight;
  const pad: Padding = { left: 0, right: 0, top: 0, bottom: 0 };

  for (const kind of flapPool(config.flapVariety)) {
    const motion = flapMotion(kind, config, bounds, 1);
    // Both directions: a seesaw sends one side down as the other goes up.
    for (const sign of [1, -1]) {
      const signed: FlapMotion = {
        pivot: motion.pivot,
        angle: motion.angle * sign,
        offset: { x: motion.offset.x * sign, y: motion.offset.y * sign },
      };
      for (const corner of top) {
        const moved = applyFlap(signed, corner);
        pad.left = Math.max(pad.left, -moved.x);
        pad.right = Math.max(pad.right, moved.x - w);
        pad.top = Math.max(pad.top, -moved.y);
        pad.bottom = Math.max(pad.bottom, moved.y - h);
      }
    }
  }

  if (config.idleSway) {
    // Sway rotates the whole group about its centre, so the worst case is
    // the longest radius times the sway angle.
    const sway = (config.swayAmount * Math.PI) / 180;
    const travel = (Math.hypot(w, h) / 2) * Math.abs(Math.sin(sway));
    pad.left += travel;
    pad.right += travel;
    pad.top += travel;
    pad.bottom += travel;
  }

  return {
    left: Math.ceil(pad.left) + 2,
    right: Math.ceil(pad.right) + 2,
    top: Math.ceil(pad.top) + 2,
    bottom: Math.ceil(pad.bottom) + 2,
  };
}

/** Full size of the canvas needed to show the avatar without clipping. */
export function renderSize(config: AvatarConfig, bounds: Box): { width: number; height: number; pad: Padding } {
  const pad = renderPadding(config, bounds);
  return {
    width: Math.round(config.imageWidth + pad.left + pad.right),
    height: Math.round(config.imageHeight + pad.top + pad.bottom),
    pad,
  };
}
