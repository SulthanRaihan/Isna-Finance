import test from "node:test";
import assert from "node:assert/strict";
import { expiredObjects, sweep } from "../functions/ai-cleanup/cleanup.mjs";
const now = Date.parse("2026-01-01T01:00:00Z");
const object = {
  id: "synthetic",
  name: "80000000-0000-4000-8000-000000000001.png",
  created_at: "2026-01-01T00:15:00Z",
};
test("45 minute boundary leaves margin before one hour", () => {
  assert.deepEqual(expiredObjects([object], now), [object.name]);
  assert.deepEqual(
    expiredObjects([{ ...object, created_at: "2026-01-01T00:15:01Z" }], now),
    [],
  );
});
test("sweep removes orphan objects and heartbeats only on success", async () => {
  let items = [object],
    removed = [],
    beats = 0;
  await sweep({
    list: async () => items,
    remove: async (names) => {
      removed = names;
      items = [];
    },
    heartbeat: async () => {
      beats++;
    },
    now: () => now,
  });
  assert.deepEqual(removed, [object.name]);
  assert.equal(beats, 1);
  await assert.rejects(
    sweep({
      list: async () => [object],
      remove: async () => {
        throw Error("offline");
      },
      heartbeat: async () => {
        beats++;
      },
      now: () => now,
    }),
  );
  assert.equal(beats, 1);
});
test("cleanup handler denies unauthenticated calls and only uses cleanup paths", async () => {
  const originalFetch = globalThis.fetch;
  let handler;
  const env = {
    AI_CLEANUP_SECRET: "synthetic-worker-secret",
    SUPABASE_URL: "https://synthetic.test",
    SUPABASE_SERVICE_ROLE_KEY: "synthetic-server-key",
  };
  globalThis.Deno = {
    env: { get: (name) => env[name] },
    serve: (fn) => {
      handler = fn;
    },
  };
  const paths = [];
  globalThis.fetch = async (url, options) => {
    paths.push(new URL(url).pathname);
    assert.equal(options.headers.apikey, "synthetic-server-key");
    return Response.json(url.includes("/object/list/") ? [] : null);
  };
  try {
    await import("../functions/ai-cleanup/index.ts");
    const rejected = await handler(
      new Request("https://synthetic.test", { method: "POST" }),
    );
    assert.equal(rejected.status, 401);
    assert.deepEqual(paths, []);
    const accepted = await handler(
      new Request("https://synthetic.test", {
        method: "POST",
        headers: { "x-cleanup-secret": "synthetic-worker-secret" },
      }),
    );
    assert.equal(accepted.status, 200);
    assert.deepEqual(paths, [
      "/storage/v1/object/list/isna-ai-temp",
      "/rest/v1/rpc/ai_cleanup_heartbeat",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    delete globalThis.Deno;
  }
});
