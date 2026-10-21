"use client";

import { useActionState } from "react";
import { deleteGeneration } from "@/app/(admin)/media/actions";
import { ActionMessage } from "@/components/action-message";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { IDLE } from "@/lib/action-state";
import { plural } from "./data";

// On success the action redirects to /media, so only errors come back here.
export function DeleteGenerationForm({
  generationId,
  captionCount,
  voteCount,
}: {
  generationId: number;
  captionCount: number;
  voteCount: number;
}) {
  const [state, formAction] = useActionState(deleteGeneration.bind(null, generationId), IDLE);
  const captions = plural(captionCount, "caption", "captions");
  const votes = plural(voteCount, "vote", "votes");

  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <ConfirmSubmit
        message={`Delete this photo, its ${captions} and ${captionCount === 1 ? "its" : "their"} ${votes}? This can't be undone.`}
        pendingLabel="Deleting…"
        className="bg-red-600 px-4 py-2 text-white hover:bg-red-700"
      >
        Delete photo
      </ConfirmSubmit>
      <ActionMessage state={state} />
    </form>
  );
}
