export interface DocumentType {
  id: string
  label: string
}

export const DOCUMENT_TYPES: DocumentType[] = [
  { id: 'life_insurance', label: '生命保険料控除証明書' },
  { id: 'earthquake_insurance', label: '地震保険料控除証明書' },
  { id: 'national_pension', label: '国民年金保険料控除証明書' },
  { id: 'national_health_insurance', label: '国民健康保険の支払証明' },
  { id: 'small_business_mutual_aid', label: '小規模企業共済掛金払込証明書' },
  { id: 'ideco', label: 'iDeCo掛金払込証明書' },
  { id: 'housing_loan_deduction', label: '住宅借入金等特別控除申告書' },
  { id: 'housing_loan_balance', label: '住宅取得資金に係る借入金の年末残高証明書' },
  { id: 'previous_employer', label: '前職の源泉徴収票' },
]

export function getDocumentLabel(id: string): string {
  return DOCUMENT_TYPES.find((d) => d.id === id)?.label ?? id
}
