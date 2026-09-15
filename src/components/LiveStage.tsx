"use client";

import { useEffect, useState } from "react";
import { AvatarCanvas } from "./AvatarCanvas";
import { useAvatarImage } from "@/lib/useAvatarImage";
import { useMouthDriver } from "@/lib/useMouthDriver";
import { resolveDevice } from "@/lib/audio";
import { normalizeConfig, type AvatarConfig } from "@/lib/types";

type LoadState = "loading" | "ready" | "missing" | "error";

/**
 * The OBS surface: no chrome, no scrollbars, transparent by default. The
 * only thing it ever puts on screen is an error message, because a silent
 * frozen avatar is the worst possible failure mode mid-stream.
 */
export function LiveStage({ id }: { id: string }) {
  const [config, setConfig] = useState<AvatarConfig | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const { loaded } = useAvatarImage(config?.imageUrl ?? null);
  const driver = useMouthDriver(config ?? placeholder, 0);
  const { openRef, micState, startMic, refreshDevices } = driver;

  useEffect(() => {
    document.body.classList.add("live-surface");
    return () => document.body.classList.remove("live-surface");
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/config/${id}`, { cache: "no-store" });
        if (cancelled) return;
        if (response.status === 404) {
          setState("missing");
          return;
        }
        if (!response.ok) {
          setState("error");
          return;
        }
        const payload = await response.json();
        const parsed = normalizeConfig(payload.config);
        if (!parsed) {
          setState("error");
          return;
        }
        setConfig(parsed);
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Start listening as soon as the config arrives, on the saved device.
  useEffect(() => {
    if (!config) return;
    let cancelled = false;
    (async () => {
      const devices = await refreshDevices();
      if (cancelled) return;
      const match = resolveDevice(devices, config.deviceId, config.deviceLabel);
      await startMic(match?.deviceId ?? config.deviceId, match?.label ?? config.deviceLabel);
    })();
    return () => {
      cancelled = true;
    };
  }, [config, refreshDevices, startMic]);

  // A microphone can vanish at any time; watch for it coming back too.
  useEffect(() => {
    if (!config || typeof navigator === "undefined" || !navigator.mediaDevices) return;
    const onChange = async () => {
      const devices = await refreshDevices();
      const match = resolveDevice(devices, config.deviceId, config.deviceLabel);
      if (match && micState.status !== "running") await startMic(match.deviceId, match.label);
    };
    navigator.mediaDevices.addEventListener("devicechange", onChange);
    return () => navigator.mediaDevices.removeEventListener("devicechange", onChange);
  }, [config, micState.status, refreshDevices, startMic]);

  if (state === "missing") return <Notice title="This avatar does not exist" body="Check the link, or make a new one." />;
  if (state === "error") return <Notice title="This avatar could not be loaded" body="Refresh this source in OBS to try again." />;

  const micProblem =
    micState.status === "denied" || micState.status === "lost" || micState.status === "error" ? micState.message : null;

  return (
    <div className="fixed inset-0 overflow-hidden">
      {config && loaded && (
        <AvatarCanvas
          image={loaded.image}
          bounds={loaded.bounds}
          config={config}
          openValueRef={openRef}
          className="h-full w-full"
        />
      )}
      {micProblem && (
        <div className="absolute inset-x-0 bottom-0 bg-maple/95 px-4 py-3 text-center text-sm font-semibold text-white">
          {micProblem}
        </div>
      )}
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center p-6">
      <div className="max-w-sm rounded-xl bg-maple px-5 py-4 text-center text-white">
        <p className="text-lg font-black">{title}</p>
        <p className="mt-1 text-sm opacity-90">{body}</p>
      </div>
    </div>
  );
}

/** Keeps the hook order stable before the real config arrives. */
const placeholder = normalizeConfig({ imageUrl: "pending" })!;
