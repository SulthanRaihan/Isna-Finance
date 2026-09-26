import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { OutflowForm, VoidForm } from "@/components/money-out-forms";
import { requireOwner } from "@/lib/auth/guard";
import { api } from "@/lib/master/api";
import { categories, type OutflowDetail } from "@/lib/money-out";
import { money } from "@/lib/orders/types";
export const dynamic = "force-dynamic";
export default async function Detail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOwner();
  const { id } = await params;
  let data: OutflowDetail | undefined;
  if (/^[0-9a-f-]{36}$/i.test(id))
    try {
      data = await api<OutflowDetail>(`/outflows/${id}`);
    } catch {}
  const f = data?.outflow;
  return (
    <AppShell activePath="/activity">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link href="/outflows" className="text-primary">
          Kembali ke Money Out
        </Link>
        <h1 className="text-3xl font-semibold">Detail Money Out</h1>
        {!data || !f ? (
          <p role="alert">
            Posting belum dapat ditampilkan. Periksa koneksi dan ID posting.
          </p>
        ) : (
          <>
            <section className="space-y-3 rounded-2xl border bg-surface p-5">
              <h2 className="font-semibold">{categories[f.category]}</h2>
              <p className="text-2xl font-semibold">Rp{money(f.amount_idr)}</p>
              <p>Tanggal uang keluar: {f.business_date}</p>
              <p className="whitespace-pre-wrap break-words">{f.description}</p>
              <p>
                {f.status === "posted"
                  ? "Aktif · dihitung sebagai Money Out"
                  : "Voided · tidak dihitung sebagai Money Out"}
              </p>
              {f.cny_amount && (
                <p>
                  {f.cny_amount} CNY × {f.rate_or_fee} IDR
                </p>
              )}
              {f.void_reason && (
                <p className="whitespace-pre-wrap">Alasan: {f.void_reason}</p>
              )}
              {f.source_id && (
                <p className="break-all text-sm text-foreground-muted">
                  Sumber: {f.source_type} · {f.source_id}
                </p>
              )}
            </section>
            {f.status === "posted" && (
              <>
                <details className="rounded-2xl border p-5">
                  <summary className="cursor-pointer font-semibold text-primary">
                    Koreksi posting
                  </summary>
                  <div className="mt-4">
                    <OutflowForm
                      key={f.updated_at}
                      day={f.business_date}
                      outflow={f}
                    />
                  </div>
                </details>
                <details className="rounded-2xl border p-5">
                  <summary className="cursor-pointer font-semibold text-danger">
                    Void posting
                  </summary>
                  <div className="mt-4">
                    <VoidForm key={f.updated_at} outflow={f} />
                  </div>
                </details>
              </>
            )}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Rantai koreksi</h2>
              {data.chain.map((r, i) => (
                <Link
                  className="block rounded-xl border p-4"
                  href={`/outflows/${r.id}`}
                  key={r.id}
                >
                  {i === 0 ? "Posting asli" : `Pengganti ${i}`} ·{" "}
                  {r.business_date} · Rp{money(r.amount_idr)} · {r.status}
                  {r.void_reason && (
                    <span className="mt-2 block whitespace-pre-wrap text-sm">
                      {r.void_reason}
                    </span>
                  )}
                </Link>
              ))}
            </section>
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Audit</h2>
              {data.audit.map((a) => (
                <details key={a.id} className="rounded-xl border p-4">
                  <summary className="cursor-pointer break-words">
                    {a.action} · {a.created_at}
                  </summary>
                  <p className="mt-2 break-all text-sm">
                    Posting {a.entity_id}
                  </p>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all text-xs">
                    {JSON.stringify(
                      { sebelum: a.before_json, sesudah: a.after_json },
                      null,
                      2,
                    )}
                  </pre>
                </details>
              ))}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
