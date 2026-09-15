# Make It Canadian

Turn any PNG into a South Park style talking avatar for live streaming. Upload
a picture, drag a line across it, and paste one link into OBS. The top half
hinges open when you talk.

## How it works

The avatar is drawn on a single canvas. The same PNG is drawn twice, each time
clipped to one side of a straight split line, and the top piece is rotated
around a hinge that sits on that line. Because the line can tilt, the two
halves are polygons rather than rectangles: the line is clipped against the
image rectangle with a Sutherland-Hodgman pass, which handles a line that
leaves through the sides just as happily as one that leaves through the top.

The mouth interior is the wedge swept by the top piece's edge as it rotates -
one circular sector either side of the hinge - masked by the artwork's own
alpha so it can never spill outside the character's silhouette.

Audio is read straight from the browser with the Web Audio API, from one
microphone chosen by the user. This is deliberately independent of OBS: OBS
mixes game audio, music, alerts and voice chat, and none of that should move
the mouth.

```
RMS level -> noise gate -> activity-scaled loudness span
          -> attack/release smoothing -> quantise to N positions -> open angle
```

Two controls shape the feel:

- **Mouth positions** (2-8) - how many places the mouth is allowed to land.
  Two is the classic open/shut flap; more positions give a finer flutter.
- **Activity** (0-100) - how eager it is. Low only moves for real speech; high
  is click-clacky and reacts to every syllable. It narrows the loudness range
  that counts as "wide open" and speeds up attack and release together.

## Routes

| Route | What it is |
| --- | --- |
| `/` | Landing page with a live example |
| `/edit` | Upload a PNG and configure it |
| `/edit/[id]` | The same editor, loaded from a saved config |
| `/live/[id]` | Render only: no UI, no scrollbars, transparent background. This is the OBS Browser Source URL |
| `/how` | Plain-language setup and troubleshooting |

## Running it

```bash
npm install
npm run dev
```

Without a Blob store the app falls back to temporary local disk, which is fine
for development and loses everything on restart.

## Deploying

Deploy to Vercel, then add a Blob store (Storage → Blob). That sets
`BLOB_READ_WRITE_TOKEN` on the project, which is the only environment variable
the app needs. Uploaded PNGs land in `avatars/<id>.png` and configs in
`configs/<id>.json`. There is no database, no auth and no accounts: the id in
the URL is the only key, which is why the app tells people to bookmark their
editor link.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build (also typechecks) |
| `npm run typecheck` | Types only |

## A note about OBS and microphones

OBS Browser Sources run inside CEF, which cannot show a permission prompt.
Most setups grant microphone access automatically; if yours does not, the
avatar will show a message rather than freezing silently, and `/how` explains
the two ways around it. Never diagnose a still avatar by guessing - open
`/live/<id>` in a normal browser first to see which half is at fault.
