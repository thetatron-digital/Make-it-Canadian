export type MicStatus = "idle" | "starting" | "running" | "denied" | "lost" | "error";

export interface MicDevice {
  deviceId: string;
  label: string;
}

export interface MicState {
  status: MicStatus;
  message: string;
  /** The device actually in use, which may differ from the one requested. */
  activeLabel: string;
  activeDeviceId: string;
}

/**
 * Reads one chosen microphone and nothing else.
 *
 * This is deliberately independent of OBS. OBS mixes game audio, music,
 * alerts and voice chat into the stream, and none of that should ever move
 * the mouth - so the avatar listens to a single input device picked by the
 * user, straight from the browser.
 */
export class MicEngine {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private buffer: Float32Array = new Float32Array(0);
  private state: MicState = { status: "idle", message: "", activeLabel: "", activeDeviceId: "" };

  constructor(private onState: (state: MicState) => void) {}

  getState(): MicState {
    return this.state;
  }

  private setState(
    status: MicStatus,
    message = "",
    activeLabel = this.state.activeLabel,
    activeDeviceId = this.state.activeDeviceId,
  ): void {
    this.state = { status, message, activeLabel, activeDeviceId };
    this.onState(this.state);
  }

  /**
   * Device labels are hidden until the user has granted access at least
   * once, so this asks for the default input purely to unlock the names,
   * then releases it immediately.
   */
  static async listDevices(): Promise<MicDevice[]> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) return [];
    try {
      const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
      probe.getTracks().forEach((track) => track.stop());
    } catch {
      // No permission yet: fall through and return whatever we can see.
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((device) => device.kind === "audioinput")
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `Microphone ${index + 1}`,
      }));
  }

  async start(deviceId: string, fallbackLabel = ""): Promise<void> {
    this.stop();
    this.setState("starting", "Waiting for microphone access…");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // `exact` so a missing interface fails loudly instead of quietly
          // falling back to the wrong microphone mid-stream.
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          // The meter and the gate should see the real signal.
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        this.setState("denied", "Microphone access was blocked. Allow it and reload this page.");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        this.setState("lost", "That microphone is not connected. Plug it back in, or pick another one in the editor.");
      } else {
        this.setState("error", "The microphone could not be started. Reload this page to try again.");
      }
      return;
    }

    this.stream = stream;
    const track = stream.getAudioTracks()[0];
    const label = track?.label || fallbackLabel || "Microphone";
    track?.addEventListener("ended", () => {
      this.setState("lost", "The microphone was disconnected. Plug it back in and refresh this page.");
    });

    const AudioCtor: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const context = new AudioCtor();
    // Browsers may hand back a suspended context when there was no click.
    if (context.state === "suspended") await context.resume().catch(() => undefined);

    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0;
    context.createMediaStreamSource(stream).connect(analyser);

    this.context = context;
    this.analyser = analyser;
    this.buffer = new Float32Array(analyser.fftSize);
    // Report the device we actually landed on, so the editor can save a
    // concrete choice instead of "whatever the system felt like".
    this.setState("running", "", label, track?.getSettings().deviceId ?? "");
  }

  /** Root-mean-square level of the current audio frame, roughly 0-1. */
  level(): number {
    const analyser = this.analyser;
    if (!analyser) return 0;
    analyser.getFloatTimeDomainData(this.buffer as Float32Array<ArrayBuffer>);
    let sum = 0;
    for (let i = 0; i < this.buffer.length; i++) sum += this.buffer[i] * this.buffer[i];
    return Math.sqrt(sum / this.buffer.length);
  }

  /** True once a suspended context has been resumed by a user gesture. */
  async resume(): Promise<void> {
    if (this.context?.state === "suspended") await this.context.resume().catch(() => undefined);
  }

  stop(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.analyser = null;
    void this.context?.close().catch(() => undefined);
    this.context = null;
    if (this.state.status !== "idle") this.setState("idle");
  }
}

/**
 * Re-find a saved device after a reboot or a replug. Chrome rotates device
 * ids between origins and sessions, so the label is the more durable key.
 */
export function resolveDevice(devices: MicDevice[], deviceId: string, label: string): MicDevice | null {
  if (devices.length === 0) return null;
  const byId = devices.find((device) => device.deviceId === deviceId && device.deviceId !== "");
  if (byId) return byId;
  const byLabel = label ? devices.find((device) => device.label === label) : undefined;
  return byLabel ?? null;
}
