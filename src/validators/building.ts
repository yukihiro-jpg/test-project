import { z } from "zod";

export const buildingSchema = z.object({
  subType: z.string().default("居宅"),
  usage: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  floorArea: z.coerce.number().min(0).default(0),
  fixedAssetTaxValue: z.coerce.number().int().min(0).default(0),
  ownershipShareNum: z.coerce.number().int().min(1).default(1),
  ownershipShareDen: z.coerce.number().int().min(1, "分母は1以上です").default(1),
  adjustmentCoeff: z.coerce.number().min(0).default(1.0),
  autoCalc: z.boolean().default(true),
  evaluationAmount: z.coerce.number().int().min(0).default(0),
  note: z.string().optional().nullable(),
  displayOrder: z.coerce.number().int().default(0),
});

export type BuildingFormData = z.infer<typeof buildingSchema>;

export const BUILDING_TYPE_OPTIONS = [
  "居宅", "店舗", "事務所", "工場", "倉庫", "共同住宅", "その他",
] as const;
