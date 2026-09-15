"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Editor } from "@/components/Editor";
import { SiteHeader } from "@/components/ui";
import { normalizeConfig, type AvatarConfig } from "@/lib/types";

export default function EditSavedPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";
  const [config, setConfig] = useState<AvatarConfig | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/config/${id}`, { cache: "no-store" });
        if (cancelled) return;
        if (!response.ok) {
          setState("missing");
          return;
        }
        const payload = await response.json();
        const parsed = normalizeConfig(payload.config);
        if (!parsed) {
          setState("missing");
          return;
        }
        setConfig(parsed);
        setState("ready");
      } catch {
        if (!cancelled) setState("missing");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state === "loading") {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <p className="mx-auto max-w-2xl px-4 py-16 text-slate-300">Loading your avatar…</p>
      </div>
    );
  }

  if (state === "missing" || !config) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-4 py-16">
          <h1 className="text-2xl font-black">That avatar could not be found</h1>
          <p className="mt-2 text-slate-300">
            The link may be mistyped. There are no accounts here, so a lost link cannot be recovered — but making a new
            one takes about a minute.
          </p>
          <Link href="/edit" className="btn-primary mt-6">
            Make a new one
          </Link>
        </main>
      </div>
    );
  }

  return <Editor initialId={id} initialConfig={config} />;
}
