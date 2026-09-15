"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AvatarCanvas } from "./AvatarCanvas";
import { LevelMeter } from "./LevelMeter";
import { SuccessPanel } from "./SuccessPanel";
import { Field, FineTune, Row, Segmented, SiteHeader, Slider, Step, Toggle, Window } from "./ui";
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

const STEP_COUNT = 4;

/**
 * One-tap answers to "how lively should it be", so nobody has to understand
 * attack, release or quantisation to get a good result.
 */
const PRESETS: { id: string; label: string; blurb: string; values: Partial<AvatarConfig> }[] = [
  {
    id: "calm",
    label: "Calm",
    blurb: "Opens for speech, ignores the rest.",
    values: { motionMode: "snap", snapSteps: 2, activity: 25, attackMs: 70, releaseMs: 200 },
  },
  {
    id: "chatty",
    label: "Chatty",
    blurb: "The classic flap. A good place to start.",
    values: { motionMode: "snap", snapSteps: 2, activity: 50, attackMs: 40, releaseMs: 120 },
  },
  {
    id: "clack",
    label: "Click-clack",
    blurb: "Jumps on every syllable.",
    values: { motionMode: "snap", snapSteps: 4, activity: 85, attackMs: 15, releaseMs: 70 },
  },
];

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
  // Someone reopening a saved avatar has already been through the steps, so
  // start them collapsed instead of walking them through it again.
  const [openStep, setOpenStep] = useState<number | null>(initialConfig ? null : 1);
  const [doneSteps, setDoneSteps] = useState<Set<number>>(
    () => new Set(initialConfig ? [1, 2, 3, 4] : []),
  );
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

  const driver = useMouthDriver(
    config ?? ({ ...DEFAULT_CONFIG, imageUrl: "", imageWidth: 1, imageHeight: 1 } as AvatarConfig),
    simulate,
  );
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

  // The save button lives at the end of the steps; the link it produces must
  // not be left off-screen.
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

  /** Mark a step finished and move on to the next unfinished one. */
  const finishStep = useCallback((step: number) => {
    setDoneSteps((previous) => new Set(previous).add(step));
    setOpenStep(step < STEP_COUNT ? step + 1 : null);
  }, []);

  const toggleStep = useCallback((step: number) => {
    setOpenStep((previous) => (previous === step ? null : step));
  }, []);

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
      setOpenStep(null);
      setDoneSteps(new Set([1, 2, 3, 4]));
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
        <main className="mx-auto max-w-xl px-4 py-12">
          <Window title="Step 1 of 5">
            <div className="guide">Pick a PNG. One with a see-through background works best.</div>
            <Dropzone onPick={onPickFile} inputRef={fileInputRef} busy={status === "loading"} />
            {status === "error" && (
              <p className="border-t border-hair px-4 py-3 text-[14px] text-maple">
                That image could not be opened. Try a different PNG.
              </p>
            )}
            {error && <p className="border-t border-hair px-4 py-3 text-[14px] text-maple">{error}</p>}
          </Window>
          <p className="mt-5 text-center hint">
            Never done this before?{" "}
            <Link href="/how" className="font-semibold text-ink underline">
              Read the two minute setup.
            </Link>
          </p>
        </main>
      </div>
    );
  }

  const liveUrl = savedId && typeof window !== "undefined" ? `${window.location.origin}/live/${savedId}` : "";
  const activePreset = PRESETS.find((preset) =>
    Object.entries(preset.values).every(([key, value]) => config[key as keyof AvatarConfig] === value),
  );

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto grid max-w-6xl gap-5 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        {/* Preview */}
        <div className="space-y-5 lg:sticky lg:top-14">
          <Window title="Preview">
            <AvatarCanvas
              image={loaded.image}
              bounds={loaded.bounds}
              config={config}
              openValueRef={openRef}
              interactive={openStep === 1}
              showTransparencyGrid={config.background === "transparent"}
              onSplitDrag={(splitY) => update({ splitY })}
              className="h-[42vh] min-h-[260px] w-full bg-paper lg:h-[54vh]"
            />
            <div className="row-stack border-t border-hair">
              <div className="flex items-baseline justify-between gap-3">
                <span className="row-label">Test it without talking</span>
                <span className="row-value">{simulate === 0 ? "off" : `${Math.round(simulate * 100)}%`}</span>
              </div>
              <Slider ariaLabel="Simulate talking" min={0} max={1} step={0.01} value={simulate} onChange={setSimulate} />
              <p className="hint">Drag right to fake a voice. Drag back to zero to use your real microphone.</p>
            </div>
          </Window>

          {justSaved && savedId && (
            <div ref={successRef}>
              <SuccessPanel id={savedId} liveUrl={liveUrl} config={config} bounds={loaded.bounds} />
            </div>
          )}
        </div>

        {/* Steps */}
        <div className="space-y-4">
          <Progress done={doneSteps} openStep={openStep} onPick={toggleStep} />

          <Step
            number={1}
            title="Place the mouth"
            guide="Drag the dotted line on the picture to where the mouth should open."
            open={openStep === 1}
            done={doneSteps.has(1)}
            onToggle={() => toggleStep(1)}
          >
            <Field label="Height on the picture" value={`${Math.round(config.splitY * 100)}%`}>
              <Slider
                ariaLabel="Split position"
                min={2}
                max={98}
                value={Math.round(config.splitY * 100)}
                onChange={(value) => update({ splitY: value / 100 })}
              />
            </Field>
            <Field label="Tilt" value={`${config.splitAngle}°`} hint="A crooked mouth looks more alive.">
              <Slider
                ariaLabel="Split angle"
                min={LIMITS.splitAngle.min}
                max={LIMITS.splitAngle.max}
                value={config.splitAngle}
                onChange={(value) => update({ splitAngle: Math.abs(value) < ANGLE_SNAP ? 0 : value })}
              />
            </Field>
            <Row label="Hinge" hint="The corner that stays put.">
              <Segmented<HingeSide>
                ariaLabel="Hinge side"
                value={config.hingeSide}
                onChange={(hingeSide) => update({ hingeSide })}
                options={[
                  { value: "left", label: "Left" },
                  { value: "center", label: "Middle" },
                  { value: "right", label: "Right" },
                ]}
              />
            </Row>
            <FineTune>
              <Field label="How wide it opens" value={`${config.maxOpenAngle}°`}>
                <Slider
                  ariaLabel="Maximum open angle"
                  min={LIMITS.maxOpenAngle.min}
                  max={LIMITS.maxOpenAngle.max}
                  value={config.maxOpenAngle}
                  onChange={(maxOpenAngle) => update({ maxOpenAngle })}
                />
              </Field>
            </FineTune>
            <NextButton label="Looks right" onClick={() => finishStep(1)} />
          </Step>

          <Step
            number={2}
            title="Pick your microphone"
            guide="Choose the microphone you stream on, then talk and watch the green bar move."
            open={openStep === 2}
            done={doneSteps.has(2)}
            onToggle={() => toggleStep(2)}
          >
            <div className="row-stack">
              <select
                className="select-input"
                aria-label="Microphone"
                value={config.deviceId}
                onChange={(event) => {
                  const deviceId = event.target.value;
                  const label = devices.find((device) => device.deviceId === deviceId)?.label ?? "";
                  update({ deviceId, deviceLabel: label });
                  if (micRequested) void enableMic(deviceId, label);
                }}
              >
                <option value="">Whatever the computer picks (not recommended)</option>
                {devices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))}
              </select>
              <p className="hint">
                Your avatar listens to this one microphone and nothing else — never your game, your music or your chat.
              </p>
            </div>

            <div className="row-stack">
              {micState.status !== "running" ? (
                <button
                  type="button"
                  className="btn-secondary w-full"
                  onClick={() => void enableMic(config.deviceId, config.deviceLabel)}
                >
                  {micState.status === "starting" ? "Asking for access…" : "Turn on my microphone"}
                </button>
              ) : (
                <p className="text-[14px] font-medium text-mint">Listening to {micState.activeLabel}.</p>
              )}
              {micState.message && <p className="text-[14px] text-maple">{micState.message}</p>}
              {devices.length === 0 && (
                <p className="hint">Press the button above and allow access to see your microphones by name.</p>
              )}
              <LevelMeter levelRef={levelRef} openRef={openRef} threshold={config.threshold} />
            </div>

            <Field
              label="Ignore quiet noise below"
              value={config.threshold.toFixed(3)}
              hint="Raise it until the mouth shuts between sentences. Lower it if quiet talking does nothing."
            >
              <Slider
                ariaLabel="Microphone threshold"
                min={LIMITS.threshold.min}
                max={LIMITS.threshold.max}
                step={0.002}
                value={config.threshold}
                onChange={(threshold) => update({ threshold })}
              />
            </Field>

            <FineTune>
              <Field label="Attack" value={`${config.attackMs} ms`} hint="How fast it opens.">
                <Slider
                  ariaLabel="Attack"
                  min={LIMITS.attackMs.min}
                  max={LIMITS.attackMs.max}
                  step={5}
                  value={config.attackMs}
                  onChange={(attackMs) => update({ attackMs })}
                />
              </Field>
              <Field label="Release" value={`${config.releaseMs} ms`} hint="How fast it closes again.">
                <Slider
                  ariaLabel="Release"
                  min={LIMITS.releaseMs.min}
                  max={LIMITS.releaseMs.max}
                  step={5}
                  value={config.releaseMs}
                  onChange={(releaseMs) => update({ releaseMs })}
                />
              </Field>
            </FineTune>
            <NextButton label="Sounds right" onClick={() => finishStep(2)} />
          </Step>

          <Step
            number={3}
            title="Choose how lively it is"
            guide="Pick one and watch the preview. You can change it any time."
            open={openStep === 3}
            done={doneSteps.has(3)}
            onToggle={() => toggleStep(3)}
          >
            <div className="row-stack">
              <div className="grid gap-2">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      update(preset.values);
                      if (simulate === 0) setSimulate(0.85);
                    }}
                    aria-pressed={activePreset?.id === preset.id}
                    className={`flex items-center justify-between gap-3 rounded-lg border-[1.5px] px-3.5 py-3 text-left transition ${
                      activePreset?.id === preset.id
                        ? "border-ink bg-blush shadow-key"
                        : "border-hair bg-paper hover:border-ink"
                    }`}
                  >
                    <span>
                      <span className="block text-[15px] font-semibold">{preset.label}</span>
                      <span className="block hint">{preset.blurb}</span>
                    </span>
                    <span aria-hidden className="w-4 shrink-0 text-center text-[14px] font-bold text-maple">
                      {activePreset?.id === preset.id ? "✓" : ""}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <FineTune>
              <Row label="Movement" hint="Snapping is the cartoon look.">
                <Segmented<MotionMode>
                  ariaLabel="Motion mode"
                  value={config.motionMode}
                  onChange={(motionMode) => update({ motionMode })}
                  options={[
                    { value: "snap", label: "Snap" },
                    { value: "smooth", label: "Smooth" },
                  ]}
                />
              </Row>
              {config.motionMode === "snap" && (
                <Field
                  label="How many mouth positions"
                  value={config.snapSteps}
                  hint={
                    config.snapSteps === 2
                      ? "Two: open and shut. The classic."
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
                label="How eager it is"
                value={activityLabel(config.activity)}
                hint="Low only moves for real speech. High reacts to every syllable."
              >
                <Slider
                  ariaLabel="Activity"
                  min={LIMITS.activity.min}
                  max={LIMITS.activity.max}
                  value={config.activity}
                  onChange={(activity) => update({ activity })}
                />
              </Field>
              <Row label="Gentle sway">
                <Toggle checked={config.idleSway} onChange={(idleSway) => update({ idleSway })} label="Idle sway" />
              </Row>
              {config.idleSway && (
                <>
                  <Field label="Sway amount" value={`${config.swayAmount.toFixed(1)}°`}>
                    <Slider
                      ariaLabel="Sway amount"
                      min={LIMITS.swayAmount.min}
                      max={LIMITS.swayAmount.max}
                      step={0.1}
                      value={config.swayAmount}
                      onChange={(swayAmount) => update({ swayAmount })}
                    />
                  </Field>
                  <Field label="Sway speed" value={`${config.swaySpeed.toFixed(2)} Hz`}>
                    <Slider
                      ariaLabel="Sway speed"
                      min={LIMITS.swaySpeed.min}
                      max={LIMITS.swaySpeed.max}
                      step={0.01}
                      value={config.swaySpeed}
                      onChange={(swaySpeed) => update({ swaySpeed })}
                    />
                  </Field>
                </>
              )}
            </FineTune>
            <NextButton label="That's the one" onClick={() => finishStep(3)} />
          </Step>

          <Step
            number={4}
            title="Tidy up the look"
            guide="Almost done. Most people leave these exactly as they are."
            open={openStep === 4}
            done={doneSteps.has(4)}
            onToggle={() => toggleStep(4)}
          >
            <Row label="Dark inside the mouth" hint="Fills the gap when it opens.">
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
            </Row>
            <Row label="Background" hint="Leave it on None for OBS.">
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
                  { value: "custom", label: "Colour" },
                ]}
              />
            </Row>
            {config.background === "custom" && (
              <div className="row">
                <span className="row-label">Pick a colour</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Background colour"
                    value={config.backgroundColor}
                    onChange={(event) => update({ backgroundColor: event.target.value })}
                  />
                  <input
                    className="text-input literal w-28"
                    aria-label="Background hex"
                    value={config.backgroundColor}
                    onChange={(event) => update({ backgroundColor: event.target.value })}
                  />
                </div>
              </div>
            )}
            <div className="row">
              <span className="row-label">Use a different picture</span>
              <button type="button" className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
                Replace
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png"
              className="hidden"
              onChange={(event) => onPickFile(event.target.files?.[0] ?? null)}
            />
            <NextButton label="All set" onClick={() => finishStep(4)} />
          </Step>

          <Window title="5. Get your link">
            <div className="space-y-3 p-4">
              {error && <p className="text-[14px] text-maple">{error}</p>}
              <button type="button" className="btn-primary w-full !py-3" onClick={() => void save()} disabled={saving}>
                {saving ? "Saving…" : savedId ? "Save changes" : "Save and get my OBS link"}
              </button>
              {savedId && !justSaved && (
                <p className="hint">
                  Your link:{" "}
                  <Link href={`/live/${savedId}`} className="font-semibold text-ink underline">
                    /live/{savedId}
                  </Link>
                </p>
              )}
            </div>
          </Window>
        </div>
      </main>
    </div>
  );
}

