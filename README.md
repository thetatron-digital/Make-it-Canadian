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

## The interface

The editor is one screen, not a wizard: the preview stays pinned on the left
while the right-hand column walks through four numbered steps, one open at a
time. Each step opens with a single plain-language sentence, shows two or
three controls, and folds everything else into a "Fine-tune" disclosure -
so the default view is a short list of decisions rather than a wall of
sliders. Nothing is locked: any step can be reopened at any point, and
saving works from any state.

Step three offers three presets - Calm, Chatty, Click-clack - which set
motion mode, mouth positions, activity and the attack/release pair together,
so nobody has to understand quantisation to get a good result.

The skin is a 1984 Macintosh read through an iOS lens: paper windows with
striped title bars and hard drop shadows on a dithered desk, holding
grouped list rows with hairline separators, generous touch targets and a
single accent colour. The bitmap display face (Silkscreen, self-hosted via
`next/font`) is used strictly for chrome - window titles, step numbers,
status labels. It has no lowercase, so it never renders user data: links,
ids, hex colours and measured values are all monospace.

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

Import the repository at [vercel.com/new](https://vercel.com/new). Next.js is
detected automatically and there is nothing to configure. Then two settings
have to be dealt with by hand, and neither is where you would expect on a
phone, where the dashboard collapses its side navigation.

**1. Turn off Vercel Authentication.** New projects enable it by default for
every `*.vercel.app` URL. It is the single worst default for this app,
because it fails invisibly: the page loads fine in your own browser, where
you are signed in to Vercel, and shows a login wall inside OBS, which is a
different browser with no session. You would go looking for a microphone
bug that was never there.

It lives on its own settings page, not under General:

```
/<team>/<project>/settings/deployment-protection
```

Set Vercel Authentication to Disabled. If your plan will not let you, note
that protection never applies to custom domains, so attaching one and
pointing OBS at that hostname works instead.

**2. Give the project a public Blob store.** Storage is on the *account*
page, not inside the project, which is why it is not in the project's tabs:

```
/<team>/~/stores
```

Create a Blob store and choose **Public** access. Vercel recommends Private,
but private blobs need a signed token on every read and OBS has no token, so
the avatars would never load. Public is correct here, and it is the tradeoff
the app is built around: ids are unguessable, but anyone holding a link can
view it. Access mode cannot be changed after creation.

Connecting a store to a project only sets one variable. If the Connect
Project control is not visible — it collapses out of the mobile layout —
set it yourself from the store's Quickstart panel, `.env.local` tab:

```
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
```

Add that under the project's Settings → Environment Variables for all
environments. Importing the repo may also have auto-created a store and set
this variable already, since Vercel detects `@vercel/blob` in the manifest —
check before creating a second one.

**3. Redeploy.** Environment variables do not reach a deployment that
already exists. Pushing a commit also works, and is easier from a phone than
finding the redeploy menu.

Until the token is in place, both write routes return a 503 naming the fix
rather than pretending to save; the editor shows it in place. Uploaded PNGs
land in `avatars/<id>.png` and configs in `configs/<id>.json`. There is no
database, no auth and no accounts: the id in the URL is the only key, which
is why the app tells people to bookmark their editor link.

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
