"use client";

import Link from "next/link";
import { CopyButton } from "./ui";
import type { Box } from "@/lib/geometry";
import { renderSize } from "@/lib/geometry";
import { obsDimensions } from "@/lib/render";
import type { AvatarConfig } from "@/lib/types";

/**
 * Everything a streamer needs after saving, in the order they need it. This
 * is the part of the app that decides whether a non-technical user gets to
 * a working OBS source, so it spells out every step.
 */
export function SuccessPanel({
  id,
  liveUrl,
  config,
  bounds,
}: {
  id: string;
  liveUrl: string;
  config: AvatarConfig;
  bounds: Box;
}) {
  const size = renderSize(config, bounds);
  const obs = obsDimensions(size.width, size.height);

  return (
    <div className="panel space-y-5 border-emerald-500/40 bg-emerald-500/5 p-5">
      <div>
        <h2 className="text-xl font-black tracking-tight">Saved. Here is your OBS link.</h2>
        <p className="mt-1 hint">Copy it now — there are no accounts here, so this link is the only way back in.</p>
      </div>

      <div className="space-y-2">
        <label className="field-label" htmlFor="live-url">
          <span>Your link</span>
        </label>
        <div className="flex gap-2">
          <input id="live-url" readOnly value={liveUrl} className="text-input font-mono text-xs" onFocus={(e) => e.target.select()} />
          <CopyButton text={liveUrl} label="Copy link" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="field-label" htmlFor="obs-width">
            <span>Width</span>
          </label>
          <div className="flex gap-2">
            <input id="obs-width" readOnly value={obs.width} className="text-input" onFocus={(e) => e.target.select()} />
            <CopyButton text={String(obs.width)} />
          </div>
        </div>
        <div className="space-y-2">
          <label className="field-label" htmlFor="obs-height">
            <span>Height</span>
          </label>
          <div className="flex gap-2">
            <input id="obs-height" readOnly value={obs.height} className="text-input" onFocus={(e) => e.target.select()} />
            <CopyButton text={String(obs.height)} />
          </div>
        </div>
      </div>

      <ObsSteps />

      <p className="rounded-lg bg-ink/60 p-3 text-sm text-emerald-300">
        The background is already transparent in OBS. You do not need a green screen, and you do not need to key
        anything out.
      </p>

      <p className="hint">
        Want to change it later?{" "}
        <Link href={`/edit/${id}`} className="underline">
          Open the editor for this avatar
        </Link>
        . Bookmark that page — there is no login, so a lost link cannot be recovered.
      </p>
    </div>
  );
}

export function ObsSteps() {
  const steps = [
    "In OBS, click the + under Sources and choose Browser.",
    "Paste your link into the URL box.",
    "Type the width and height above into the Width and Height boxes.",
    "If you are asked to allow the microphone, click Allow. Leave every other setting alone.",
  ];
  return (
    <ol className="space-y-2">
      {steps.map((step, index) => (
        <li key={step} className="flex gap-3 text-sm text-slate-200">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-maple text-xs font-bold text-white">
            {index + 1}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}
