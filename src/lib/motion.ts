import { enabledFlaps } from "./flap";
import { SpeechWatcher, type SpeechState } from "./expression";
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
 * There are two ways to do this and they look completely different.
 *
 * Following the envelope - opening as far as the voice is loud and staying
 * there while the sound continues - is what a VU meter does, and it leaves
 * the mouth hanging half open through every held syllable.
 *
 * Flapping is what the cartoon does: each sound fires one complete
 * open-and-shut, to a degree chosen for that flap. The mouth is always
 * either on its way open or on its way shut, and it always returns to fully
 * closed before the next one starts. That closing is the whole look, so it
 * is the default.
 */
type Phase = "idle" | "opening" | "holding" | "closing";

export class MouthMotion {
  /** Continuous, pre-quantisation value. Envelope modes only. */
  private smoothed = 0;
  /** Which discrete position the mouth currently sits on, in hold mode. */
  private step = 0;
  /** Where this flap is in its open-and-shut cycle. */
  private phase: Phase = "idle";
  /** How far open this particular flap goes. */
  private target = 1;
  /** Current opening, driven by the phase rather than the envelope. */
  private value = 0;
  /** Which degree the last flap used, so consecutive flaps differ. */
  private lastDegree = -1;
  private watcher = new SpeechWatcher();
  private speech: SpeechState = { rate: 0, rush: 0, shouting: false };
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
    this.phase = "idle";
    this.target = 1;
    this.value = 0;
    this.lastDegree = -1;
    this.watcher.reset();
    this.speech = { rate: 0, rush: 0, shouting: false };
  }

  /** How the engine currently reads the speaker, for the editor's readout. */
  get speechState(): SpeechState {
    return this.speech;
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
    const drive = this.gate(level, config);
    this.speech = this.watcher.update(level, drive, dtMs, config.threshold);
    if (config.motionMode === "flap") return this.flapCycle(drive, dtMs, config);
    return this.followEnvelope(drive, dtMs, config);
  }

  /**
   * One complete open-and-shut per sound. Silence closes the mouth and
   * leaves it alone: nothing moves between sentences.
   */
  private flapCycle(drive: number, dtMs: number, config: AvatarConfig): number {
    const quiet = drive <= CLOSED_LEVEL;
    // A rush shortens the whole cycle on top of the user's own timings.
    const rush = config.rushEnabled ? this.speech.rush : 0;
    const scale = activityTimeScale(config.activity) * (1 - 0.45 * rush);
    const shouting = config.shoutHold && this.speech.shouting;

    if (this.phase === "idle") {
      if (quiet) {
        this.value = 0;
        return 0;
      }
      this.beginFlap(drive, config);
    }

    if (this.phase === "opening") {
      const rate = this.target / Math.max(1, config.attackMs * scale);
      this.value += rate * Math.max(0, dtMs);
      if (this.value >= this.target) {
        this.value = this.target;
        // A shout is one long sound, so the mouth stays where it is rather
        // than chattering through it.
        this.phase = shouting ? "holding" : "closing";
      } else if (quiet) {
        // They stopped mid-word: start shutting now rather than finishing
        // an opening nobody is making a sound for.
        this.phase = "closing";
      }
    } else if (this.phase === "holding") {
      this.value = this.target;
      if (!shouting || quiet) this.phase = "closing";
    } else if (this.phase === "closing") {
      const rate = this.target / Math.max(1, config.releaseMs * scale);
      this.value -= rate * Math.max(0, dtMs);
      if (this.value <= 0) {
        this.value = 0;
        this.phase = "idle";
        this.flapping = false;
      }
    }

    return clamp01(this.value);
  }

  /** Start a flap: pick how it moves, and how far it opens. */
  private beginFlap(drive: number, config: AvatarConfig): void {
    const chosen = nextFlap(this.sequence, enabledFlaps(config), config.flapOrder);
    this.flap = chosen.flap;
    this.sequence = chosen.state;
    // A shout goes straight to its widest and stays there.
    const shouting = config.shoutHold && this.speech.shouting;
    this.target = shouting ? 1 : this.chooseDegree(drive, config);
    this.phase = "opening";
    this.flapping = true;
  }

  /**
   * How far this flap opens, picked from the allowed positions. Loudness
   * decides which is most likely, but the degree the last flap used is
   * taken off the table entirely, so two flaps running never land on the
   * same opening while there is any alternative.
   */
  private chooseDegree(drive: number, config: AvatarConfig): number {
    const steps = Math.max(2, Math.round(config.snapSteps));
    const degrees = steps - 1;
    if (degrees <= 1) {
      this.lastDegree = 1;
      return 1;
    }

    const ideal = Math.min(degrees, Math.max(1, Math.round(clamp01(drive) * degrees)));
    let best = -1;
    let bestScore = -Infinity;
    for (let i = 1; i <= degrees; i++) {
      if (i === this.lastDegree) continue;
      // Closest to the loudness wins, with a nudge so it is not rigid.
      // A rush widens the spread, so the openings get less orderly.
      const spread = 0.9 + 2.4 * (config.rushEnabled ? this.speech.rush : 0);
      const score = -Math.abs(i - ideal) + Math.random() * spread;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    this.lastDegree = best;
    return best / degrees;
  }

  /** The older behaviour: track the voice and hold where it lands. */
  private followEnvelope(drive: number, dtMs: number, config: AvatarConfig): number {
    const target = drive;
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
