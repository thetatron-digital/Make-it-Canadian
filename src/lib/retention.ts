/**
 * How long an avatar survives after it was last saved. Nothing here is
 * meant to be permanent: a streamer sets one up for a stream, and if they
 * want it next week they can make another in a couple of minutes. Keeping
 * strangers' uploaded pictures around forever is a liability nobody asked
 * for.
 *
 * Editing an avatar counts as touching it, so one that is actively in use
 * keeps renewing itself.
 */
export const RETENTION_DAYS = 7;

export const DAY_MS = 24 * 60 * 60 * 1000;

export interface StoredObject {
  pathname: string;
  uploadedAt: Date | string;
  url: string;
}

/** `avatars/ab12cd34.png` and `configs/ab12cd34.json` both belong to `ab12cd34`. */
export function idFromPathname(pathname: string): string | null {
  const match = /^(?:avatars|configs)\/([a-z0-9]+)\.(?:png|json)$/.exec(pathname);
  return match ? match[1] : null;
}

/**
 * Work out which objects are past their retention window.
 *
 * Grouped by id and judged on the *newest* timestamp in the group, so an
 * avatar whose settings were edited yesterday is never half-deleted because
 * its picture was uploaded a fortnight ago. Both pieces go together or
 * neither does - a config without its image is a broken link, which is
 * worse than either keeping or removing the pair.
 */
export function expiredUrls(
  objects: StoredObject[],
  now: number = Date.now(),
  retentionDays: number = RETENTION_DAYS,
): { urls: string[]; ids: string[] } {
  const cutoff = now - retentionDays * DAY_MS;
  const groups = new Map<string, { newest: number; urls: string[] }>();

  for (const object of objects) {
    const id = idFromPathname(object.pathname);
    if (!id) continue;
    const at = new Date(object.uploadedAt).getTime();
    if (!Number.isFinite(at)) continue;
    const group = groups.get(id) ?? { newest: 0, urls: [] };
    group.newest = Math.max(group.newest, at);
    group.urls.push(object.url);
    groups.set(id, group);
  }

  const urls: string[] = [];
  const ids: string[] = [];
  for (const [id, group] of groups) {
    if (group.newest < cutoff) {
      urls.push(...group.urls);
      ids.push(id);
    }
  }
  return { urls, ids };
}

/** When an avatar saved now would be swept up, for telling the user plainly. */
export function expiryDate(from: number = Date.now()): Date {
  return new Date(from + RETENTION_DAYS * DAY_MS);
}
