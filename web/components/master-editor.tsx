"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { saveRecord } from "@/app/master-actions";
import type { ActionResult, Entity, MasterRecord } from "@/lib/master/types";
import { Card, CardContent } from "@/components/ui/card";
const inputClass =
  "mt-2 h-12 w-full rounded-xl border bg-surface px-3 outline-none focus:ring-2 focus:ring-primary/30";
const buttonClass =
  "min-h-11 rounded-xl bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50";
const fields: Record<
  Entity,
  {
    key: string;
    label: string;
    required?: boolean;
    max?: number;
    pattern?: string;
  }[]
> = {
  customers: [
    { key: "display_name", label: "Nama pelanggan", required: true, max: 120 },
    { key: "note", label: "Catatan (opsional)", max: 2000 },
  ],
  accounts: [
    { key: "label", label: "Label rekening", required: true, max: 120 },
    { key: "bank_name", label: "Nama bank", required: true, max: 120 },
    {
      key: "country_code",
      label: "Kode negara (ID / CN)",
      required: true,
      pattern: "[A-Z]{2}",
      max: 2,
    },
    {
      key: "account_last4",
      label: "4 digit terakhir (opsional)",
      pattern: "[0-9]{4}",
      max: 4,
    },
    { key: "account_type", label: "Jenis rekening (opsional)", max: 40 },
  ],
  teams: [
    { key: "name", label: "Nama tim", required: true, max: 120 },
    {
      key: "default_fee_rate",
      label: "Tarif default (Rp / CNY)",
      required: true,
      pattern: "[0-9]+([.][0-9]{1,6})?",
    },
  ],
};
export function ActionFeedback({ result }: { result: ActionResult }) {
  return (
    <>
      {result.error && (
        <div
          role="alert"
          className="rounded-xl bg-danger/5 p-4 text-sm leading-6 text-danger"
        >
          <p>{result.error}</p>
          {result.fields && (
            <ul>
              {Object.keys(result.fields).map((key) => (
                <li key={key}>{key.replace(/^body\./, "")}: periksa nilai</li>
              ))}
            </ul>
          )}
          {result.conflicts && (
            <ul className="mt-2 space-y-2">
              {result.conflicts.map((item) => (
                <li key={item.business_date}>
                  <Link
                    className="underline"
                    href={`/daily-accounts?date=${item.business_date}`}
                  >
                    {item.business_date}
                    {item.is_default ? "  Default" : "  Aktif"} ubah pilihan
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {result.ok && (
        <p role="status" className="text-sm text-success">
          Perubahan tersimpan.
        </p>
      )}
    </>
  );
}
export function MasterEditor({
  entity,
  record,
}: {
  entity: Entity;
  record?: MasterRecord;
}) {
  const [result, setResult] = useState<ActionResult>({});
  const [pending, start] = useTransition();
  function submit(form: HTMLFormElement) {
    const data = new FormData(form);
    const payload: Record<string, unknown> = {};
    fields[entity].forEach((field) => {
      const value = String(data.get(field.key) ?? "").trim();
      payload[field.key] = value || null;
    });
    start(async () => {
      setResult({});
      const answer = await saveRecord(entity, record?.id ?? null, payload);
      setResult(answer);
      if (answer.ok && !record) form.reset();
    });
  }
  return (
    <Card>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit(event.currentTarget);
          }}
          className="space-y-5"
        >
          <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-4 text-base font-semibold">
              {record ? "Ubah data" : "Tambah baru"}
            </legend>
            {fields[entity].map((field) => (
              <label key={field.key} className="text-sm font-medium">
                {field.label}
                <input
                  name={field.key}
                  className={inputClass}
                  required={field.required}
                  maxLength={field.max}
                  pattern={field.pattern}
                  inputMode={
                    field.key === "default_fee_rate"
                      ? "decimal"
                      : field.key === "account_last4"
                        ? "numeric"
                        : "text"
                  }
                  defaultValue={String(
                    record?.[field.key as keyof MasterRecord] ??
                      (field.key === "default_fee_rate" ? "2.000000" : ""),
                  )}
                />
              </label>
            ))}
          </fieldset>
          {entity === "accounts" && (
            <p className="text-sm text-foreground-muted">
              Cukup label dan 4 digit terakhir. Jangan masukkan nomor rekening
              lengkap.
            </p>
          )}
          <ActionFeedback result={result} />
          <button disabled={pending} className={buttonClass}>
            {pending ? "Menyimpan" : "Simpan"}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
export function ActiveToggle({
  entity,
  record,
}: {
  entity: "customers" | "accounts";
  record: MasterRecord;
}) {
  const [result, setResult] = useState<ActionResult>({});
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <button
        disabled={pending}
        className="min-h-11 rounded-xl border px-4 text-sm disabled:opacity-50"
        onClick={() =>
          start(async () =>
            setResult(
              await saveRecord(entity, record.id, {
                is_active: !record.is_active,
              }),
            ),
          )
        }
      >
        {pending ? "Memeriksa" : record.is_active ? "Nonaktifkan" : "Aktifkan"}
      </button>
      <ActionFeedback result={result} />
    </div>
  );
}
