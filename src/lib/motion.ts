import { enabledFlaps } from "./flap";
import { Flap, SequencerState, initialState, nextFlap } from "./sequence";
import type { AvatarConfig } from "./types";

/**
 * Loudness range above the gate that counts as "full volume", at activity 0
 * and at activity 100. A narrow range means quiet speech already pushes the
 * mouth to its widest position, which is what makes it feel chatty.
 */
const SPAN_CALM = 0.3;
const SPAN_CHATTY = 0.06;

/** Attack/release multiplier at activity 0 and at activity 100. */
const TIME_SCALE_CALM = 2;
const TIME_SCALE_CHATTY = 0.4;

/** Fraction of one step a value must overshoot before the mouth changes position. */
const SNAP_HYSTERESIS = 0.28;

/**
 * Below this the mouth reads as shut. It is not zero on purpose: the
 * smoothing decays exponentially and only reaches zero given a long enough
 * silence, so testing against zero would mean a new flap is almost never
 * detected at ordinary release settings.
 */
const CLOSED_LEVEL = 0.02;

export function activitySpan(activity: number): number {
  return SPAN_CALM + (SPAN_CHATTY - SPAN_CALM) * (activity / 100);
}

export function activityTimeScale(activity: number): number {
  return TIME_SCALE_CALM + (TIME_SCALE_CHATTY - TIME_SCALE_CALM) * (activity / 100);
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Turns a raw microphone level into the 0-1 amount the mouth is open.
 *
 * Chain: noise gate -> loudness span scaled by activity -> attack/release
 * smoothing -> quantise to the chosen number of mouth positions. Keeping it
 * in one place means the simulate slider in the editor drives exactly the
 * same maths as a real microphone does on the live page.
 */
export class MouthMotion {
  /** Continuous, pre-quantisation value. */
  private smoothed = 0;
  /** Which discrete position the mouth currently sits on, in snap mode. */
  private step = 0;
  /** The motion this flap is using, chosen once as the mouth opens. */
  private flap: Flap = { kind: "hingeLeft", tilt: 0 };
  private sequence: SequencerState = initialState();
  /** Whether we are inside a flap, so each one picks its motion exactly once. */
  private flapping = false;

  reset(): void {
    this.smoothed = 0;
    this.step = 0;
    this.flap = { kind: "hingeLeft", tilt: 0 };
    this.sequence = initialState();
    this.flapping = false;
  }

  /** The motion the current flap is using. */
  get currentFlap(): Flap {
    return this.flap;
  }

  /** The smoothed value before quantisation, handy for meters. */
  get raw(): number {
    return this.smoothed;
  }

  update(level: number, dtMs: number, config: AvatarConfig): number {
    const target = this.gate(level, config);
    // A flap runs from the mouth leaving shut to it settling back. Picking
    // the motion on that leading edge keeps it steady for the whole flap,
    // and the two thresholds stop a wavering signal from swapping motions
    // halfway through one.
    if (!this.flapping && target > CLOSED_LEVEL) {
      this.flapping = true;
      const chosen = nextFlap(this.sequence, enabledFlaps(config), config.flapOrder);
      this.flap = chosen.flap;
      this.sequence = chosen.state;
    } else if (this.flapping && target <= 0 && this.smoothed < CLOSED_LEVEL) {
      this.flapping = false;
    }
    const timeScale = activityTimeScale(config.activity);
    const tau = Math.max(1, (target > this.smoothed ? config.attackMs : config.releaseMs) * timeScale);
    // Exponential approach, framerate independent.
    const coefficient = 1 - Math.exp(-Math.max(0, dtMs) / tau);
    this.smoothed += (target - this.smoothed) * coefficient;
    if (Math.abs(this.smoothed) < 1e-4) this.smoothed = 0;

    if (config.motionMode === "smooth") return clamp01(this.smoothed);
    return this.quantize(clamp01(this.smoothed), config.snapSteps);
  }

  /** Noise gate plus the activity-scaled loudness span. */
  private gate(level: number, config: AvatarConfig): number {
    if (!Number.isFinite(level) || level <= config.threshold) return 0;
    return clamp01((level - config.threshold) / activitySpan(config.activity));
  }

  /**
   * Snap to one of N evenly spaced positions. The hysteresis stops a value
   * that sits right on a boundary from buzzing between two positions - the
   * mouth has to mean it before it moves.
   */
  private quantize(value: number, steps: number): number {
    const count = Math.max(2, Math.round(steps));
    const stepSize = 1 / (count - 1);
    const exact = value / stepSize;
    const target = Math.round(exact);
    if (target !== this.step && Math.abs(exact - this.step) > 0.5 + SNAP_HYSTERESIS) {
      this.step = Math.min(count - 1, Math.max(0, target));
    }
    return this.step * stepSize;
  }
}

/**
 * A stand-in for a microphone so the editor can be tuned in silence. It
 * fakes a speech envelope - syllables inside phrases, with breaths between
 * them - rather than a steady tone, because a steady tone would hide
 * exactly the chatter that the motion settings exist to control.
 *
 * @param amount 0-1, from the simulate slider.
 * @returns A level on the same scale as a real microphone's RMS.
 */
export function simulatedLevel(timeSec: number, amount: number): number {
  if (amount <= 0) return 0;
  const syllables = Math.abs(Math.sin(timeSec * 9.4) * Math.sin(timeSec * 3.1 + 0.7)) ** 0.7;
  // Gaps between sentences, about a second every four. Any longer and
  // someone tuning the preview thinks the thing has frozen.
  const breathing = Math.sin(timeSec * 1.6) > -0.75 ? 1 : 0;
  return amount * 0.45 * syllables * breathing;
}
