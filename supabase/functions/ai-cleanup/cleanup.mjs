export const BUCKET = "isna-ai-temp";
export const STALE_MS = 45 * 60 * 1000;

export function expiredObjects(items, now) {
  return items
    .filter((item) => {
      if (!item.id || !/^[0-9a-f-]{36}\.(png|jpg)$/.test(item.name))
        throw new Error("Unexpected object");
      const created = Date.parse(item.created_at);
      if (!Number.isFinite(created)) throw new Error("Invalid timestamp");
      return now - created >= STALE_MS;
    })
    .map((item) => item.name);
}

export async function sweep({
  list,
  remove,
  heartbeat,
  now = () => Date.now(),
}) {
  for (let page = 0; page < 20; page++) {
    const items = await list(); // oldest first; delete before requesting the first page again
    const names = expiredObjects(items, now());
    if (!names.length) {
      await heartbeat();
      return;
    }
    await remove(names);
  }
  throw new Error("Sweep capacity exceeded");
}
