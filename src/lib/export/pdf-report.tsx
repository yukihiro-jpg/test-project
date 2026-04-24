// PDF報告書生成（@react-pdf/renderer）- プレミアムデザイン版

'use client';

import { Document, Page, Text, View, StyleSheet, Font, pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import type { Case, TaxCalculationResult } from '@/types';
import { RELATIONSHIP_LABELS } from '@/types';
import { toWareki } from '@/lib/dates/wareki';

// 日本語フォント登録
Font.register({
  family: 'NotoSansJP',
  src: '/fonts/NotoSansJP-Regular.ttf',
});

// ─── Design tokens ───────────────────────────────────────────
const NAVY = '#1F4E79';
const GOLD = '#D4AF37';
const LIGHT_GOLD = '#FFF8E7';
const LIGHT_GRAY = '#F5F5F5';
const DARK_TEXT = '#1a1a1a';
const GRAY_TEXT = '#666666';
const WHITE = '#FFFFFF';

const PAGE_PADDING = 50;

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  /* ── Shared ── */
  page: {
    padding: PAGE_PADDING,
    fontSize: 10,
    fontFamily: 'NotoSansJP',
    backgroundColor: WHITE,
    position: 'relative',
  },
  pageFooter: {
    position: 'absolute',
    bottom: 30,
    left: PAGE_PADDING,
    right: PAGE_PADDING,
    fontSize: 7,
    color: '#aaaaaa',
    textAlign: 'center',
    borderTopWidth: 0.5,
    borderTopColor: '#dddddd',
    paddingTop: 6,
  },

  /* ── Page 1: Cover ── */
  coverNavyBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 90,
    backgroundColor: NAVY,
  },
  coverContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: NAVY,
    letterSpacing: 4,
    textAlign: 'center',
  },
  coverGoldLine: {
    width: 120,
    height: 2,
    backgroundColor: GOLD,
    marginVertical: 16,
  },
  coverSubtitle: {
    fontSize: 13,
    color: GOLD,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 40,
  },
  coverDecedentLabel: {
    fontSize: 10,
    color: GRAY_TEXT,
    textAlign: 'center',
    marginBottom: 4,
  },
  coverDecedentName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: DARK_TEXT,
    textAlign: 'center',
    marginBottom: 32,
  },
  coverDateRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 6,
  },
  coverDateLabel: {
    fontSize: 9,
    color: GRAY_TEXT,
    width: 80,
    textAlign: 'right',
    marginRight: 8,
  },
  coverDateValue: {
    fontSize: 9,
    color: DARK_TEXT,
    width: 160,
  },
  coverDisclaimer: {
    position: 'absolute',
    bottom: 50,
    left: PAGE_PADDING,
    right: PAGE_PADDING,
    fontSize: 8,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 1.6,
    borderTopWidth: 0.5,
    borderTopColor: '#dddddd',
    paddingTop: 12,
  },

  /* ── Page 2: Summary ── */
  sectionHeader: {
    backgroundColor: NAVY,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 28,
  },
  sectionHeaderText: {
    color: WHITE,
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  card: {
    width: '48%',
    borderWidth: 1.5,
    borderColor: NAVY,
    borderRadius: 4,
    padding: 16,
    marginBottom: 14,
    backgroundColor: WHITE,
  },
  cardLabel: {
    fontSize: 9,
    color: GRAY_TEXT,
    marginBottom: 6,
  },
  cardValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: DARK_TEXT,
    textAlign: 'right',
  },
  cardUnit: {
    fontSize: 10,
    color: GRAY_TEXT,
  },
  goldCard: {
    width: '48%',
    borderWidth: 2,
    borderColor: GOLD,
    borderRadius: 4,
    padding: 16,
    marginBottom: 14,
    backgroundColor: LIGHT_GOLD,
  },
  goldCardValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: NAVY,
    textAlign: 'right',
  },
  effectiveTaxBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LIGHT_GRAY,
    borderRadius: 4,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 8,
  },
  effectiveTaxLabel: {
    fontSize: 11,
    color: GRAY_TEXT,
    marginRight: 16,
  },
  effectiveTaxValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: NAVY,
  },
  detailSection: {
    marginTop: 24,
  },
  detailTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: NAVY,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: NAVY,
    paddingBottom: 4,
  },
  detailRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e0e0e0',
  },
  detailLabel: {
    width: '55%',
    fontSize: 9,
    color: GRAY_TEXT,
  },
  detailValue: {
    width: '45%',
    fontSize: 9,
    color: DARK_TEXT,
    textAlign: 'right',
  },

  /* ── Page 3: Heir table ── */
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: NAVY,
    paddingVertical: 7,
    paddingHorizontal: 4,
  },
  tableHeaderText: {
    color: WHITE,
    fontSize: 8,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e0e0e0',
  },
  tableRowAlt: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e0e0e0',
    backgroundColor: LIGHT_GRAY,
  },
  cell: {
    fontSize: 8,
    color: DARK_TEXT,
    paddingHorizontal: 3,
  },
  totalRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: LIGHT_GOLD,
    borderTopWidth: 2,
    borderTopColor: GOLD,
  },
  totalCell: {
    fontSize: 9,
    fontWeight: 'bold',
    color: NAVY,
    paddingHorizontal: 3,
  },
  deductionSection: {
    marginTop: 28,
  },
  deductionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: NAVY,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: NAVY,
    paddingBottom: 4,
  },
});

