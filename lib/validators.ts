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
