import Link from "next/link";
import { SiteHeader, Window } from "@/components/ui";
import { ExampleAvatar } from "@/components/ExampleAvatar";

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-14 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <h1 className="text-[40px] font-black leading-[1.05] tracking-tight sm:text-5xl">
              Turn any PNG into a flapping Canadian.
            </h1>
            <p className="mt-4 text-[17px] leading-relaxed text-quiet">
              Upload a picture, pick where the mouth splits, and paste one link into OBS. It talks when you talk.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Link href="/edit" className="btn-primary !px-6 !py-3 !text-[15px]">
                Upload a PNG
              </Link>
              <Link href="/how" className="text-[14px] font-semibold underline underline-offset-2">
                How do I put it in OBS?
              </Link>
            </div>
            <p className="mt-6 hint">
              No account, no download, no green screen. Works with the microphone you already stream on.
            </p>
          </div>

          <Window title="Example">
            <div className="p-4">
              <ExampleAvatar />
            </div>
          </Window>
        </div>

        {/* The whole job, before anyone has to click anything. */}
        <ol className="mt-14 grid gap-4 sm:grid-cols-3">
          {[
            { title: "Upload a PNG", body: "Any picture. A see-through background works best." },
            { title: "Drag the line", body: "Put it where the mouth should open, then pick how lively it is." },
            { title: "Paste into OBS", body: "One link, two numbers, and you are live. No green screen." },
          ].map((step, index) => (
            <li key={step.title}>
              <Window title={`Step ${index + 1}`} className="h-full">
                <div className="p-4">
                  <p className="text-[16px] font-bold">{step.title}</p>
                  <p className="mt-1 hint">{step.body}</p>
                </div>
              </Window>
            </li>
          ))}
        </ol>

        <p className="mt-8 text-center hint">
          Takes about two minutes.{" "}
          <Link href="/how" className="font-semibold text-ink underline">
            The full walkthrough is here
          </Link>{" "}
          if you would rather read it first.
        </p>
      </main>
    </div>
  );
}
