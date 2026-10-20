// Shown while a section loads. Plain grey blocks in the shape of a page
// header and a few cards.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-2 h-4 w-72 max-w-full rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
        ))}
      </div>
      <div className="mt-4 h-72 rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}
