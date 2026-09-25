export default function Loading() {
  return (
    <div
      role="status"
      className="mx-auto max-w-3xl animate-pulse space-y-4 p-8"
    >
      <p>Memuat order…</p>
      <div className="h-20 rounded-2xl bg-surface-muted" />
      <div className="h-48 rounded-2xl bg-surface-muted" />
    </div>
  );
}