/** Four dots at the top, so people can see how much is left. */
function Progress({
  done,
  openStep,
  onPick,
}: {
  done: Set<number>;
  openStep: number | null;
  onPick: (step: number) => void;
}) {
  const titles = ["Mouth", "Microphone", "Liveliness", "Look"];
  return (
    <ol className="flex items-center gap-1.5">
      {titles.map((title, index) => {
        const step = index + 1;
        const isDone = done.has(step);
        const isOpen = openStep === step;
        return (
          <li key={title} className="flex-1">
            <button
              type="button"
              onClick={() => onPick(step)}
              className={`w-full rounded-lg border-[1.5px] px-1 py-1.5 text-center transition ${
                isOpen
                  ? "border-ink bg-ink text-paper"
                  : isDone
                    ? "border-ink bg-paper text-ink"
                    : "border-hair bg-paper text-quiet hover:border-ink"
              }`}
            >
              <span className="block font-display text-[10px] leading-none">{isDone && !isOpen ? "✓" : step}</span>
              <span className="mt-1 block text-[11px] font-semibold leading-none">{title}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function NextButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="border-t border-hair p-3">
      <button type="button" className="btn-primary w-full" onClick={onClick}>
        {label} →
      </button>
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
      className={`m-4 rounded-xl border-[1.5px] border-dashed p-8 text-center transition ${
        over ? "border-maple bg-blush" : "border-ink bg-desk/40"
      }`}
    >
      <p className="text-[15px] font-semibold">{busy ? "Opening your image…" : "Drop a PNG here"}</p>
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
