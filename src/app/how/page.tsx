import type { Metadata } from "next";
import Link from "next/link";
import { ObsSteps } from "@/components/SuccessPanel";
import { SiteHeader, Window } from "@/components/ui";

export const metadata: Metadata = {
  title: "Setup help — Make It Canadian",
  description: "How to put your talking avatar into OBS, and what to do when it misbehaves.",
};

const TROUBLESHOOTING = [
  {
    problem: "The mouth never opens",
    fix: "Either the wrong microphone is selected in the editor, or the threshold is too high. Open your editor link, press “Turn on my microphone”, and speak: if the green bar does not move, pick a different microphone from the list. If it does move but stays left of the red line, drag the threshold down.",
  },
  {
    problem: "The mouth never closes",
    fix: "The threshold is too low, so room noise is holding it open. Open your editor link and raise the threshold while speaking at your normal stream volume, until the mouth shuts between sentences.",
  },
  {
    problem: "The mouth reacts to game audio or music",
    fix: "The wrong input is selected. This app only ever listens to the one input device you pick — it never hears your game, your music, your alerts or your voice chat, because it does not read anything from OBS. Choose your actual microphone in the editor and save.",
  },
  {
    problem: "There is a white or black box behind the avatar",
    fix: "Your source PNG is not transparent. Open it in any image editor, delete the background so it is see-through, save as a PNG, and upload it again.",
  },
  {
    problem: "Nothing appears at all",
    fix: "The Browser Source is probably too small. Set its Width and Height to the numbers the app gave you. If it is still blank, open the source's properties and click “Refresh cache of current page”.",
  },
  {
    problem: "It works in my browser but not inside OBS",
    fix: "OBS cannot show a permission pop-up, so some versions block the microphone in Browser Sources. Two ways round it: close OBS and start it once from a shortcut with --use-fake-ui-for-media-stream added to the end of the target, which grants it automatically; or open your live link in a normal browser window and add it to OBS as a Window Capture instead.",
  },
  {
    problem: "I lost my link",
    fix: "There are no accounts and no password, so a lost link cannot be recovered. Making a new avatar takes about a minute. Bookmark the editor link this time.",
  },
];

export default function HowPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-10">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Getting it into OBS</h1>
          <p className="mt-2 text-[16px] text-quiet">
            Start to finish this takes about two minutes, and you do not need to understand any of it.
          </p>
        </div>

        <Window title="First, here">
          <ol className="divide-y divide-hair">
            {[
              <>
                Upload a PNG on the{" "}
                <Link href="/edit" className="font-semibold underline">
                  make one
                </Link>{" "}
                page. A see-through background works best.
              </>,
              "Drag the line to where the mouth should split.",
              "Pick the microphone you stream on, and speak until the green bar moves.",
              "Choose how lively the mouth is, then press save.",
            ].map((step, index) => (
              <li key={index} className="flex gap-3 px-4 py-3 text-[14px] leading-snug">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] border-ink bg-paper font-display text-[10px]">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </Window>

        <Window title="Then, in OBS">
          <div className="p-4">
            <ObsSteps />
          </div>
          <p className="border-t border-hair bg-blush px-4 py-3 text-[14px] leading-snug">
            The background is already see-through in OBS. You do not need a green screen, and you do not need to key
            anything out.
          </p>
        </Window>

        <Window title="When it misbehaves">
          <dl className="divide-y divide-hair">
            {TROUBLESHOOTING.map((item) => (
              <div key={item.problem} className="px-4 py-3">
                <dt className="text-[15px] font-semibold">{item.problem}</dt>
                <dd className="mt-1 hint">{item.fix}</dd>
              </div>
            ))}
          </dl>
        </Window>

        <Window title="Keep your link safe">
          <p className="px-4 py-3 text-[14px] leading-snug">
            There is no login here. Your editor link — the one that looks like{" "}
            <span className="literal">/edit/abcd1234</span> — is the only way back to your settings.
            Bookmark it, or paste it somewhere you will find it again.
          </p>
        </Window>
      </main>
    </div>
  );
}
