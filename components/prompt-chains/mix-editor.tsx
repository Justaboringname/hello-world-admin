"use client";

import { startTransition, useActionState, useId, useState, type FormEvent } from "react";
import { updateMix } from "@/app/(admin)/prompt-chains/actions";
import { ActionMessage } from "@/components/action-message";
import { IDLE } from "@/lib/action-state";
import { formatPercent } from "@/lib/format";

export type MixRow = { chainId: number; name: string; weight: number };

// prompt_chain_mix.weight is 0–100 (week7.sql). updateMix checks it again.
const WEIGHT_MAX = 100;

const inputClass =
  "w-20 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base tabular-nums focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 sm:text-sm dark:border-zinc-700 dark:bg-zinc-900";

// The same rule as the server: a whole number from 0 to 100. Anything else,
// like a box emptied while typing, counts as no weight yet.
function parseWeight(text: string) {
  const trimmed = text.trim();
  return /^\d{1,3}$/.test(trimmed) && Number(trimmed) <= WEIGHT_MAX ? Number(trimmed) : null;
}

// One weight per chain, with each one's share of the total as it's typed.
// Save sends every weight at once.
export function MixEditor({ rows }: { rows: MixRow[] }) {
  const id = useId();
  const saved: Record<number, string> = Object.fromEntries(rows.map((row) => [row.chainId, String(row.weight)]));
  const [weights, setWeights] = useState(saved);
  const [state, formAction, pending] = useActionState(updateMix, IDLE);

  const parsed = rows.map((row) => parseWeight(weights[row.chainId] ?? ""));
  const total = parsed.reduce<number>((sum, weight) => sum + (weight ?? 0), 0);
  const dirty = rows.some((row, index) => parsed[index] !== row.weight);

  function set(chainId: number, value: string) {
    setWeights((current) => ({ ...current, [chainId]: value }));
  }

  // By hand rather than <form action>, which resets the form after every
  // submit: a failed save should keep what was typed. Save stays disabled
  // until something changes, so there's no submit before JavaScript loads.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <div
          aria-hidden
          className="flex items-center gap-3 pb-2 text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
        >
          <span className="flex-1">Chain</span>
          <span className="w-20">Weight</span>
          <span className="w-12 text-right">Share</span>
        </div>
        <ul className="divide-y divide-zinc-200 border-t border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {rows.map((row, index) => {
            const inputId = `${id}-${row.chainId}`;
            const weight = parsed[index];
            return (
              <li key={row.chainId} className="flex items-center gap-3 py-2.5">
                <label htmlFor={inputId} className="min-w-0 flex-1 text-sm font-medium">
                  {row.name}
                </label>
                <input
                  id={inputId}
                  name={`weight-${row.chainId}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={WEIGHT_MAX}
                  step={1}
                  required
                  value={weights[row.chainId] ?? ""}
                  onChange={(event) => set(row.chainId, event.target.value)}
                  className={inputClass}
                />
                <span className="w-12 text-right text-sm tabular-nums text-zinc-500 dark:text-zinc-400">
                  {weight === null ? "–" : formatPercent(weight, total)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {total === 0 && (
        <p className="text-sm text-amber-800 dark:text-amber-300">
          Give at least one chain a weight above 0.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!dirty || pending || total === 0}
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? "Saving…" : "Save mix"}
        </button>
        {dirty && !pending && (
          <button
            type="button"
            onClick={() => setWeights(saved)}
            className="rounded-full px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Undo changes
          </button>
        )}
      </div>

      {/* "Saved" only until the next edit; errors stay until fixed. */}
      {(state.status === "error" || !dirty) && <ActionMessage state={state} />}
    </form>
  );
}
