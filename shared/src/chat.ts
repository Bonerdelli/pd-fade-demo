import { z } from "zod";

export const chatUserMessageSchema = z.object({
  kind: z.literal("user"),
  id: z.string(),
  text: z.string(),
});

export const chatAssistantMessageSchema = z.object({
  kind: z.literal("assistant"),
  id: z.string(),
  text: z.string(),
});

export const chatToolCallStatusSchema = z.enum(["pending", "running", "ok", "error", "cancelled"]);

export const chatToolCallMessageSchema = z.object({
  kind: z.literal("toolCall"),
  id: z.string(),
  toolCallId: z.string(),
  name: z.string(),
  status: chatToolCallStatusSchema,
  args: z.unknown().optional(),
  result: z.unknown().optional(),
});

export const chatMessageSchema = z.discriminatedUnion("kind", [
  chatUserMessageSchema,
  chatAssistantMessageSchema,
  chatToolCallMessageSchema,
]);

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatToolCallStatus = z.infer<typeof chatToolCallStatusSchema>;
