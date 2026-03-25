import { z } from "zod";

export const datasetSchema = z.object({
  name: z.string().min(1, "データセット名は必須です"),
  baseDate: z.string().min(1, "基準日は必須です"),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
});

export type DatasetFormData = z.infer<typeof datasetSchema>;

export const MAX_DATASETS_PER_CASE = 20;
