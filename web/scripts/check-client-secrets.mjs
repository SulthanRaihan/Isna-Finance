import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const forbidden = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "synthetic_server_only_canary_not_a_real_key",
];
if (process.env.SUPABASE_SERVICE_ROLE_KEY)
  forbidden.push(process.env.SUPABASE_SERVICE_ROLE_KEY);
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await scan(path);
    else if (/\.(js|json|map)$/.test(entry.name)) {
      const text = await readFile(path, "utf8");
      if (forbidden.some((value) => text.includes(value))) {
        throw new Error(`Server-only credential marker found in ${path}`);
      }
    }
  }
}
await scan(".next/static");
console.log("Client build contains no service-role key or server-only canary.");
