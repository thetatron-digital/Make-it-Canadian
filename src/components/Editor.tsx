"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AvatarCanvas } from "./AvatarCanvas";
import { LevelMeter } from "./LevelMeter";
import { SuccessPanel } from "./SuccessPanel";
import { Field, Segmented, SiteHeader, Slider, Toggle } from "./ui";
import { resolveDevice } from "@/lib/audio";
import { useAvatarImage } from "@/lib/useAvatarImage";
import { useMouthDriver } from "@/lib/useMouthDriver";
import {
  DEFAULT_CONFIG,
  GREEN_SCREEN,
  LIMITS,
  type AvatarConfig,
  type BackgroundMode,
  type HingeSide,
  type MotionMode,
} from "@/lib/types";

/** Tilt is a style choice, but nobody wants an accidental 1 degree lean. */
const ANGLE_SNAP = 2;

export function Editor({ initialId, initialConfig }: { initialId?: string; initialConfig?: AvatarConfig }) {
  const [config, setConfig] = useState<AvatarConfig | null>(initialConfig ?? null);
  const [file, setFile] = useState<File | null>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [simulate, setSimulate] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(initialId ?? null);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [micRequested, setMicRequested] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const successRef = useRef<HTMLDivElement | null>(null);

  const update = useCallback((patch: Partial<AvatarConfig>) => {
    setConfig((previous) => (previous ? { ...previous, ...patch } : previous));
    setJustSaved(false);
  }, []);

  const imageUrl = localUrl ?? config?.imageUrl ?? null;
  const { loaded, status } = useAvatarImage(imageUrl);

  // A config only exists once there is an image to measure.
  useEffect(() => {
    if (!loaded) return;
    setConfig((previous) => {
      if (previous) {
        return { ...previous, imageWidth: loaded.width, imageHeight: loaded.height };
      }
      return {
        ...DEFAULT_CONFIG,
        imageUrl: "",
        imageWidth: loaded.width,
        imageHeight: loaded.height,
        // 55% down the visible artwork, which lands on the mouth of almost
        // any character portrait.
        splitY: (loaded.bounds.y + loaded.bounds.h * 0.55) / loaded.height,
      };
    });
  }, [loaded]);

  const driver = useMouthDriver(config ?? ({ ...DEFAULT_CONFIG, imageUrl: "", imageWidth: 1, imageHeight: 1 } as AvatarConfig), simulate);
  const { openRef, levelRef, micState, devices, refreshDevices, startMic } = driver;

  // Show the device list up front: picking the right microphone is the one
  // step people get wrong, and an empty dropdown does not help them.
  useEffect(() => {
    void refreshDevices();
  }, [refreshDevices]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) return;
    const onChange = () => void refreshDevices();
    navigator.mediaDevices.addEventListener("devicechange", onChange);
    return () => navigator.mediaDevices.removeEventListener("devicechange", onChange);
  }, [refreshDevices]);

  // Never leave the saved config on "system default": once we know which
  // input the browser actually opened, record that one.
  useEffect(() => {
    if (micState.status !== "running" || !micState.activeDeviceId) return;
    if (config?.deviceId) return;
    update({ deviceId: micState.activeDeviceId, deviceLabel: micState.activeLabel });
  }, [micState.status, micState.activeDeviceId, micState.activeLabel, config?.deviceId, update]);

  // The save button lives at the bottom of the controls; the link it
  // produces must not be left off-screen.
  useEffect(() => {
    if (justSaved) successRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [justSaved]);

  // Re-select a saved microphone when reopening a saved avatar.
  useEffect(() => {
    if (!config || config.deviceId || !initialConfig?.deviceLabel || devices.length === 0) return;
    const match = resolveDevice(devices, initialConfig.deviceId, initialConfig.deviceLabel);
    if (match) update({ deviceId: match.deviceId, deviceLabel: match.label });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices]);

  const onPickFile = useCallback((picked: File | null) => {
    if (!picked) return;
    if (picked.type !== "image/png" && !picked.name.toLowerCase().endsWith(".png")) {
      setError("That needs to be a PNG. Save your image as a PNG and try again.");
      return;
    }
    if (picked.size > 4 * 1024 * 1024) {
      setError("That PNG is larger than 4 MB. Try a smaller one.");
      return;
    }
    setError(null);
    setFile(picked);
    setLocalUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return URL.createObjectURL(picked);
    });
    setJustSaved(false);
  }, []);

  useEffect(() => {
    return () => {
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [localUrl]);

  async function save() {
    if (!config || !loaded) return;
    setSaving(true);
    setError(null);
    try {
      let imageUrlToSave = config.imageUrl;
      if (file) {
        const form = new FormData();
        form.append("file", file);
        const uploaded = await fetch("/api/upload", { method: "POST", body: form });
        const payload = await uploaded.json();
        if (!uploaded.ok) throw new Error(payload.error ?? "The image could not be uploaded.");
        imageUrlToSave = payload.url as string;
      }
      if (!imageUrlToSave) throw new Error("Upload a PNG first.");

      const body = {
        id: savedId ?? undefined,
        config: { ...config, imageUrl: imageUrlToSave, imageWidth: loaded.width, imageHeight: loaded.height },
      };
      const response = await fetch("/api/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "The settings could not be saved.");

      setConfig((previous) => (previous ? { ...previous, imageUrl: imageUrlToSave } : previous));
      setFile(null);
      setSavedId(payload.id as string);
      setJustSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function enableMic(deviceId: string, label: string) {
    setMicRequested(true);
    await startMic(deviceId, label);
  }

  if (!config || !loaded) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-4 py-16">
          <h1 className="text-3xl font-black tracking-tight">Upload your PNG</h1>
          <p className="mt-2 text-slate-300">
            A transparent PNG works best — a character, a logo, your face cut out, anything.
          </p>
          <Dropzone onPick={onPickFile} inputRef={fileInputRef} busy={status === "loading"} />
          {status === "error" && (
            <p className="mt-3 text-sm text-maple">That image could not be opened. Try a different PNG.</p>
          )}
          {error && <p className="mt-3 text-sm text-maple">{error}</p>}
          <p className="mt-6 hint">
            Not sure what to do with it afterwards? <Link href="/how" className="underline">Read the two minute setup.</Link>
          </p>
        </main>
      </div>
    );
  }

  const liveUrl = savedId && typeof window !== "undefined" ? `${window.location.origin}/live/${savedId}` : "";

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Preview */}
        <section className="space-y-4">
          <div className="panel overflow-hidden">
            <AvatarCanvas
              image={loaded.image}
              bounds={loaded.bounds}
              config={config}
              openValueRef={openRef}
              interactive
              showTransparencyGrid={config.background === "transparent"}
              onSplitDrag={(splitY) => update({ splitY })}
              className="h-[46vh] min-h-[280px] w-full lg:h-[62vh]"
            />
          </div>

          <div className="panel space-y-3 p-4">
            <Field
              label="Simulate talking"
              value={simulate === 0 ? "off" : `${Math.round(simulate * 100)}%`}
              hint="Tune everything without saying a word. Drag it back to zero to use your real microphone."
            >
              <Slider ariaLabel="Simulate talking" min={0} max={1} step={0.01} value={simulate} onChange={setSimulate} />
            </Field>
            <button type="button" className="btn-secondary w-full" onClick={() => fileInputRef.current?.click()}>
              Replace image
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png"
              className="hidden"
              onChange={(event) => onPickFile(event.target.files?.[0] ?? null)}
            />
          </div>

          {justSaved && savedId && (
            <div ref={successRef}>
              <SuccessPanel id={savedId} liveUrl={liveUrl} config={config} bounds={loaded.bounds} />
            </div>
          )}
        </section>

        {/* Controls */}
        <section className="space-y-4">
          <div className="panel space-y-4 p-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-400">The mouth</h2>

            <Field label="Split position" value={`${Math.round(config.splitY * 100)}%`}>
              <Slider
                ariaLabel="Split position"
                min={2}
                max={98}
                value={Math.round(config.splitY * 100)}
                onChange={(value) => update({ splitY: value / 100 })}
              />
            </Field>

            <Field
              label="Split angle"
              value={`${config.splitAngle}°`}
              hint="A crooked mouth looks more alive. Snaps back to straight near zero."
            >
              <Slider
                ariaLabel="Split angle"
                min={LIMITS.splitAngle.min}
                max={LIMITS.splitAngle.max}
                value={config.splitAngle}
                onChange={(value) => update({ splitAngle: Math.abs(value) < ANGLE_SNAP ? 0 : value })}
              />
            </Field>

            <Field label="Hinge" hint="Which corner of the mouth stays put when it opens.">
              <Segmented<HingeSide>
                ariaLabel="Hinge side"
                value={config.hingeSide}
                onChange={(hingeSide) => update({ hingeSide })}
                options={[
                  { value: "left", label: "Left" },
                  { value: "center", label: "Centre" },
                  { value: "right", label: "Right" },
                ]}
              />
            </Field>

            <Field label="How wide it opens" value={`${config.maxOpenAngle}°`}>
              <Slider
                ariaLabel="Maximum open angle"
                min={LIMITS.maxOpenAngle.min}
                max={LIMITS.maxOpenAngle.max}
                value={config.maxOpenAngle}
                onChange={(maxOpenAngle) => update({ maxOpenAngle })}
              />
            </Field>
          </div>

          <div className="panel space-y-4 p-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-400">Your voice</h2>

            <Field
              label="Microphone"
              hint="Pick the microphone you actually stream on. This app listens to that one input and nothing else — never your game or your music."
            >
              <select
                className="text-input"
                value={config.deviceId}
                onChange={(event) => {
                  const deviceId = event.target.value;
                  const label = devices.find((device) => device.deviceId === deviceId)?.label ?? "";
                  update({ deviceId, deviceLabel: label });
                  if (micRequested) void enableMic(deviceId, label);
                }}
              >
                <option value="">System default (not recommended)</option>
                {devices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))}
              </select>
            </Field>

            {micState.status !== "running" ? (
              <button
                type="button"
                className="btn-secondary w-full"
                onClick={() => void enableMic(config.deviceId, config.deviceLabel)}
              >
                {micState.status === "starting" ? "Asking for access…" : "Test my microphone"}
              </button>
            ) : (
              <p className="hint">Listening to {micState.activeLabel}. Speak at your normal stream volume.</p>
            )}
            {micState.message && <p className="text-sm text-maple">{micState.message}</p>}
            {devices.length === 0 && (
              <p className="hint">No microphones listed yet — press “Test my microphone” and allow access to see their names.</p>
            )}

            <Field label="Mic threshold" value={config.threshold.toFixed(3)}>
              <Slider
                ariaLabel="Microphone threshold"
                min={LIMITS.threshold.min}
                max={LIMITS.threshold.max}
                step={0.002}
                value={config.threshold}
                onChange={(threshold) => update({ threshold })}
              />
            </Field>
            <LevelMeter levelRef={levelRef} openRef={openRef} threshold={config.threshold} />

            <div className="grid grid-cols-2 gap-3">
              <Field label="Attack" value={`${config.attackMs} ms`}>
                <Slider
                  ariaLabel="Attack"
                  min={LIMITS.attackMs.min}
                  max={LIMITS.attackMs.max}
                  step={5}
                  value={config.attackMs}
                  onChange={(attackMs) => update({ attackMs })}
                />
              </Field>
              <Field label="Release" value={`${config.releaseMs} ms`}>
                <Slider
                  ariaLabel="Release"
                  min={LIMITS.releaseMs.min}
                  max={LIMITS.releaseMs.max}
                  step={5}
                  value={config.releaseMs}
                  onChange={(releaseMs) => update({ releaseMs })}
                />
              </Field>
            </div>
          </div>

          <div className="panel space-y-4 p-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-400">Movement</h2>

            <Field label="Motion" hint="Snapping between fixed positions is the look. Smooth is for a softer, more puppet-like feel.">
              <Segmented<MotionMode>
                ariaLabel="Motion mode"
                value={config.motionMode}
                onChange={(motionMode) => update({ motionMode })}
                options={[
                  { value: "snap", label: "Snap" },
                  { value: "smooth", label: "Smooth" },
                ]}
              />
            </Field>

            {config.motionMode === "snap" && (
              <Field
                label="Mouth positions"
                value={config.snapSteps}
                hint={
                  config.snapSteps === 2
                    ? "Two positions: open and shut. The classic."
                    : `${config.snapSteps} positions between shut and wide open.`
                }
              >
                <Slider
                  ariaLabel="Mouth positions"
                  min={LIMITS.snapSteps.min}
                  max={LIMITS.snapSteps.max}
                  value={config.snapSteps}
                  onChange={(snapSteps) => update({ snapSteps })}
                />
              </Field>
            )}

            <Field
              label="Activity"
              value={activityLabel(config.activity)}
              hint="How eager the mouth is. Low only moves for real speech; high is click-clacky and reacts to every syllable."
            >
              <Slider
                ariaLabel="Activity"
                min={LIMITS.activity.min}
                max={LIMITS.activity.max}
                value={config.activity}
                onChange={(activity) => update({ activity })}
              />
            </Field>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Idle sway</span>
              <Toggle checked={config.idleSway} onChange={(idleSway) => update({ idleSway })} label="Idle sway" />
            </div>
            {config.idleSway && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount" value={`${config.swayAmount.toFixed(1)}°`}>
                  <Slider
                    ariaLabel="Sway amount"
                    min={LIMITS.swayAmount.min}
                    max={LIMITS.swayAmount.max}
                    step={0.1}
                    value={config.swayAmount}
                    onChange={(swayAmount) => update({ swayAmount })}
                  />
                </Field>
                <Field label="Speed" value={`${config.swaySpeed.toFixed(2)} Hz`}>
                  <Slider
                    ariaLabel="Sway speed"
                    min={LIMITS.swaySpeed.min}
                    max={LIMITS.swaySpeed.max}
                    step={0.01}
                    value={config.swaySpeed}
                    onChange={(swaySpeed) => update({ swaySpeed })}
                  />
                </Field>
              </div>
            )}
          </div>

          <div className="panel space-y-4 p-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-400">Look</h2>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Mouth interior</span>
              <div className="flex items-center gap-3">
                {config.mouthInterior && (
                  <input
                    type="color"
                    aria-label="Mouth interior colour"
                    value={config.mouthColor}
                    onChange={(event) => update({ mouthColor: event.target.value })}
                  />
                )}
                <Toggle
                  checked={config.mouthInterior}
                  onChange={(mouthInterior) => update({ mouthInterior })}
                  label="Mouth interior"
                />
              </div>
            </div>

            <Field label="Background" hint="Transparent is right for OBS. Green is only for software that cannot do transparency.">
              <Segmented<BackgroundMode>
                ariaLabel="Background"
                value={config.background}
                onChange={(background) =>
                  update({
                    background,
                    backgroundColor: background === "green" ? GREEN_SCREEN : config.backgroundColor,
                  })
                }
                options={[
                  { value: "transparent", label: "None" },
                  { value: "green", label: "Green" },
                  { value: "custom", label: "Custom" },
                ]}
              />
            </Field>
            {config.background === "custom" && (
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  aria-label="Background colour"
                  value={config.backgroundColor}
                  onChange={(event) => update({ backgroundColor: event.target.value })}
                />
                <input
                  className="text-input"
                  aria-label="Background hex"
                  value={config.backgroundColor}
                  onChange={(event) => update({ backgroundColor: event.target.value })}
                />
              </div>
            )}
          </div>

          <div className="panel space-y-3 p-4">
            {error && <p className="text-sm text-maple">{error}</p>}
            <button type="button" className="btn-primary w-full !py-3 text-base" onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : savedId ? "Save changes" : "Save and get my OBS link"}
            </button>
            {savedId && !justSaved && (
              <p className="hint">
                Your link:{" "}
                <Link href={`/live/${savedId}`} className="underline">
                  /live/{savedId}
                </Link>
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function activityLabel(activity: number): string {
  if (activity < 20) return "Calm";
  if (activity < 45) return "Relaxed";
  if (activity < 65) return "Chatty";
  if (activity < 85) return "Click-clacky";
  return "Unhinged";
}

function Dropzone({
  onPick,
  inputRef,
  busy,
}: {
  onPick: (file: File | null) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  busy: boolean;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        onPick(event.dataTransfer.files?.[0] ?? null);
      }}
      className={`mt-6 rounded-2xl border-2 border-dashed p-10 text-center transition ${
        over ? "border-maple bg-maple/10" : "border-edge bg-panel"
      }`}
    >
      <p className="text-lg font-semibold">{busy ? "Opening your image…" : "Drop a PNG here"}</p>
      <p className="mt-1 hint">or</p>
      <button type="button" className="btn-primary mt-3" onClick={() => inputRef.current?.click()}>
        Choose a PNG
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png"
        className="hidden"
        onChange={(event) => onPick(event.target.files?.[0] ?? null)}
      />
    </div>
  );
}
