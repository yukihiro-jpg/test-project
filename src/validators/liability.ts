import { z } from "zod";

export const liabilitySchema = z.object({
  liabilityType: z.string().default("債務"),
  subType: z.string().optional().nullable(),
  creditorName: z.string().optional().nullable(),
  creditorAddress: z.string().optional().nullable(),
  amount: z.coerce.number().int().min(0, "金額は0以上です").default(0),
  note: z.string().optional().nullable(),
  displayOrder: z.coerce.number().int().default(0),
});

export type LiabilityFormData = z.infer<typeof liabilitySchema>;

export const LIABILITY_TYPE_OPTIONS = [
  "債務", "葬式費用",
] as const;
