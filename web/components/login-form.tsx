"use client";

import { useActionState, useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
} from "lucide-react";
import { login } from "@/app/auth-actions";
import type { LoginState } from "@/lib/auth/state";

export function LoginForm({ disabled = false }: { disabled?: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    login,
    {},
  );
  const [visible, setVisible] = useState(false);
  const inputClass =
    "h-13 w-full rounded-xl border bg-background pr-12 pl-11 text-base outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/10 disabled:opacity-60";
  return (
    <form
      action={action}
      className="space-y-5"
      aria-label="Login Isna"
      aria-busy={pending}
    >
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <div className="relative">
          <Mail
            size={18}
            aria-hidden="true"
            className="absolute top-4 left-4 text-foreground-muted"
          />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="Email akun Isna"
            defaultValue={state.email}
            required
            maxLength={254}
            disabled={disabled || pending}
            className={inputClass}
          />
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">
          Kata sandi
        </label>
        <div className="relative">
          <LockKeyhole
            size={18}
            aria-hidden="true"
            className="absolute top-4 left-4 text-foreground-muted"
          />
          <input
            id="password"
            name="password"
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Masukkan kata sandi"
            required
            maxLength={4096}
            disabled={disabled || pending}
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => setVisible(!visible)}
            aria-label={
              visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"
            }
            aria-pressed={visible}
            className="absolute top-1 right-1 flex size-11 items-center justify-center rounded-lg text-foreground-muted"
          >
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>
      {state.error && (
        <p
          role="alert"
          className="rounded-xl bg-danger/5 p-3 text-sm leading-6 text-danger"
        >
          {state.error}
        </p>
      )}
      {disabled && (
        <p role="status" className="text-sm leading-6 text-foreground-muted">
          Login sedang disiapkan. Silakan kembali nanti.
        </p>
      )}
      <button
        type="submit"
        disabled={disabled || pending}
        className="flex h-13 w-full items-center justify-center gap-3 rounded-xl bg-primary px-5 font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <>
            <LoaderCircle
              size={18}
              className="animate-spin"
              aria-hidden="true"
            />
            Memeriksa akun…
          </>
        ) : (
          <>
            Masuk ke ruang kerja
            <ArrowRight size={18} aria-hidden="true" />
          </>
        )}
      </button>
    </form>
  );
}
