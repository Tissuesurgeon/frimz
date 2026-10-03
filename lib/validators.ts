import { z } from "zod";

export const emailSchema = z.string().trim().email().max(200);
export const passwordSchema = z.string().min(8).max(200);
export const displayNameSchema = z.string().trim().min(1).max(80);
export const chatMessageSchema = z.string().trim().min(1).max(20000);
export const modeSchema = z.enum(["think", "plan", "write", "challenge"]);

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: displayNameSchema,
});

export const idSchema = z.string().uuid();

const briefText = z.string().max(2000).optional();
const briefList = z.array(z.string().max(1000)).max(30).optional();
const briefItems = z
  .array(z.object({ text: z.string().max(1000), reason: z.string().max(1000).optional() }))
  .max(30)
  .optional();

export const briefEditSchema = z.object({
  baseVersion: z.number().int().min(0),
  data: z
    .object({
      context: briefText,
      problem: briefText,
      targetUser: briefText,
      goal: briefText,
      currentIdea: briefText,
      currentDirection: briefText,
      keyInsights: briefList,
      assumptions: briefList,
      openQuestions: briefList,
      nextAreasToExplore: briefList,
      relevantHistory: briefList,
      decisions: briefItems,
      rejectedDirections: briefItems,
    })
    .strict(),
});

export const briefRegenerateSchema = z.object({ conversationId: idSchema.optional() });

export const memoryEditSchema = z.object({
  type: z.enum([
    "user_preference",
    "idea",
    "decision",
    "rejection",
    "insight",
    "open_question",
    "idea_change",
  ]),
  content: z.string().trim().min(12).max(2000),
  reason: z.string().trim().max(1000).optional(),
});
