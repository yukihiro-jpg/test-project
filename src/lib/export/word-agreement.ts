// 遺産分割協議書 Word生成

import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  type IRunOptions, type IParagraphOptions,
} from 'docx';
import { saveAs } from 'file-saver';
import type { Case } from '@/types';
import { toWareki } from '@/lib/dates/wareki';
import { RELATIONSHIP_LABELS } from '@/types';

function text(content: string, options?: Partial<IRunOptions>): TextRun {
  return new TextRun({ text: content, font: 'MS Mincho', size: 24, ...options });
}

function paragraph(content: string, options?: Partial<IParagraphOptions>): Paragraph {
  return new Paragraph({
    children: [text(content)],
    spacing: { after: 200 },
    ...options,
  });
}

/**
 * 遺産分割協議書をWord形式で生成
 */
export async function exportDivisionAgreement(caseData: Case) {
  const { decedent, heirs, assets, division, referenceDate } = caseData;
  const deathDateWareki = decedent.deathDate ? toWareki(decedent.deathDate) : '　年　月　日';

  const sections: Paragraph[] = [];

  // タイトル
  sections.push(new Paragraph({
    children: [text('遺産分割協議書', { bold: true, size: 36 })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
  }));

  // 前文
  sections.push(paragraph(
    `被相続人　${decedent.name || '（氏名）'}（${deathDateWareki}死亡）の遺産について、` +
    `共同相続人全員で協議を行った結果、次のとおり遺産を分割することに合意した。`
  ));

  sections.push(new Paragraph({ spacing: { after: 200 } }));

  // 各相続人の取得財産
  const heirAmounts = new Map<string, number>();
  for (const entry of division.entries) {
    const current = heirAmounts.get(entry.heirId) || 0;
    heirAmounts.set(entry.heirId, current + (entry.amount || 0));
  }

  let articleNum = 1;

  // 土地
  if (assets.lands.length > 0) {
    sections.push(paragraph(`第${articleNum}条（土地）`, { spacing: { before: 200 } }));
    assets.lands.forEach((land, i) => {
      sections.push(paragraph(
        `  ${i + 1}. 所在地: ${land.location}　地番: ${land.landNumber}　` +
        `地目: ${land.landCategory}　地積: ${land.area}㎡`
      ));
    });
    articleNum++;
  }

  // 建物
  if (assets.buildings.length > 0) {
    sections.push(paragraph(`第${articleNum}条（建物）`, { spacing: { before: 200 } }));
    assets.buildings.forEach((b, i) => {
      sections.push(paragraph(
        `  ${i + 1}. 所在地: ${b.location}　構造: ${b.structureType}　用途: ${b.usage}`
      ));
    });
    articleNum++;
  }

  // 現金預金
  if (assets.cashDeposits.length > 0) {
    sections.push(paragraph(`第${articleNum}条（預貯金）`, { spacing: { before: 200 } }));
    assets.cashDeposits.forEach((c, i) => {
      sections.push(paragraph(
        `  ${i + 1}. ${c.institutionName}　${c.accountType}　${c.balance.toLocaleString()}円`
      ));
    });
    articleNum++;
  }

  // 株式
  if (assets.listedStocks.length > 0 || assets.unlistedStocks.length > 0) {
    sections.push(paragraph(`第${articleNum}条（有価証券）`, { spacing: { before: 200 } }));
    assets.listedStocks.forEach((s, i) => {
      sections.push(paragraph(
        `  ${i + 1}. ${s.companyName}（${s.stockCode}）　${s.shares.toLocaleString()}株`
      ));
    });
    assets.unlistedStocks.forEach((s, i) => {
      sections.push(paragraph(
        `  ${assets.listedStocks.length + i + 1}. ${s.companyName}　${s.sharesOwned.toLocaleString()}株`
      ));
    });
    articleNum++;
  }

  // 分割方法
  sections.push(paragraph(`第${articleNum}条（分割方法）`, { spacing: { before: 200 } }));
  heirs.forEach(heir => {
    const amount = heirAmounts.get(heir.id) || 0;
    sections.push(paragraph(
      `  ${heir.name || '（氏名）'}（${RELATIONSHIP_LABELS[heir.relationship]}）は、` +
      `上記遺産のうち${amount.toLocaleString()}円相当額の財産を取得する。`
    ));
  });
  articleNum++;

  // 代償分割金
  if (assets.compensationPayments.length > 0) {
    sections.push(paragraph(`第${articleNum}条（代償金）`, { spacing: { before: 200 } }));
    assets.compensationPayments.forEach(comp => {
      const payer = heirs.find(h => h.id === comp.payerHeirId);
      const receiver = heirs.find(h => h.id === comp.receiverHeirId);
      sections.push(paragraph(
        `  ${payer?.name || ''}は、${receiver?.name || ''}に対し、代償金として` +
        `${comp.amount.toLocaleString()}円を支払う。`
      ));
    });
    articleNum++;
  }

  // 後文
  sections.push(new Paragraph({ spacing: { after: 200 } }));
  sections.push(paragraph(
    '以上のとおり、相続人全員による遺産分割協議が成立したことを証するため、' +
    'この協議書を作成し、各自署名押印の上、各1通を保有する。'
  ));

  // 日付
  sections.push(new Paragraph({ spacing: { after: 400 } }));
  sections.push(paragraph('　　年　　月　　日', { alignment: AlignmentType.RIGHT }));

  // 相続人署名欄
  sections.push(new Paragraph({ spacing: { after: 200 } }));
  heirs.forEach(heir => {
    sections.push(new Paragraph({ spacing: { after: 100 } }));
    sections.push(paragraph(`住所: ${heir.address || '　　　　　　　　　　　　　　　　　　'}`, { alignment: AlignmentType.LEFT }));
    sections.push(paragraph(`氏名: ${heir.name || '　　　　　　　　'}　　　　　印`, { alignment: AlignmentType.LEFT }));
    sections.push(new Paragraph({
      children: [text(`（${RELATIONSHIP_LABELS[heir.relationship]}）`, { size: 20, color: '666666' })],
      spacing: { after: 300 },
    }));
  });

  const doc = new Document({
    sections: [{ children: sections }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `遺産分割協議書_${decedent.name || '未入力'}.docx`);
}
