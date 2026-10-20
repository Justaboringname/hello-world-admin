"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import { updateGeneration } from "@/app/(admin)/media/actions";
import { IDLE } from "@/lib/action-state";
import { LOCATION_MAX_LENGTH, VIBES, isVibe, type Vibe } from "@/lib/captions";
import { ActionMessage } from "@/components/action-message";

const fieldClass =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 sm:text-sm dark:border-zinc-700 dark:bg-zinc-900";

// Location and vibe: the only details admin.sql lets anyone change. The
// prompt that was sent to Gemini stays as it was, so it still shows what the
// captions were written from.
export function GenerationDetailsForm({
  generationId,
  location,
  vibe,
}: {
  generationId: number;
  location: string | null;
  vibe: string;
}) {
  const [state, formAction, pending] = useActionState(
    updateGeneration.bind(null, generationId),
    IDLE,
  );

  // Submitted by hand (not <form action>) so a failed save keeps what was
  // typed instead of resetting the form.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="text-sm font-medium">
        Location <span className="font-normal text-zinc-500">(optional)</span>
        <input
          name="location"
          defaultValue={location ?? ""}
          maxLength={LOCATION_MAX_LENGTH}
          placeholder="e.g. Washington Square Park"
          className={fieldClass}
        />
      </label>

      <label className="text-sm font-medium">
        Vibe
        <select name="vibe" defaultValue={vibe} className={fieldClass}>
          {/* An old vibe that's no longer offered shows, but can't be saved. */}
          {!isVibe(vibe) && (
            <option value={vibe} disabled>
              {vibe} (no longer offered)
            </option>
          )}
          {(Object.keys(VIBES) as Vibe[]).map((key) => (
            <option key={key} value={key}>
              {VIBES[key].emoji} {VIBES[key].label}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-wait disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? "Saving…" : "Save details"}
        </button>
        <ActionMessage state={state} />
      </div>
    </form>
  );
}
