import Link from "next/link";
import type { Outflow } from "@/lib/money-out";
import { money } from "@/lib/orders/types";
export function CurrentPosting({
  outflow,
}: {
  outflow: Outflow | null | undefined;
}) {
  if (!outflow)
    return <p className="text-sm">Posting pembayaran belum tersedia.</p>;
  return (
    <div className="rounded-xl border p-3 text-sm">
      <p>
        Posting terkini:{" "}
        {outflow.status === "posted"
          ? "Aktif · dihitung sebagai Money Out"
          : "Voided · tidak dihitung sebagai Money Out"}
      </p>
      <p>
        Rp{money(outflow.amount_idr)} · {outflow.business_date}
      </p>
      <Link className="text-primary underline" href={`/outflows/${outflow.id}`}>
        Detail, riwayat, dan koreksi Money Out
      </Link>
    </div>
  );
}
