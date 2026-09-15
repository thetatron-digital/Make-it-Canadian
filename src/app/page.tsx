import Link from "next/link";
import { SiteHeader } from "@/components/ui";
import { ExampleAvatar } from "@/components/ExampleAvatar";

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl">
              Turn any PNG into a flapping Canadian.
            </h1>
            <p className="mt-4 text-lg text-slate-300">
              Upload a picture, pick where the mouth splits, and paste one link into OBS. It talks when you talk.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/edit" className="btn-primary !px-6 !py-3 text-base">
                Upload a PNG
              </Link>
              <Link href="/how" className="text-sm font-semibold text-slate-300 underline hover:text-snow">
                How do I put it in OBS?
              </Link>
            </div>
            <p className="mt-6 hint">
              No account, no download, no green screen. Works with the microphone you already stream on.
            </p>
          </div>

          <div className="panel p-6">
            <ExampleAvatar />
          </div>
        </div>
      </main>
    </div>
  );
}
