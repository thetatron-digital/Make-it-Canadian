"use client";

import { AvatarCanvas } from "./AvatarCanvas";
import { useAvatarImage } from "@/lib/useAvatarImage";
import { useMouthDriver } from "@/lib/useMouthDriver";
import { DEFAULT_CONFIG, type AvatarConfig } from "@/lib/types";

const EXAMPLE: AvatarConfig = {
  ...DEFAULT_CONFIG,
  imageUrl: "/example.png",
  imageWidth: 320,
  imageHeight: 400,
  splitY: 0.75,
  splitAngle: -6,
  maxOpenAngle: 20,
  activity: 60,
  flapVariety: 3,
};

/** The landing page demo: the same renderer, driven by simulated speech. */
export function ExampleAvatar() {
  const { loaded } = useAvatarImage(EXAMPLE.imageUrl);
  const { openRef, variantRef } = useMouthDriver(EXAMPLE, 0.8);

  return (
    <div className="space-y-3">
      <div className="h-64 sm:h-80">
        {loaded && (
          <AvatarCanvas
            image={loaded.image}
            bounds={loaded.bounds}
            config={EXAMPLE}
            openValueRef={openRef}
            variantRef={variantRef}
            className="h-full w-full"
          />
        )}
      </div>
      <p className="text-center hint">This one is pretending to talk. Yours will use your microphone.</p>
    </div>
  );
}
