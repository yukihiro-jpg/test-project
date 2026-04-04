export interface DecedentInfo {
  /** 被相続人氏名 */
  name: string;
  /** 死亡日 (YYYY-MM-DD) */
  dateOfDeath: string;
  /** 契約者（保険料負担者）氏名 */
  contractHolder: string;
  /** 被保険者氏名 */
  insuredPerson: string;
  /** 法定相続人数 */
  numberOfLegalHeirs: number;
}
