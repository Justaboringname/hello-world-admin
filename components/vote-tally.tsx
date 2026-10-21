import { formatNumber } from "@/lib/format";

// 👍 12 👎 3, read aloud as "12 upvotes, 3 downvotes". Screen readers skip
// aria-label on a plain span, so the words are visually hidden text instead.
export function VoteTally({ upvotes, downvotes }: { upvotes: number; downvotes: number }) {
  return (
    <span className="inline-flex flex-wrap gap-x-3 whitespace-nowrap tabular-nums">
      <span>
        <span aria-hidden>👍</span> {formatNumber(upvotes)}
        <span className="sr-only"> upvotes</span>
      </span>
      <span>
        <span aria-hidden>👎</span> {formatNumber(downvotes)}
        <span className="sr-only"> downvotes</span>
      </span>
    </span>
  );
}