// ─── Helpers ─────────────────────────────────────────────────
function formatNum(n: number): string {
  return n.toLocaleString('ja-JP');
}

function formatYen(n: number): string {
  return `${formatNum(n)}円`;
}

// ─── Report props ────────────────────────────────────────────
interface ReportProps {
  caseData: Case;
  result: TaxCalculationResult;
}

// ─── Component ───────────────────────────────────────────────
function SimulationReport({ caseData, result }: ReportProps) {
  const { decedent, heirs, referenceDate } = caseData;
  const totalFinalTax = result.heirTaxDetails.reduce((s, h) => s + h.finalTax, 0);
  const referenceDateWareki = toWareki(referenceDate);
  const creationDateWareki = toWareki(new Date().toISOString().slice(0, 10));

  const effectiveTaxRate =
    result.netTaxableValue > 0
      ? ((totalFinalTax / result.netTaxableValue) * 100).toFixed(2)
      : '0.00';

  const hasDeductions = result.heirTaxDetails.some(
    (d) => d.spouseDeduction > 0 || d.minorDeduction > 0 || d.disabilityDeduction > 0,
  );

  return (
    <Document>
      {/* ════════════════════════════════════════════════════════
          Page 1: 表紙
          ════════════════════════════════════════════════════════ */}
      <Page size="A4" style={[styles.page, { padding: 0 }]}>
        {/* Navy bar at top */}
        <View style={styles.coverNavyBar} />

        {/* Center block */}
        <View style={styles.coverContent}>
          <Text style={styles.coverTitle}>相続税シミュレーション</Text>
          <Text style={styles.coverTitle}>報告書</Text>

          <View style={styles.coverGoldLine} />

          <Text style={styles.coverSubtitle}>財産診断書</Text>

          <Text style={styles.coverDecedentLabel}>被相続人</Text>
          <Text style={styles.coverDecedentName}>
            {decedent.name || '（未入力）'}
          </Text>

          <View style={styles.coverDateRow}>
            <Text style={styles.coverDateLabel}>基準日</Text>
            <Text style={styles.coverDateValue}>{referenceDateWareki}</Text>
          </View>
          <View style={styles.coverDateRow}>
            <Text style={styles.coverDateLabel}>作成日</Text>
            <Text style={styles.coverDateValue}>{creationDateWareki}</Text>
          </View>
        </View>

        {/* Disclaimer */}
        <Text style={styles.coverDisclaimer}>
          本書は参考資料です。正確な税額は税理士にご確認ください。
        </Text>
      </Page>

      {/* ════════════════════════════════════════════════════════
          Page 2: 計算概要（サマリー）
          ════════════════════════════════════════════════════════ */}
      <Page size="A4" style={styles.page}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>計算概要</Text>
        </View>

        {/* 2x2 card grid */}
        <View style={styles.cardGrid}>
          {/* 財産総額 */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>財産総額</Text>
            <Text style={styles.cardValue}>
              {formatNum(result.totalAssetValue)}
              <Text style={styles.cardUnit}> 円</Text>
            </Text>
          </View>

          {/* 課税価格合計 */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>課税価格合計</Text>
            <Text style={styles.cardValue}>
              {formatNum(result.netTaxableValue)}
              <Text style={styles.cardUnit}> 円</Text>
            </Text>
          </View>

          {/* 基礎控除額 */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>基礎控除額</Text>
            <Text style={styles.cardValue}>
              {formatNum(result.basicDeduction)}
              <Text style={styles.cardUnit}> 円</Text>
            </Text>
          </View>

          {/* 相続税の総額 — gold accent */}
          <View style={styles.goldCard}>
            <Text style={styles.cardLabel}>相続税の総額</Text>
            <Text style={styles.goldCardValue}>
              {formatNum(result.totalInheritanceTax)}
              <Text style={styles.cardUnit}> 円</Text>
            </Text>
          </View>
        </View>

        {/* Effective tax rate */}
        <View style={styles.effectiveTaxBlock}>
          <Text style={styles.effectiveTaxLabel}>実効税率</Text>
          <Text style={styles.effectiveTaxValue}>{effectiveTaxRate}%</Text>
        </View>

        {/* Detail breakdown */}
        <View style={styles.detailSection}>
          <Text style={styles.detailTitle}>内訳</Text>
          {(
            [
              ['財産総額（保険金含む）', result.totalAssetValue],
              ['債務・葬式費用合計', result.totalDeductions],
              ['保険金非課税枠', result.insuranceExemption],
              ['退職金非課税枠', result.retirementExemption],
              ['課税価格合計', result.netTaxableValue],
              ['基礎控除額', result.basicDeduction],
              ['課税遺産総額', result.taxableAmount],
              ['相続税の総額', result.totalInheritanceTax],
            ] as [string, number][]
          ).map(([label, value]) => (
            <View key={label} style={styles.detailRow}>
              <Text style={styles.detailLabel}>{label}</Text>
              <Text style={styles.detailValue}>{formatYen(value)}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.pageFooter}>相続税シミュレーション報告書</Text>
      </Page>

      {/* ════════════════════════════════════════════════════════
          Page 3: 各相続人の相続税額
          ════════════════════════════════════════════════════════ */}
      <Page size="A4" style={styles.page}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>各相続人の相続税額</Text>
        </View>

        {/* Table header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, { width: '14%', paddingHorizontal: 3 }]}>氏名</Text>
          <Text style={[styles.tableHeaderText, { width: '10%', paddingHorizontal: 3 }]}>続柄</Text>
          <Text style={[styles.tableHeaderText, { width: '16%', textAlign: 'right', paddingHorizontal: 3 }]}>取得額</Text>
          <Text style={[styles.tableHeaderText, { width: '10%', textAlign: 'right', paddingHorizontal: 3 }]}>法定相続分</Text>
          <Text style={[styles.tableHeaderText, { width: '16%', textAlign: 'right', paddingHorizontal: 3 }]}>按分税額</Text>
          <Text style={[styles.tableHeaderText, { width: '16%', textAlign: 'right', paddingHorizontal: 3 }]}>税額控除</Text>
          <Text style={[styles.tableHeaderText, { width: '18%', textAlign: 'right', paddingHorizontal: 3 }]}>納付税額</Text>
        </View>

        {/* Table rows */}
        {result.heirTaxDetails.map((d, idx) => {
          const heir = heirs.find((h) => h.id === d.heirId);
          const totalDeductions =
            d.spouseDeduction + d.minorDeduction + d.disabilityDeduction;
          const rowStyle = idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt;

          return (
            <View key={d.heirId} style={rowStyle}>
              <Text style={[styles.cell, { width: '14%' }]}>{d.heirName}</Text>
              <Text style={[styles.cell, { width: '10%' }]}>
                {heir ? RELATIONSHIP_LABELS[heir.relationship] : ''}
              </Text>
              <Text style={[styles.cell, { width: '16%', textAlign: 'right' }]}>
                {formatNum(d.acquiredValue)}
              </Text>
              <Text style={[styles.cell, { width: '10%', textAlign: 'right' }]}>
                {(d.legalShareRatio * 100).toFixed(1)}%
              </Text>
              <Text style={[styles.cell, { width: '16%', textAlign: 'right' }]}>
                {formatNum(d.allocatedTax)}
              </Text>
              <Text style={[styles.cell, { width: '16%', textAlign: 'right' }]}>
                {formatNum(totalDeductions)}
              </Text>
              <Text
                style={[
                  styles.cell,
                  { width: '18%', textAlign: 'right', fontWeight: 'bold' },
                ]}
              >
                {formatYen(d.finalTax)}
              </Text>
            </View>
          );
        })}

        {/* Total row */}
        <View style={styles.totalRow}>
          <Text style={[styles.totalCell, { width: '66%' }]}>納付税額合計</Text>
          <Text style={[styles.totalCell, { width: '16%' }]} />
          <Text style={[styles.totalCell, { width: '18%', textAlign: 'right', fontSize: 11 }]}>
            {formatYen(totalFinalTax)}
          </Text>
        </View>

        {/* Deduction detail section (if applicable) */}
        {hasDeductions && (
          <View style={styles.deductionSection}>
            <Text style={styles.deductionTitle}>税額控除の内訳</Text>

            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { width: '25%', paddingHorizontal: 3 }]}>氏名</Text>
              <Text style={[styles.tableHeaderText, { width: '25%', textAlign: 'right', paddingHorizontal: 3 }]}>
                配偶者控除
              </Text>
              <Text style={[styles.tableHeaderText, { width: '25%', textAlign: 'right', paddingHorizontal: 3 }]}>
                未成年者控除
              </Text>
              <Text style={[styles.tableHeaderText, { width: '25%', textAlign: 'right', paddingHorizontal: 3 }]}>
                障害者控除
              </Text>
            </View>

            {result.heirTaxDetails
              .filter(
                (d) =>
                  d.spouseDeduction > 0 ||
                  d.minorDeduction > 0 ||
                  d.disabilityDeduction > 0,
              )
              .map((d, idx) => (
                <View
                  key={d.heirId}
                  style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
                >
                  <Text style={[styles.cell, { width: '25%' }]}>{d.heirName}</Text>
                  <Text style={[styles.cell, { width: '25%', textAlign: 'right' }]}>
                    {d.spouseDeduction > 0 ? formatYen(d.spouseDeduction) : '—'}
                  </Text>
                  <Text style={[styles.cell, { width: '25%', textAlign: 'right' }]}>
                    {d.minorDeduction > 0 ? formatYen(d.minorDeduction) : '—'}
                  </Text>
                  <Text style={[styles.cell, { width: '25%', textAlign: 'right' }]}>
                    {d.disabilityDeduction > 0 ? formatYen(d.disabilityDeduction) : '—'}
                  </Text>
                </View>
              ))}
          </View>
        )}

        <Text style={styles.pageFooter}>相続税シミュレーション報告書</Text>
      </Page>
    </Document>
  );
}

/**
 * シミュレーション結果PDFのBlobを生成（アップロード用）
 */
export async function generateSimulationPdfBlob(
  caseData: Case,
  result: TaxCalculationResult,
): Promise<Blob> {
  return pdf(<SimulationReport caseData={caseData} result={result} />).toBlob();
}

/**
 * シミュレーション結果PDFをダウンロード
 */
export async function exportSimulationPdf(
  caseData: Case,
  result: TaxCalculationResult,
) {
  const blob = await generateSimulationPdfBlob(caseData, result);
  saveAs(
    blob,
    `相続税シミュレーション報告書_${caseData.decedent.name || '未入力'}.pdf`,
  );
}
