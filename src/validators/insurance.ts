import { z } from "zod";

export const insuranceSchema = z.object({
  company: z.string().optional().nullable(),
  policyNumber: z.string().optional().nullable(),
  insuranceType: z.string().default("終身保険"),
  premiumPayer: z.string().optional().nullable(),
  insuredPerson: z.string().optional().nullable(),
  beneficiaryId: z.string().optional().nullable(),
  amount: z.coerce.number().int().min(0).default(0),
  isTaxExemptTarget: z.boolean().default(true),
  note: z.string().optional().nullable(),
  displayOrder: z.coerce.number().int().default(0),
});

export type InsuranceFormData = z.infer<typeof insuranceSchema>;

export const INSURANCE_TYPE_OPTIONS = [
  "終身保険", "定期保険", "養老保険", "個人年金保険", "その他",
] as const;
