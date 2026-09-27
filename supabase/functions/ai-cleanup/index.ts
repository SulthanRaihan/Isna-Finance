import { BUCKET, sweep } from "./cleanup.mjs";

Deno.serve(async (request: Request) => {
  const secret = Deno.env.get("AI_CLEANUP_SECRET");
  const supplied = request.headers.get("x-cleanup-secret");
  if (request.method !== "POST" || !secret || !supplied)
    return new Response(null, { status: 401 });
  const digest = async (s: string) =>
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    );
  const [a, b] = await Promise.all([digest(secret), digest(supplied)]);
  if (a.reduce((diff, value, index) => diff | (value ^ b[index]), 0) !== 0)
    return new Response(null, { status: 401 });
  const base = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!base || !key) return new Response(null, { status: 503 });
  const call = async (path: string, method: string, body: unknown) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("Cleanup unavailable");
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  };
  try {
    await sweep({
      list: () =>
        call(`/storage/v1/object/list/${BUCKET}`, "POST", {
          prefix: "",
          limit: 1000,
          offset: 0,
          sortBy: { column: "created_at", order: "asc" },
        }),
      remove: (names: string[]) =>
        call(`/storage/v1/object/${BUCKET}`, "DELETE", { prefixes: names }),
      heartbeat: () => call("/rest/v1/rpc/ai_cleanup_heartbeat", "POST", {}),
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
});
