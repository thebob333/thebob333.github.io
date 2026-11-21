/** Shown for a split second the first time a page loads. */
export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-2xl animate-pulse space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-40 rounded-lg bg-muted" />
      <div className="h-4 w-64 rounded bg-muted" />
      <div className="h-32 rounded-2xl bg-muted" />
      <div className="h-24 rounded-2xl bg-muted" />
    </div>
  );
}
