"use client";

import { useEffect, useState } from "react";
import { alphaBounds } from "./alpha";
import type { Box } from "./geometry";

export interface LoadedImage {
  image: HTMLImageElement;
  bounds: Box;
  width: number;
  height: number;
}

export type ImageStatus = "idle" | "loading" | "ready" | "error";

/** Loads the PNG and measures where its visible pixels actually are. */
export function useAvatarImage(url: string | null): { loaded: LoadedImage | null; status: ImageStatus } {
  const [loaded, setLoaded] = useState<LoadedImage | null>(null);
  const [status, setStatus] = useState<ImageStatus>("idle");

  useEffect(() => {
    if (!url) {
      setLoaded(null);
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("loading");

    const image = new Image();
    // Required so the alpha bounding box can read the pixels back.
    if (!url.startsWith("blob:") && !url.startsWith("data:")) image.crossOrigin = "anonymous";
    image.onload = () => {
      if (cancelled) return;
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      setLoaded({ image, width, height, bounds: alphaBounds(image, width, height) });
      setStatus("ready");
    };
    image.onerror = () => {
      if (cancelled) return;
      setLoaded(null);
      setStatus("error");
    };
    image.src = url;

    return () => {
      cancelled = true;
    };
  }, [url]);

  return { loaded, status };
}
