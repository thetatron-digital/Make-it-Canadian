import { Box, Point, hingePoint, splitLine, splitPieces } from "./geometry";
import type { AvatarConfig } from "./types";

/**
 * The ways the top piece can move on a single flap.
 *
 * Deliberately concrete rather than abstract slots: the user ticks the ones
 * they want, so "left corner" always means the left corner.
 */
export type FlapKind = "hingeLeft" | "hingeRight" | "middle" | "lift";

export const ALL_FLAPS: FlapKind[] = ["hingeLeft", "hingeRight", "lift", "middle"];

export const FLAP_LABELS: Record<FlapKind, { label: string; blurb: string }> = {
  hingeLeft: { label: "Left corner", blurb: "Pivots at the left, so the right side lifts." },
  hingeRight: { label: "Right corner", blurb: "Pivots at the right, so the left side lifts." },
  lift: { label: "Straight up", blurb: "Lifts with a slight lean, leaving an even gap." },
  middle: { label: "Middle", blurb: "Pivots in the centre: one side up, the other down." },
};

/** Straight up is the neutral move; everything else pivots about a corner. */
export function isHinge(kind: FlapKind): boolean {
  return kind !== "lift";
}

/** Which way a motion pushes the mouth: left, right, or neither. */
export function leanOf(kind: FlapKind): number {
  if (kind === "hingeLeft") return -1;
  if (kind === "hingeRight") return 1;
  return 0;
}

/** How much of the open angle a straight lift may lean, at full tilt. */
const LIFT_TILT_SHARE = 0.45;

export function enabledFlaps(config: AvatarConfig): FlapKind[] {
  const chosen = ALL_FLAPS.filter((kind) => config.flapMotions.includes(kind));
  // Never leave the mouth with nothing to do.
  return chosen.length > 0 ? chosen : ["hingeLeft"];
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
 * @param tilt      -1..1, the lean this particular flap was given. Only a
 *                  straight lift uses it: a perfectly parallel lift every
 *                  time looks mechanical, and a little lean reads as a head
 *                  moving without turning the lift into another hinge.
 */
export function flapMotion(
  kind: FlapKind,
  config: AvatarConfig,
  bounds: Box,
  openValue: number,
  tilt = 0,
): FlapMotion {
  const full = ((config.maxOpenAngle * Math.PI) / 180) * openValue;

  switch (kind) {
    case "hingeLeft":
      return { pivot: hingePoint(config, bounds, "left"), angle: -full, offset: NO_OFFSET };

    case "hingeRight":
      return { pivot: hingePoint(config, bounds, "right"), angle: full, offset: NO_OFFSET };

    case "middle":
      return { pivot: hingePoint(config, bounds, "center"), angle: -full, offset: NO_OFFSET };

    case "lift": {
      // Travel matched to how far a hinged flap's midpoint would move, so a
      // straight lift reads as the same size of movement.
      const distance = (edgeLength(config) / 2) * Math.sin(full);
      const direction = liftDirection(config);
      return {
        pivot: hingePoint(config, bounds, "center"),
        angle: full * LIFT_TILT_SHARE * tilt,
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
 * Every enabled motion is measured at its worst case, not just the current
 * one: the mouth may pick any of them mid-stream, and a canvas sized for a
 * pivot would crop a lift.
 */
export function renderPadding(config: AvatarConfig, bounds: Box): Padding {
  const { top } = splitPieces(config);
  const w = config.imageWidth;
  const h = config.imageHeight;
  const pad: Padding = { left: 0, right: 0, top: 0, bottom: 0 };

  for (const kind of enabledFlaps(config)) {
    for (const tilt of kind === "lift" ? [-1, 1] : [0]) {
      const motion = flapMotion(kind, config, bounds, 1, tilt);
      // Both directions: a middle pivot sends one side down as the other rises.
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
