export type MutationErrorKey =
  | "mutations.blockedDuringRun"
  | "mutations.messageBlockedDuringRun"
  | "mutations.canvasFailed"
  | "mutations.messageFailed"
  | "mutations.cancelFailed";

export interface MutationError {
  key: MutationErrorKey;
  params?: Record<string, string | number>;
}

export const mutationErrors = {
  blockedDuringRun: (): MutationError => ({ key: "mutations.blockedDuringRun" }),
  messageBlockedDuringRun: (): MutationError => ({ key: "mutations.messageBlockedDuringRun" }),
  canvasFailed: (status: number): MutationError => ({
    key: "mutations.canvasFailed",
    params: { status },
  }),
  messageFailed: (status: number): MutationError => ({
    key: "mutations.messageFailed",
    params: { status },
  }),
  cancelFailed: (status: number): MutationError => ({
    key: "mutations.cancelFailed",
    params: { status },
  }),
} as const;
