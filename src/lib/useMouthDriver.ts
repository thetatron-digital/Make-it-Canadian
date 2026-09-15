"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MicEngine, resolveDevice, type MicDevice, type MicState } from "./audio";
import { MouthMotion, simulatedLevel } from "./motion";
import type { AvatarConfig } from "./types";

export interface MouthDriver {
  /** 0-1 mouth opening, updated every frame. Read by the canvas, not by React. */
  openRef: React.MutableRefObject<number>;
  /** Raw microphone level, for the input meter. */
  levelRef: React.MutableRefObject<number>;
  micState: MicState;
  devices: MicDevice[];
  refreshDevices: () => Promise<MicDevice[]>;
  startMic: (deviceId: string, label?: string) => Promise<void>;
  stopMic: () => void;
}

/**
 * Runs the audio-to-mouth loop. Everything the animation needs lives in
 * refs, so a talking avatar never triggers a React render.
 */
export function useMouthDriver(config: AvatarConfig, simulate: number): MouthDriver {
  const openRef = useRef(0);
  const levelRef = useRef(0);
  const configRef = useRef(config);
  const simulateRef = useRef(simulate);
  const motionRef = useRef(new MouthMotion());
  const [micState, setMicState] = useState<MicState>({ status: "idle", message: "", activeLabel: "", activeDeviceId: "" });
  const [devices, setDevices] = useState<MicDevice[]>([]);

  configRef.current = config;
  simulateRef.current = simulate;

  const engine = useMemo(() => new MicEngine(setMicState), []);
  useEffect(() => () => engine.stop(), [engine]);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    let clock = 0;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dtMs = Math.min(now - last, 100);
      last = now;
      clock += dtMs / 1000;

      const simulated = simulateRef.current;
      const level = simulated > 0 ? simulatedLevel(clock, simulated) : engine.getState().status === "running" ? engine.level() : 0;
      levelRef.current = level;
      openRef.current = motionRef.current.update(level, dtMs, configRef.current);
    };

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else if (!frame) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };

    if (!document.hidden) frame = requestAnimationFrame(tick);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [engine]);

  const refreshDevices = useCallback(async () => {
    const list = await MicEngine.listDevices();
    setDevices(list);
    return list;
  }, []);

  const startMic = useCallback(
    async (deviceId: string, label = "") => {
      motionRef.current.reset();
      await engine.start(deviceId, label);
      // Labels only become readable after access is granted.
      await refreshDevices();
    },
    [engine, refreshDevices],
  );

  const stopMic = useCallback(() => {
    engine.stop();
    levelRef.current = 0;
  }, [engine]);

  return { openRef, levelRef, micState, devices, refreshDevices, startMic, stopMic };
}

export { resolveDevice };
