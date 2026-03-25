import { z } from "zod";

export const securitySchema = z.object({
  institution: z.string().optional().nullable(),
  branch: z.string().optional().nullable(),
  securityType: z.string().default("株式"),
  name: z.string().optional().nullable(),
  unitPrice: z.coerce.number().int().min(0).default(0),
  quantity: z.coerce.number().min(0).default(0),
  adjustmentCoeff: z.coerce.number().min(0).default(1.0),
  autoCalc: z.boolean().default(true),
  amount: z.coerce.number().int().min(0).default(0),
  urlMemo: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  displayOrder: z.coerce.number().int().default(0),
});

export type SecurityFormData = z.infer<typeof securitySchema>;

export const SECURITY_TYPE_OPTIONS = [
  "株式", "投資信託", "公社債", "その他",
] as const;
