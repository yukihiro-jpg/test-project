import { z } from "zod";

export const caseSchema = z.object({
  code: z.string().min(1, "コードは必須です"),
  name: z.string().min(1, "氏名は必須です"),
  nameKana: z.string().min(1, "フリガナは必須です"),
  birthDate: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email("メールアドレスの形式が正しくありません").optional().nullable().or(z.literal("")),
  note: z.string().optional().nullable(),
});

export type CaseFormData = z.infer<typeof caseSchema>;
