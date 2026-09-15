"use client";

import Link from "next/link";
import { CopyButton, Window } from "./ui";
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
    <Window title="Saved">
      <div className="guide">
        Copy this link now. There are no accounts here, so it is the only way back in.
      </div>

      <div className="row-stack">
        <label className="row-label" htmlFor="live-url">
          Your link
        </label>
        <div className="flex gap-2">
          <input
            id="live-url"
            readOnly
            value={liveUrl}
            className="text-input literal"
            onFocus={(event) => event.target.select()}
          />
          <CopyButton text={liveUrl} label="Copy" />
        </div>
      </div>

      <div className="row-stack">
        <span className="row-label">Size for OBS</span>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="obs-width">
              Width
            </label>
            <input
              id="obs-width"
              readOnly
              value={obs.width}
              className="text-input literal"
              onFocus={(event) => event.target.select()}
            />
            <CopyButton text={String(obs.width)} />
          </div>
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="obs-height">
              Height
            </label>
            <input
              id="obs-height"
              readOnly
              value={obs.height}
              className="text-input literal"
              onFocus={(event) => event.target.select()}
            />
            <CopyButton text={String(obs.height)} />
          </div>
        </div>
        <p className="hint">
          Width {obs.width}, height {obs.height}. Type these into OBS exactly.
        </p>
      </div>

      <div className="row-stack">
        <span className="row-label">Now, in OBS</span>
        <ObsSteps />
      </div>

      <p className="border-b border-hair bg-blush px-4 py-3 text-[14px] leading-snug">
        The background is already see-through in OBS. You do not need a green screen, and you do not need to key
        anything out.
      </p>

      <p className="px-4 py-3 hint">
        Want to change it later?{" "}
        <Link href={`/edit/${id}`} className="font-semibold text-ink underline">
          Open the editor for this avatar
        </Link>
        . Bookmark that page — there is no login, so a lost link cannot be recovered.
      </p>
    </Window>
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
    <ol className="space-y-2.5">
      {steps.map((step, index) => (
        <li key={step} className="flex gap-3 text-[14px] leading-snug">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] border-ink bg-paper font-display text-[10px]">
            {index + 1}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}
