export type HingeSide = "left" | "right" | "center";
export type MotionMode = "smooth" | "snap";
export type BackgroundMode = "transparent" | "green" | "custom";

export const GREEN_SCREEN = "#00b140";

export interface AvatarConfig {
  /** Schema version, so saved links keep working as the app changes. */
  version: 1;
  /** Public URL of the uploaded PNG. */
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;

  /** Split line position as a fraction (0-1) of image height, measured at the horizontal centre of the image. */
  splitY: number;
  /** Split line tilt in degrees, -25..25. Positive tilts the right-hand side down. */
  splitAngle: number;
  /** Which end of the line the top piece pivots around. */
  hingeSide: HingeSide;
  /** Degrees the top piece swings at full volume, 5..45. */
  maxOpenAngle: number;

  /** Chosen microphone. Empty string means "ask me on load". */
  deviceId: string;
  /** Human readable label, only used to re-find the device if its id changed. */
  deviceLabel: string;
  /** Noise gate, 0..1 of RMS input. */
  threshold: number;
  /** Milliseconds to open and to close. */
  attackMs: number;
  releaseMs: number;

  motionMode: MotionMode;
  /** How many positions the mouth is allowed to land on in snap mode, 2..8. */
  snapSteps: number;
  /**
   * How eager the mouth is, 0..100. Low is calm and only moves for real
   * speech; high is twitchy click-clack that reacts to every syllable.
   */
  activity: number;

  mouthInterior: boolean;
  mouthColor: string;

  idleSway: boolean;
  /** Degrees of sway, 0..4. */
  swayAmount: number;
  /** Sway cycles per second, 0.05..1.5. */
  swaySpeed: number;

  background: BackgroundMode;
  backgroundColor: string;
}

export const DEFAULT_CONFIG: Omit<AvatarConfig, "imageUrl" | "imageWidth" | "imageHeight"> = {
  version: 1,
  splitY: 0.55,
  splitAngle: 0,
  hingeSide: "left",
  maxOpenAngle: 18,
  deviceId: "",
  deviceLabel: "",
  threshold: 0.06,
  attackMs: 40,
  releaseMs: 120,
  motionMode: "snap",
  snapSteps: 2,
  activity: 50,
  mouthInterior: true,
  mouthColor: "#000000",
  idleSway: true,
  swayAmount: 1.1,
  swaySpeed: 0.28,
  background: "transparent",
  backgroundColor: GREEN_SCREEN,
};

export const LIMITS = {
  splitAngle: { min: -25, max: 25 },
  maxOpenAngle: { min: 5, max: 45 },
  threshold: { min: 0, max: 0.5 },
  attackMs: { min: 5, max: 400 },
  releaseMs: { min: 20, max: 800 },
  snapSteps: { min: 2, max: 8 },
  activity: { min: 0, max: 100 },
  swayAmount: { min: 0, max: 4 },
  swaySpeed: { min: 0.05, max: 1.5 },
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function num(value: unknown, fallback: number, lo: number, hi: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? clamp(n, lo, hi) : fallback;
}

function str(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function hex(value: unknown, fallback: string): string {
  const s = typeof value === "string" ? value.trim() : "";
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s : fallback;
}

/**
 * Coerce anything that came off the network into a usable config. Saved
 * links have to survive schema changes, so every field falls back to its
 * default instead of throwing.
 */
export function normalizeConfig(raw: unknown): AvatarConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const imageUrl = str(r.imageUrl, "");
  if (!imageUrl) return null;

  const d = DEFAULT_CONFIG;
  const hingeSide = str(r.hingeSide, d.hingeSide);
  const motionMode = str(r.motionMode, d.motionMode);
  const background = str(r.background, d.background);

  return {
    version: 1,
    imageUrl,
    imageWidth: num(r.imageWidth, 512, 1, 8192),
    imageHeight: num(r.imageHeight, 512, 1, 8192),
    splitY: num(r.splitY, d.splitY, 0.02, 0.98),
    splitAngle: num(r.splitAngle, d.splitAngle, LIMITS.splitAngle.min, LIMITS.splitAngle.max),
    hingeSide: (["left", "right", "center"].includes(hingeSide) ? hingeSide : d.hingeSide) as HingeSide,
    maxOpenAngle: num(r.maxOpenAngle, d.maxOpenAngle, LIMITS.maxOpenAngle.min, LIMITS.maxOpenAngle.max),
    deviceId: str(r.deviceId, ""),
    deviceLabel: str(r.deviceLabel, ""),
    threshold: num(r.threshold, d.threshold, LIMITS.threshold.min, LIMITS.threshold.max),
    attackMs: num(r.attackMs, d.attackMs, LIMITS.attackMs.min, LIMITS.attackMs.max),
    releaseMs: num(r.releaseMs, d.releaseMs, LIMITS.releaseMs.min, LIMITS.releaseMs.max),
    motionMode: (motionMode === "smooth" ? "smooth" : "snap") as MotionMode,
    snapSteps: Math.round(num(r.snapSteps, d.snapSteps, LIMITS.snapSteps.min, LIMITS.snapSteps.max)),
    activity: num(r.activity, d.activity, LIMITS.activity.min, LIMITS.activity.max),
    mouthInterior: typeof r.mouthInterior === "boolean" ? r.mouthInterior : d.mouthInterior,
    mouthColor: hex(r.mouthColor, d.mouthColor),
    idleSway: typeof r.idleSway === "boolean" ? r.idleSway : d.idleSway,
    swayAmount: num(r.swayAmount, d.swayAmount, LIMITS.swayAmount.min, LIMITS.swayAmount.max),
    swaySpeed: num(r.swaySpeed, d.swaySpeed, LIMITS.swaySpeed.min, LIMITS.swaySpeed.max),
    background: (["transparent", "green", "custom"].includes(background) ? background : d.background) as BackgroundMode,
    backgroundColor: hex(r.backgroundColor, d.backgroundColor),
  };
}
