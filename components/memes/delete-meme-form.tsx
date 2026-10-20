"use client";

import { useActionState } from "react";
import { deleteMeme } from "@/app/(admin)/memes/actions";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { IDLE } from "@/lib/action-state";
import { formatNumber } from "@/lib/format";
import { ActionMessage } from "@/components/action-message";

// On success the action redirects to /memes, so only errors come back here.
export function DeleteMemeForm({
  memeId,
  title,
  voteCount,
  uploaded,
}: {
  memeId: number;
  title: string;
  voteCount: number;
  // A user's upload lives in our Storage and goes too; a classic's image is
  // on imgflip.
  uploaded: boolean;
}) {
  const [state, formAction] = useActionState(deleteMeme.bind(null, memeId), IDLE);
  const votes = voteCount
    ? ` and its ${formatNumber(voteCount)} ${voteCount === 1 ? "vote" : "votes"}`
    : "";
  const image = uploaded ? " The uploaded image is deleted too." : "";

  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <ConfirmSubmit
        message={`Delete “${title}”${votes}?${image} This can't be undone.`}
        pendingLabel="Deleting…"
        className="bg-red-600 px-4 py-2 text-white hover:bg-red-700"
      >
        Delete meme
      </ConfirmSubmit>
      <ActionMessage state={state} />
    </form>
  );
}
