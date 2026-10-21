"use client";

import {
  startTransition,
  useActionState,
  useId,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { addCaption, deleteCaption, updateCaption } from "@/app/(admin)/media/actions";
import { ActionMessage } from "@/components/action-message";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Badge } from "@/components/ui";
import { IDLE, type ActionState } from "@/lib/action-state";
import { CAPTION_MAX_LENGTH, type Caption } from "@/lib/captions";
import { scoreTone, signedScore } from "@/lib/format";
import { plural, tidyText } from "./data";
import { VoteTally } from "./vote-tally";

const textareaClass =
  "w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base leading-snug outline-none [field-sizing:content] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 sm:text-sm dark:border-zinc-700 dark:bg-zinc-900";

// Newlines are dropped when saving anyway, so Enter saves (Shift+Enter still
// works for anyone who expects it to). requestSubmit() ignores a disabled
// button, so each form's submit handler checks for itself.
function submitOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }
}

function Counter({ length }: { length: number }) {
  return (
    <span
      className={`tabular-nums ${length > CAPTION_MAX_LENGTH ? "text-red-600 dark:text-red-400" : ""}`}
    >
      {length}/{CAPTION_MAX_LENGTH}
    </span>
  );
}

// One caption: its wording can be edited, its votes can't (they only change
// when people vote). The last caption on a photo can't be deleted.
export function CaptionEditor({
  caption,
  isTop,
  canDelete,
}: {
  caption: Caption;
  isTop: boolean;
  canDelete: boolean;
}) {
  const formId = useId();
  const [text, setText] = useState(caption.text);
  const [saveState, saveAction, saving] = useActionState(updateCaption.bind(null, caption.id), IDLE);
  const [deleteState, deleteAction] = useActionState(deleteCaption.bind(null, caption.id), IDLE);
  const dirty = tidyText(text) !== caption.text;
  const votes = caption.upvotes + caption.downvotes;

  // By hand, so a failed save keeps the edit instead of resetting the form.
  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty || saving) return;
    const formData = new FormData(event.currentTarget);
    startTransition(() => saveAction(formData));
  }

  return (
    <li className="flex gap-3 py-4">
      <span
        className="mt-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
        title={`Position ${caption.position}`}
      >
        {caption.position}
      </span>

      <div className="min-w-0 flex-1">
        <form id={formId} onSubmit={handleSave}>
          <label htmlFor={`${formId}-text`} className="sr-only">
            Caption {caption.position}
          </label>
          <textarea
            id={`${formId}-text`}
            name="text"
            rows={3}
            required
            maxLength={CAPTION_MAX_LENGTH}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={submitOnEnter}
            className={textareaClass}
          />
        </form>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm tabular-nums text-zinc-500 dark:text-zinc-400">
            {isTop && <Badge tone="amber">👑 Top caption</Badge>}
            <VoteTally upvotes={caption.upvotes} downvotes={caption.downvotes} />
            <Badge tone={scoreTone(caption.score)}>Score {signedScore(caption.score)}</Badge>
            <span className="text-xs">
              <Counter length={tidyText(text).length} />
            </span>
          </p>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              form={formId}
              disabled={!dirty || saving}
              className="rounded-full bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {dirty && !saving && (
              <button
                type="button"
                onClick={() => setText(caption.text)}
                className="rounded-full px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Undo
              </button>
            )}
            {canDelete ? (
              <form action={deleteAction}>
                <ConfirmSubmit
                  message={`Delete caption ${caption.position}${votes ? ` and its ${plural(votes, "vote", "votes")}` : ""}? This can't be undone.`}
                  pendingLabel="Deleting…"
                  className="px-3 py-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50"
                >
                  Delete
                </ConfirmSubmit>
              </form>
            ) : (
              <button
                type="button"
                disabled
                title="A photo needs at least one caption. Delete the photo instead."
                className="cursor-not-allowed rounded-full px-3 py-1.5 text-sm font-medium text-zinc-400 dark:text-zinc-600"
              >
                Delete
                {/* A title isn't read out, and a disabled button can't be focused to hear it. */}
                <span className="sr-only"> (a photo needs at least one caption; delete the photo instead)</span>
              </button>
            )}
          </div>
        </div>

        {/* "Saved" only until the next edit; errors stay until fixed. */}
        {(saveState.status === "error" || !dirty) && <ActionMessage state={saveState} className="mt-2" />}
        <ActionMessage state={deleteState} className="mt-2" />
      </div>
    </li>
  );
}

// A new caption takes the first free position and starts with no votes.
export function AddCaptionForm({ generationId, position }: { generationId: number; position: number }) {
  const [text, setText] = useState("");
  const add = addCaption.bind(null, generationId);
  const [state, formAction, pending] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await add(prev, formData);
      if (result.status === "success") setText("");
      return result;
    },
    IDLE,
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // A second Enter while the first is saving would add the caption twice.
    if (pending || !tidyText(text)) return;
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 pt-4">
      <span
        aria-hidden
        className="mt-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed border-zinc-300 text-xs font-semibold tabular-nums text-zinc-400 dark:border-zinc-700"
      >
        {position}
      </span>
      <div className="min-w-0 flex-1">
        <label className="sr-only" htmlFor={`new-caption-${generationId}`}>
          New caption
        </label>
        <textarea
          id={`new-caption-${generationId}`}
          name="text"
          rows={3}
          required
          maxLength={CAPTION_MAX_LENGTH}
          placeholder="Write another caption…"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={submitOnEnter}
          className={textareaClass}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            <Counter length={tidyText(text).length} /> · starts at 0 votes
          </span>
          <button
            type="submit"
            disabled={pending || !tidyText(text)}
            className="rounded-full bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Adding…" : "+ Add caption"}
          </button>
        </div>
        <ActionMessage state={state} className="mt-2" />
      </div>
    </form>
  );
}
