import { formatDate, formatDateTime } from "@/lib/format";
import { timeAgo } from "@/lib/time";

// A timestamp shown one way with the other on hover: "date" shows the day
// and hovers "3 weeks ago"; "ago" shows "3 weeks ago" and hovers the exact
// New York time.
export function whenTitle(iso: string | null, show: "date" | "ago") {
  if (!iso) return undefined;
  return show === "date" ? timeAgo(iso) : formatDateTime(iso);
}

export function When({
  iso,
  show,
  never = "Never",
}: {
  iso: string | null;
  show: "date" | "ago";
  never?: string;
}) {
  if (!iso) return <span className="text-zinc-500 dark:text-zinc-400">{never}</span>;
  return (
    <time dateTime={iso} title={whenTitle(iso, show)}>
      {show === "date" ? formatDate(iso) : timeAgo(iso)}
    </time>
  );
}
