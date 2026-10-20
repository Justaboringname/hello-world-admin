"use client";

import { useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";

const noSubscription = () => () => {};

// A submit button that asks first. For deletes: nothing in the admin panel can
// be undone.
export function ConfirmSubmit({
  children,
  message,
  pendingLabel,
  className = "",
}: {
  children: React.ReactNode;
  message: string;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  // false in the server HTML, true once hydrated. Until then a click would
  // submit the form without asking, so the button stays disabled.
  const hydrated = useSyncExternalStore(noSubscription, () => true, () => false);

  return (
    <button
      type="submit"
      disabled={pending || !hydrated}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
      className={`rounded-full text-sm font-medium transition disabled:cursor-wait disabled:opacity-60 ${className}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
