import { expect, test } from "vitest";
import config from "../next.config";

test("all frontend routes prevent framing, sniffing and referrer disclosure", async () => {
  const rules = await config.headers!();
  const global = rules.find((rule) => rule.source === "/:path*")!;
  expect(global.headers).toEqual(
    expect.arrayContaining([
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "no-referrer" },
    ]),
  );
  expect(
    global.headers.find((header) => header.key === "Content-Security-Policy")
      ?.value,
  ).toContain("frame-ancestors 'none'");
  expect(config.experimental?.serverActions).toBeUndefined();
});
