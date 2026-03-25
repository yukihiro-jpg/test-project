import { z } from "zod";

export const partitionPlanSchema = z.object({
  title: z.string().min(1, "タイトルは必須です"),
  description: z.string().optional().nullable(),
});

export type PartitionPlanFormData = z.infer<typeof partitionPlanSchema>;

export const MAX_PARTITIONS_PER_DATASET = 5;

export const allocationSchema = z.object({
  heirId: z.string().min(1),
  assetType: z.string().min(1),
  assetId: z.string().min(1),
  amount: z.coerce.number().int().min(0).default(0),
});

export type AllocationFormData = z.infer<typeof allocationSchema>;
