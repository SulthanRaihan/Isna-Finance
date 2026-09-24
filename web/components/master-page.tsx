import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireOwner } from "@/lib/auth/guard";
import { api, actionError } from "@/lib/master/api";
import {
  maskedAccount,
  type Entity,
  type MasterRecord,
} from "@/lib/master/types";
import { ActiveToggle, MasterEditor } from "./master-editor";
const labels = { customers: "Pelanggan", accounts: "Rekening", teams: "Tim" };
export async function MasterPage({
  entity,
  searchParams,
}: {
  entity: Entity;
  searchParams: Promise<{ q?: string; offset?: string; active?: string }>;
}) {
  await requireOwner();
  const search = await searchParams;
  const q = (search.q ?? "").slice(0, 120);
  const offset = Math.max(0, parseInt(search.offset ?? "0", 10) || 0);
  const query = new URLSearchParams({ q, limit: "20", offset: String(offset) });
  if (["true", "false"].includes(search.active ?? ""))
    query.set("active", search.active!);
  let records: MasterRecord[] = [];
  let error = "";
  try {
    records = (await api<{ items: MasterRecord[] }>(`/${entity}?${query}`))
      .items;
  } catch (e) {
    error = actionError(e).error;
  }
  function pageLink(value: number) {
    const params = new URLSearchParams(query);
    params.set("offset", String(value));
    return `/${entity}?${params}`;
  }
  return (
    <AppShell activePath="/more">
      <div className="space-y-6">
        <Link href="/more" className="text-sm text-primary">
          Kembali ke data operasional
        </Link>
        <div>
          <p className="text-sm text-foreground-muted">Isna Finance</p>
          <h1 className="mt-1 text-3xl font-semibold">{labels[entity]}</h1>
        </div>
        {entity === "accounts" && (
          <Link
            href="/daily-accounts"
            className="inline-flex min-h-12 items-center rounded-xl bg-primary px-5 text-primary-foreground"
          >
            Pilih rekening harian
          </Link>
        )}
        <form className="flex flex-wrap gap-3">
          <input
            name="q"
            aria-label={`Cari ${labels[entity].toLowerCase()}`}
            defaultValue={q}
            placeholder="Cari nama atau label..."
            className="h-12 min-w-0 flex-1 rounded-xl border bg-surface px-4"
          />
          <select
            name="active"
            aria-label="Status"
            defaultValue={search.active ?? ""}
            className="h-12 rounded-xl border bg-surface px-3"
          >
            <option value="">Semua status</option>
            <option value="true">Aktif</option>
            <option value="false">Nonaktif</option>
          </select>
          <button className="min-h-12 rounded-xl border bg-surface px-4">
            Cari
          </button>
        </form>
        {error ? (
          <p role="alert" className="rounded-xl bg-danger/5 p-4 text-danger">
            {error}
          </p>
        ) : records.length === 0 ? (
          <p className="rounded-2xl border bg-surface p-6 text-foreground-muted">
            Belum ada data yang sesuai.
          </p>
        ) : (
          <ul className="divide-y rounded-2xl border bg-surface">
            {records.map((record) => (
              <li className="space-y-4 p-5" key={record.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">
                      {entity === "accounts"
                        ? maskedAccount(record)
                        : (record.display_name ?? record.name)}
                    </h2>
                    {entity === "teams" && (
                      <p className="mt-1 text-sm text-foreground-muted">
                        Tarif default Rp {record.default_fee_rate} / CNY
                      </p>
                    )}
                    {record.note && (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground-muted">
                        {record.note}
                      </p>
                    )}
                  </div>
                  <span className="rounded-lg bg-surface-muted px-2 py-1 text-xs">
                    {record.is_active ? "Aktif" : "Nonaktif"}
                  </span>
                </div>
                {entity !== "teams" && (
                  <>
                    <details>
                      <summary className="cursor-pointer py-2 text-sm text-primary">
                        Ubah data
                      </summary>
                      <MasterEditor entity={entity} record={record} />
                    </details>
                    <ActiveToggle entity={entity} record={record} />
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-between text-sm text-primary">
          {offset > 0 ? (
            <Link href={pageLink(Math.max(0, offset - 20))}>Sebelumnya</Link>
          ) : (
            <span />
          )}
          {records.length === 20 && (
            <Link href={pageLink(offset + 20)}>Berikutnya</Link>
          )}
        </div>
        <MasterEditor entity={entity} />
      </div>
    </AppShell>
  );
}
