import { FlapKind, isHinge, leanOf } from "./flap";

/**
 * Picks the motion for each flap.
 *
 * Watching Terrance and Phillip, the mouth rarely does the same thing twice
 * running: it goes left, right, up, left, up, right. Two rules fall out of
 * that, and they are what this encodes.
 *
 * The first is that a corner almost never repeats, while a straight lift
 * happily can - a lift is the neutral move, so two in a row still reads as
 * talking, whereas the same corner twice reads as a stuck hinge.
 *
 * The second is that the mouth stays balanced. Every corner flap leans the
 * jaw one way, so the next choice is weighted towards the other side, and a
 * straight lift can always break the pattern. When a corner does repeat, the
 * lift is pushed up for the next few flaps, which is what keeps lifts more
 * common than repeated corners rather than the other way about.
 */

/** Weight multiplier when the same corner would come round twice. */
const REPEAT_HINGE = 0.1;
/** Weight multiplier for a second straight lift. Much gentler. */
const REPEAT_LIFT = 0.75;
/** How hard the lean pulls the next corner towards the opposite side. */
const BALANCE_PULL = 0.9;
/** Lean is bounded so a long run cannot make one side impossible. */
const MAX_LEAN = 3;
/** Added to the lift's weight when a corner repeats, then decayed each flap. */
const LIFT_BOOST = 1.5;
const BOOST_DECAY = 0.55;
const MAX_BOOST = 3;

export interface SequencerState {
  last: FlapKind | null;
  /** Negative leans left, positive leans right. */
  lean: number;
  /** Temporary extra appetite for straight lifts. */
  liftBoost: number;
  /** Which way the last lift leaned, so lifts alternate rather than repeat. */
  lastTilt: number;
  /** Position in the rotation, for the predictable order. */
  cursor: number;
}

export interface Flap {
  kind: FlapKind;
  /** -1..1, the lean given to a straight lift. Zero for pivots. */
  tilt: number;
}

export function initialState(): SequencerState {
  return { last: null, lean: 0, liftBoost: 0, lastTilt: 0, cursor: -1 };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Choose the next flap.
 *
 * @param order  "cycle" takes each enabled motion strictly in turn; "natural"
 *               applies the weighting above.
 * @param random Injected so the behaviour can be tested.
 */
export function nextFlap(
  state: SequencerState,
  enabled: FlapKind[],
  order: "natural" | "cycle",
  random: () => number = Math.random,
): { flap: Flap; state: SequencerState } {
  if (enabled.length === 0) {
    return { flap: { kind: "hingeLeft", tilt: 0 }, state };
  }

  if (enabled.length === 1) {
    const kind = enabled[0];
    return finish(state, kind, enabled, random);
  }

  if (order === "cycle") {
    const cursor = (state.cursor + 1) % enabled.length;
    return finish({ ...state, cursor }, enabled[cursor], enabled, random);
  }

  const weights = enabled.map((kind) => {
    let weight = 1;

    if (kind === state.last) {
      weight *= isHinge(kind) ? REPEAT_HINGE : REPEAT_LIFT;
    }

    // Steer the corners back towards balance.
    const lean = leanOf(kind);
    if (lean !== 0 && state.lean !== 0) {
      const correcting = Math.sign(lean) !== Math.sign(state.lean);
      const strength = 1 + BALANCE_PULL * Math.abs(state.lean);
      weight *= correcting ? strength : 1 / strength;
    }

    if (kind === "lift") weight *= 1 + state.liftBoost;

    return weight;
  });

  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = random() * total;
  let picked = enabled.length - 1;
  for (let i = 0; i < enabled.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      picked = i;
      break;
    }
  }

  return finish(state, enabled[picked], enabled, random);
}

/** Update the running state for the motion we just chose. */
function finish(
  state: SequencerState,
  kind: FlapKind,
  enabled: FlapKind[],
  random: () => number,
): { flap: Flap; state: SequencerState } {
  const repeatedHinge = kind === state.last && isHinge(kind);
  const lean = leanOf(kind);

  const next: SequencerState = {
    last: kind,
    // A neutral move lets the lean relax back towards the middle.
    lean: lean === 0 ? state.lean * 0.5 : clamp(state.lean + lean, -MAX_LEAN, MAX_LEAN),
    liftBoost: repeatedHinge
      ? Math.min(MAX_BOOST, state.liftBoost + LIFT_BOOST)
      : state.liftBoost * BOOST_DECAY,
    lastTilt: state.lastTilt,
    cursor: state.cursor,
  };

  let tilt = 0;
  if (kind === "lift") {
    // Lean against the way the jaw is currently sitting, and failing that,
    // against the way the last lift leaned, so lifts do not all match.
    const against = state.lean !== 0 ? -Math.sign(state.lean) : state.lastTilt !== 0 ? -Math.sign(state.lastTilt) : random() < 0.5 ? -1 : 1;
    tilt = against * (0.25 + random() * 0.75);
    next.lastTilt = tilt;
  }

  return { flap: { kind, tilt }, state: next };
}

/** Enabled motions, used by the editor to explain what is on. */
export function describeMix(enabled: FlapKind[]): string {
  if (enabled.length === 1) return "Every flap moves the same way.";
  if (enabled.length === 2) return "Two motions, alternating.";
  return `${enabled.length} motions, never the same corner twice running.`;
}
