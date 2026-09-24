"use client";
import { useState, useTransition } from "react";
import { saveDaily } from "@/app/master-actions";
import {
  maskedAccount,
  type Assignment,
  type MasterRecord,
  type ActionResult,
} from "@/lib/master/types";
import { ActionFeedback } from "./master-editor";
export function DailyAccountEditor({
  day,
  accounts,
  assignments,
}: {
  day: string;
  accounts: MasterRecord[];
  assignments: Assignment[];
}) {
  const [ids, setIds] = useState(assignments.map((item) => item.account_id));
  const [defaultId, setDefault] = useState(
    assignments.find((item) => item.is_default)?.account_id ?? "",
  );
  const [result, setResult] = useState<ActionResult>({});
  const [pending, start] = useTransition();
  const selected = accounts.filter((item) => ids.includes(item.id));
  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          setResult({});
          setResult(await saveDaily(day, ids, defaultId || null));
        });
      }}
    >
      <fieldset disabled={pending} className="space-y-4">
        <legend className="mb-4 font-semibold">
          Rekening aktif pada {day}
        </legend>
        <div className="divide-y rounded-2xl border bg-surface">
          {accounts
            .filter((item) => item.is_active || ids.includes(item.id))
            .map((item) => (
              <label
                key={item.id}
                className="flex min-h-16 items-center gap-3 p-4"
              >
                <input
                  type="checkbox"
                  checked={ids.includes(item.id)}
                  onChange={(event) => {
                    setResult({});
                    setIds(
                      event.target.checked
                        ? [...ids, item.id]
                        : ids.filter((id) => id !== item.id),
                    );
                  }}
                  className="size-5 accent-primary"
                />
                <span className="text-sm">
                  {maskedAccount(item)}
                  {!item.is_active && " - Nonaktif"}
                </span>
              </label>
            ))}
        </div>
        <label className="block text-sm font-medium">
          Rekening default
          <select
            value={defaultId}
            onChange={(event) => {
              setResult({});
              setDefault(event.target.value);
            }}
            className="mt-2 h-12 w-full rounded-xl border bg-surface px-3"
          >
            <option value="">Tanpa default</option>
            {selected.map((item) => (
              <option key={item.id} value={item.id}>
                {maskedAccount(item)}
              </option>
            ))}
            {defaultId && !ids.includes(defaultId) && (
              <option value={defaultId}>
                Default tidak lagi dipilih - pilih ulang
              </option>
            )}
          </select>
        </label>
        <p className="text-sm text-foreground-muted">
          Perubahan berlaku hanya untuk tanggal ini. Jika semua pilihan
          dikosongkan, pilih juga Tanpa default sebelum menyimpan.
        </p>
      </fieldset>
      <ActionFeedback result={result} />
      <button
        disabled={pending || (!!defaultId && !ids.includes(defaultId))}
        className="min-h-12 rounded-xl bg-primary px-5 text-primary-foreground disabled:opacity-50"
      >
        {pending ? "Menyimpan..." : "Simpan pilihan harian"}
      </button>
    </form>
  );
}
