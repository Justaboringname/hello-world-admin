"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { ActionMessage } from "@/components/action-message";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { IDLE, type ActionState } from "@/lib/action-state";

// One form and one row component for every simple table in the panel (terms,
// examples, LLM models and providers, sign-up rules). The page describes the
// fields; the Server Actions check everything again, since a form is only a
// suggestion.

export type FieldSpec = {
  name: string;
  label: string;
  type?: "text" | "textarea" | "url" | "email" | "checkbox" | "select";
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
  hint?: string;
  // For selects. An empty value is "none" and only offered when not required.
  options?: { value: string; label: string }[];
  emptyOption?: string;
};

export type FieldValues = Record<string, string | boolean>;

type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const noSubscription = () => () => {};

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base font-normal focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 sm:text-sm dark:border-zinc-700 dark:bg-zinc-900";

function Field({ field, value, id }: { field: FieldSpec; value: string | boolean | undefined; id: string }) {
  const optional = !field.required && field.type !== "checkbox" && (
    <span className="font-normal text-zinc-500 dark:text-zinc-400"> (optional)</span>
  );
  const hint = field.hint && (
    <span id={`${id}-hint`} className="mt-1 block text-xs font-normal text-zinc-500 dark:text-zinc-400">
      {field.hint}
    </span>
  );
  const common = {
    id,
    name: field.name,
    required: field.required,
    "aria-describedby": field.hint ? `${id}-hint` : undefined,
  };

  if (field.type === "checkbox") {
    return (
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-800">
        <input
          {...common}
          type="checkbox"
          defaultChecked={value === true}
          className="mt-0.5 h-4 w-4 accent-blue-600"
        />
        <span>
          <span className="block font-medium">{field.label}</span>
          {hint}
        </span>
      </label>
    );
  }

  return (
    <label htmlFor={id} className="block text-sm font-medium">
      {field.label}
      {optional}
      {field.type === "textarea" ? (
        <textarea
          {...common}
          rows={3}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          defaultValue={typeof value === "string" ? value : ""}
          className={inputClass}
        />
      ) : field.type === "select" ? (
        <select {...common} defaultValue={typeof value === "string" ? value : ""} className={inputClass}>
          {!field.required && <option value="">{field.emptyOption ?? "None"}</option>}
          {field.required && !value && (
            <option value="" disabled>
              Choose…
            </option>
          )}
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...common}
          type={field.type ?? "text"}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          defaultValue={typeof value === "string" ? value : ""}
          className={inputClass}
        />
      )}
      {hint}
    </label>
  );
}

// Add or edit one record. Submitted by hand rather than through <form
// action>, which resets the form after every submit: a failed save keeps
// what was typed. A form that adds records clears itself after a success.
export function RecordForm({
  fields,
  values = {},
  action,
  submitLabel,
  pendingLabel,
  clearOnSuccess = false,
  onSaved,
  onCancel,
}: {
  fields: FieldSpec[];
  values?: FieldValues;
  action: FormAction;
  submitLabel: string;
  pendingLabel: string;
  clearOnSuccess?: boolean;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(action, IDLE);
  // false in the server HTML, true once hydrated. Before that, submitting
  // would be a plain GET that puts the typed values in the URL, so the
  // button (and with it Enter) waits, like ConfirmSubmit.
  const hydrated = useSyncExternalStore(noSubscription, () => true, () => false);

  useEffect(() => {
    if (state.status !== "success") return;
    if (clearOnSuccess) formRef.current?.reset();
    onSaved?.();
    // Only when a new result arrives, not when the callbacks change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
      {fields.map((field) => (
        <Field key={field.name} field={field} value={values[field.name]} id={`${id}-${field.name}`} />
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || !hydrated}
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-wait disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? pendingLabel : submitLabel}
        </button>
        {onCancel && !pending && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        )}
      </div>
      <ActionMessage state={state} />
    </form>
  );
}

// One record in a list: what the page renders for it, with Edit (the same
// form, filled in) and Delete (after a confirm).
export function RecordItem({
  children,
  fields,
  values,
  updateAction,
  deleteAction,
  deleteMessage,
}: {
  children: React.ReactNode;
  fields: FieldSpec[];
  values: FieldValues;
  updateAction: FormAction;
  deleteAction: (prev: ActionState) => Promise<ActionState>;
  deleteMessage: string;
}) {
  const [editing, setEditing] = useState(false);
  // Which result to show under the row: "Saved." after an edit, or what the
  // last delete said. useActionState can't be cleared, so this decides.
  const [lastResult, setLastResult] = useState<"saved" | "delete" | null>(null);
  const [deleteState, deleteFormAction] = useActionState(deleteAction, IDLE);

  return (
    <li className="py-4 first:pt-0 last:pb-0">
      {editing ? (
        <RecordForm
          fields={fields}
          values={values}
          action={updateAction}
          submitLabel="Save changes"
          pendingLabel="Saving…"
          onSaved={() => {
            setEditing(false);
            setLastResult("saved");
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">{children}</div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setLastResult(null);
                setEditing(true);
              }}
              className="rounded-full px-3 py-1.5 text-sm font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-100 dark:text-zinc-300 dark:ring-zinc-800 dark:hover:bg-zinc-800"
            >
              Edit
            </button>
            {/* ConfirmSubmit cancels the click when the admin says no, so this
                only runs for a delete that's really sent. */}
            <form action={deleteFormAction} onSubmit={() => setLastResult("delete")}>
              <ConfirmSubmit
                message={deleteMessage}
                pendingLabel="Deleting…"
                className="px-3 py-1.5 text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                Delete
              </ConfirmSubmit>
            </form>
          </div>
        </div>
      )}
      {!editing && lastResult === "saved" && (
        <ActionMessage state={{ status: "success", message: "Saved." }} className="mt-2" />
      )}
      {!editing && lastResult === "delete" && <ActionMessage state={deleteState} className="mt-2" />}
    </li>
  );
}

// The list around RecordItems, divided like the other admin tables.
export function RecordList({ children }: { children: React.ReactNode }) {
  return <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">{children}</ul>;
}
