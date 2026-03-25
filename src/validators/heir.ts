import { z } from "zod";

export const heirSchema = z.object({
  name: z.string().min(1, "氏名は必須です"),
  nameKana: z.string().optional().nullable(),
  relationship: z.string().min(1, "続柄は必須です"),
  acquisitionCause: z.string().default("相続"),
  civilLegalShareNum: z.coerce.number().int().min(0).default(0),
  civilLegalShareDen: z.coerce.number().int().min(1, "分母は1以上です").default(1),
  taxLegalShareNum: z.coerce.number().int().min(0).default(0),
  taxLegalShareDen: z.coerce.number().int().min(1, "分母は1以上です").default(1),
  twentyPercentAdd: z.boolean().default(false),
  isDisabled: z.boolean().default(false),
  disabilityType: z.string().optional().nullable(),
  birthDate: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  displayOrder: z.coerce.number().int().default(0),
});

export type HeirFormData = z.infer<typeof heirSchema>;

export const RELATIONSHIP_OPTIONS = [
  "配偶者", "長男", "長女", "次男", "次女", "三男", "三女",
  "父", "母", "兄弟姉妹", "甥姪", "孫", "その他",
] as const;

export const ACQUISITION_CAUSE_OPTIONS = [
  "相続", "遺贈", "相続時精算課税", "その他",
] as const;

export const DISABILITY_TYPE_OPTIONS = [
  "一般障害者", "特別障害者",
] as const;
