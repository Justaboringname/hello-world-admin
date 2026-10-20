// What a form's Server Action returns to useActionState.
export type ActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const IDLE: ActionState = { status: "idle" };
