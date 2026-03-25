import { z } from "zod";

export const depositSchema = z.object({
  institution: z.string().optional().nullable(),
  depositType: z.string().default("普通預金"),
  accountNumber: z.string().optional().nullable(),
  amount: z.coerce.number().int().min(0, "金額は0以上です").default(0),
  note: z.string().optional().nullable(),
  displayOrder: z.coerce.number().int().default(0),
});

export type DepositFormData = z.infer<typeof depositSchema>;

export const DEPOSIT_TYPE_OPTIONS = [
  "普通預金", "定期預金", "当座預金", "貯蓄預金", "現金", "その他",
] as const;
