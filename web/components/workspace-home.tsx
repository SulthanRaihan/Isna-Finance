import Link from "next/link";
import { NotebookPen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function WorkspaceHome({ displayName }: { displayName: string }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-medium text-primary">
          Ruang kerja pribadi
        </p>
        <h1 className="text-[28px] font-semibold tracking-tight">
          Selamat datang, {displayName}.
        </h1>
        <p className="mt-3 text-sm leading-6 text-foreground-muted">
          Semua dimulai dari catatan yang rapi.
        </p>
      </div>
      <Card className="max-w-3xl rounded-[20px] py-8">
        <CardHeader>
          <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-surface-muted text-primary">
            <NotebookPen size={24} aria-hidden="true" />
          </div>
          <CardTitle>
            <h2 className="text-lg">Ruang kerja pribadimu</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="max-w-lg text-sm leading-6 text-foreground-muted">
            Login pribadi sudah tersedia. Pencatatan order, aktivitas, dan rekap
            harian akan hadir pada tahap berikutnya.
          </p>
          <p className="mt-4 text-xs text-foreground-muted">
            Belum ada fitur pencatatan transaksi.
          </p>
        </CardContent>
      </Card>
      <Link
        href="/more"
        className="inline-flex min-h-12 items-center rounded-xl bg-primary px-5 text-primary-foreground"
      >
        Kelola data operasional
      </Link>
    </div>
  );
}
