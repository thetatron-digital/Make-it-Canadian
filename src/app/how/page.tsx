import type { Metadata } from "next";
import Link from "next/link";
import { ObsSteps } from "@/components/SuccessPanel";
import { SiteHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Setup help — Make It Canadian",
  description: "How to put your talking avatar into OBS, and what to do when it misbehaves.",
};

const TROUBLESHOOTING = [
  {
    problem: "The mouth never opens",
    fix: "Either the wrong microphone is selected in the editor, or the threshold is too high. Open your editor link, press “Test my microphone”, and speak: if the green bar does not move, pick a different microphone from the list. If it does move but stays left of the red line, drag the threshold down.",
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
      <main className="mx-auto max-w-2xl space-y-10 px-4 py-12">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Getting it into OBS</h1>
          <p className="mt-2 text-slate-300">
            Start to finish this takes about two minutes, and you do not need to understand any of it.
          </p>
        </div>

        <section className="panel space-y-4 p-5">
          <h2 className="text-lg font-bold">Before you start</h2>
          <ol className="space-y-2 text-sm text-slate-200">
            <li>
              1. <Link href="/edit" className="underline">Upload a PNG</Link>. A see-through background works best.
            </li>
            <li>2. Drag the line to where the mouth should split, and choose your microphone.</li>
            <li>3. Press save. The app gives you a link and two numbers.</li>
          </ol>
        </section>

        <section className="panel space-y-4 p-5">
          <h2 className="text-lg font-bold">Then, in OBS</h2>
          <ObsSteps />
          <p className="rounded-lg bg-ink/60 p-3 text-sm text-emerald-300">
            The background is already transparent in OBS. You do not need a green screen, and you do not need to key
            anything out.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold">When it misbehaves</h2>
          <dl className="space-y-4">
            {TROUBLESHOOTING.map((item) => (
              <div key={item.problem} className="panel p-4">
                <dt className="font-semibold text-snow">{item.problem}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-slate-300">{item.fix}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="panel space-y-3 p-5">
          <h2 className="text-lg font-bold">Keep your link safe</h2>
          <p className="text-sm text-slate-300">
            There is no login here. Your editor link — the one that looks like <span className="font-mono">/edit/abcd1234</span> —
            is the only way back to your settings. Bookmark it, or paste it somewhere you will find it again.
          </p>
        </section>
      </main>
    </div>
  );
}
