/**
 * Watches how someone is talking, using nothing but loudness over time.
 *
 * Two things are worth knowing and both fall out of the level alone, with
 * no need to recognise vowels or tones:
 *
 * How fast they are going, counted as syllable onsets - the level dipping
 * and rising again. Rapid speech produces many; a held sound produces one
 * and then nothing, which is exactly what tells a shout apart from a
 * sentence.
 *
 * Whether they are shouting, measured as the level sitting well above their
 * own gate for long enough that it cannot be a syllable.
 */

/** The level must dip below this before another onset can be counted. */
const ONSET_LOW = 0.08;
/** ...and rise above this to count as one. */
const ONSET_HIGH = 0.25;
/** Onsets are counted over this rolling window, in milliseconds. */
const RATE_WINDOW = 2500;

/** Syllables per second at which a rush begins, and where it is in full. */
const RUSH_FROM = 4.5;
const RUSH_FULL = 8.5;

/**
 * How far above the noise gate counts as a shout, in RMS. Speech sits
 * roughly 0.05-0.2; a raised voice clears 0.3. Measuring against the user's
 * own gate rather than an absolute keeps it honest across microphones.
 */
const SHOUT_MARGIN = 0.22;
/** It has to stay up there this long: longer than any single syllable. */
const SHOUT_HOLD_MS = 280;
/** Once shouting, it takes a bigger drop to stop, so it cannot flicker. */
const SHOUT_RELEASE = 0.6;

export interface SpeechState {
  /** Syllable onsets per second, smoothed over the window. */
  rate: number;
  /** 0-1, how much of a rush this is. */
  rush: number;
  /** True while the voice is held loud. */
  shouting: boolean;
}

export class SpeechWatcher {
  private onsets: number[] = [];
  private clock = 0;
  /** Whether the level has dipped far enough for a new onset to count. */
  private armed = true;
  private loudMs = 0;
  private shouting = false;

  reset(): void {
    this.onsets = [];
    this.clock = 0;
    this.armed = true;
    this.loudMs = 0;
    this.shouting = false;
  }

  /**
   * @param rawLevel  RMS straight from the microphone.
   * @param drive     The gated, normalised 0-1 value the mouth runs on.
   * @param threshold The user's noise gate.
   */
  update(rawLevel: number, drive: number, dtMs: number, threshold: number): SpeechState {
    this.clock += Math.max(0, dtMs);

    // Count a syllable each time the level dips and comes back up.
    if (drive < ONSET_LOW) this.armed = true;
    else if (this.armed && drive > ONSET_HIGH) {
      this.armed = false;
      this.onsets.push(this.clock);
    }
    const oldest = this.clock - RATE_WINDOW;
    while (this.onsets.length > 0 && this.onsets[0] < oldest) this.onsets.shift();
    const rate = this.onsets.length / (RATE_WINDOW / 1000);

    // A shout is loudness that outlasts a syllable.
    const shoutLevel = threshold + SHOUT_MARGIN;
    const stayLevel = threshold + SHOUT_MARGIN * SHOUT_RELEASE;
    if (rawLevel >= shoutLevel) this.loudMs += Math.max(0, dtMs);
    else if (rawLevel < stayLevel) this.loudMs = 0;

    if (!this.shouting && this.loudMs >= SHOUT_HOLD_MS) this.shouting = true;
    else if (this.shouting && rawLevel < stayLevel) this.shouting = false;

    const rush = clamp01((rate - RUSH_FROM) / (RUSH_FULL - RUSH_FROM));
    return { rate, rush, shouting: this.shouting };
  }
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
