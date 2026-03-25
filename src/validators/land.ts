import { z } from "zod";

export const landSchema = z.object({
  landType: z.string().default("宅地"),
  location: z.string().optional().nullable(),
  usage: z.string().optional().nullable(),
  area: z.coerce.number().min(0, "面積は0以上です").default(0),
  valuationMethod: z.enum(["路線価方式", "倍率方式"]).default("路線価方式"),
  rosenka: z.coerce.number().int().min(0).default(0),
  fixedAssetTaxValue: z.coerce.number().int().min(0).default(0),
  multiplier: z.coerce.number().min(0).default(1.0),
  ownershipShareNum: z.coerce.number().int().min(1).default(1),
  ownershipShareDen: z.coerce.number().int().min(1, "分母は1以上です").default(1),
  adjustmentCoeff: z.coerce.number().min(0).default(1.0),
  autoCalc: z.boolean().default(true),
  evaluationAmount: z.coerce.number().int().min(0).default(0),
  smallLandReduction: z.boolean().default(false),
  urlMemo: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  displayOrder: z.coerce.number().int().default(0),
});

export type LandFormData = z.infer<typeof landSchema>;

export const LAND_TYPE_OPTIONS = [
  "宅地", "田", "畑", "山林", "原野", "雑種地", "その他",
] as const;
