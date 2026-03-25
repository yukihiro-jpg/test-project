import { z } from "zod";

export const annualGiftSchema = z.object({
  recipientName: z.string().optional().nullable(),
  giftDate: z.string().optional().nullable(),
  giftType: z.string().optional().nullable(),
  subType: z.string().optional().nullable(),
  giftValue: z.coerce.number().int().min(0).default(0),
  paidGiftTax: z.coerce.number().int().min(0).default(0),
  isAddBack: z.boolean().default(true),
  note: z.string().optional().nullable(),
  displayOrder: z.coerce.number().int().default(0),
});

export type AnnualGiftFormData = z.infer<typeof annualGiftSchema>;
