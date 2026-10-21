import type { Dashboard } from "@/lib/dashboard";
import { formatNumber } from "@/lib/format";
import { STAGES } from "./colors";
import { HBar } from "./bar";
import { fraction, percent, share } from "./numbers";

const STEPS: { key: keyof Dashboard["funnel"]; label: string; hint: string }[] = [
  { key: "signed_up", label: "Signed up", hint: "Signed in with Google" },
  { key: "named", label: "Added their name", hint: "First and last name" },
  { key: "voted", label: "Voted", hint: "At least one 👍 or 👎" },
  { key: "posted", label: "Posted", hint: "A photo or a meme" },
  { key: "regulars", label: "Regulars", hint: "Voted on 3+ different days" },
];

// Each step as a share of everyone who signed up, so bars compare with one
// another directly. Steps count people and aren't strictly nested (someone
// can post without voting), which is why it's "% of sign-ups" and not
// step-to-step conversion.
export function Funnel({ funnel }: { funnel: Dashboard["funnel"] }) {
  const base = funnel.signed_up;
  return (
    <ol className="space-y-3.5">
      {STEPS.map((step, index) => {
        const value = funnel[step.key];
        return (
          <li key={step.key}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0">
                <span className="font-medium">{step.label}</span>{" "}
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{step.hint}</span>
              </span>
              <span className="shrink-0 tabular-nums">
                <strong className="font-semibold">{formatNumber(value)}</strong>{" "}
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {percent(share(value, base))}
                </span>
              </span>
            </div>
            <div className="mt-1.5">
              <HBar value={fraction(value, base)} color={STAGES[index]!} height="h-4" />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
