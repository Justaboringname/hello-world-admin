import type { ActionState } from "@/lib/action-state";

// What a form's last submit said. Errors interrupt (role="alert"); success is
// announced politely (role="status").
export function ActionMessage({ state, className = "" }: { state: ActionState; className?: string }) {
  if (state.status === "idle" || !state.message) return null;
  const isError = state.status === "error";

  return (
    <p
      role={isError ? "alert" : "status"}
      className={`text-sm ${
        isError ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"
      } ${className}`}
    >
      {isError ? "" : "✓ "}
      {state.message}
    </p>
  );
}
