// 節税シミュレーション結果 PDF生成（@react-pdf/renderer）

'use client';

import { Document, Page, Text, View, StyleSheet, Font, pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import type { Case } from '@/types';
import { calculateInheritanceTax } from '@/lib/tax/inheritance-tax';
import { simulateTaxSaving, STRATEGY_LABELS } from '@/lib/tax/tax-saving';
import { toWareki } from '@/lib/dates/wareki';

// 日本語フォント登録
try { Font.register({
  family: 'NotoSansJP',
  src: '/fonts/NotoSansJP-Regular.ttf',
}); } catch(e) { console.warn('Font registration failed:', e); }

// --- Premium color palette ---
const NAVY = '#1F4E79';
const GOLD = '#D4AF37';
const DARK_TEXT = '#1a202c';
const GRAY_TEXT = '#4a5568';
const LIGHT_GRAY = '#f7fafc';
const BORDER_GRAY = '#e2e8f0';
const GREEN = '#276749';
const LIGHT_GREEN = '#f0fff4';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: 'NotoSansJP',
    color: DARK_TEXT,
  },
  // --- Title ---
  title: {
    fontSize: 22,
    textAlign: 'center',
    fontWeight: 'bold',
    color: NAVY,
    marginBottom: 6,
  },
  titleSub: {
    fontSize: 10,
    textAlign: 'center',
    color: GRAY_TEXT,
    marginBottom: 24,
  },
  // --- Cards ---
  currentTaxCard: {
    backgroundColor: NAVY,
    borderRadius: 4,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  currentTaxLabel: {
    fontSize: 11,
    color: '#c0d4e8',
    marginBottom: 6,
  },
  currentTaxValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  // --- Section ---
  sectionHeader: {
    backgroundColor: NAVY,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 16,
    marginBottom: 6,
  },
  sectionHeaderText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  // --- Strategy rows ---
  strategyRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER_GRAY,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  strategyRowAlt: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER_GRAY,
    paddingVertical: 6,
    paddingHorizontal: 4,
    backgroundColor: LIGHT_GRAY,
  },
  strategyName: {
    width: '22%',
    fontSize: 9,
    fontWeight: 'bold',
    color: DARK_TEXT,
  },
  strategySaving: {
    width: '18%',
    fontSize: 9,
    textAlign: 'right',
    color: GREEN,
    fontWeight: 'bold',
  },
  strategyDetail: {
    width: '60%',
    fontSize: 7,
    color: GRAY_TEXT,
    paddingLeft: 8,
  },
  // --- Table header ---
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#e8eef4',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: NAVY,
  },
  tableHeaderText: {
    fontSize: 8,
    color: NAVY,
    fontWeight: 'bold',
  },
  // --- Summary boxes ---
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 4,
    padding: 12,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 9,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  // --- Bar visualization ---
  barContainer: {
    marginTop: 20,
    marginBottom: 8,
  },
  barLabel: {
    fontSize: 8,
    color: GRAY_TEXT,
    marginBottom: 3,
  },
  barTrack: {
    height: 20,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  barFill: {
    height: 20,
    borderRadius: 3,
  },
  barValueLabel: {
    fontSize: 7,
    marginTop: 2,
  },
  // --- No strategies message ---
  emptyMessage: {
    fontSize: 10,
    color: GRAY_TEXT,
    paddingVertical: 20,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // --- Footer ---
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 40,
    right: 40,
    fontSize: 7,
    color: '#a0aec0',
    textAlign: 'center',
  },
});

function formatNum(n: number): string {
  return n.toLocaleString('ja-JP');
}

function formatYenShort(amount: number): string {
  if (amount >= 100_000_000) {
    return `${(amount / 100_000_000).toFixed(1)}億円`;
  }
  if (amount >= 10_000) {
    return `${Math.floor(amount / 10_000).toLocaleString('ja-JP')}万円`;
  }
  return `${amount.toLocaleString('ja-JP')}円`;
}

interface Props {
  caseData: Case;
}

function TaxSavingReport({ caseData }: Props) {
  const { decedent, referenceDate } = caseData;
  const decedentName = decedent.name || '（未入力）';
  const referenceDateWareki = toWareki(referenceDate);

  // Run the tax saving simulation
  const strategies = caseData.taxSavingStrategies || [];
  const enabledStrategies = strategies.filter(s => s.enabled);
  const taxResult = calculateInheritanceTax(caseData);
  const totalTax = taxResult.heirTaxDetails.reduce((s, h) => s + h.finalTax, 0);

  // Run simulation if there are enabled strategies
  const hasStrategies = enabledStrategies.length > 0;
  const simResult = hasStrategies
    ? simulateTaxSaving(caseData, strategies)
    : null;

  const beforeTax = simResult?.beforeTax ?? totalTax;
  const afterTax = simResult?.afterTax ?? totalTax;
  const totalSaving = simResult?.totalSaving ?? 0;
  const strategyResults = simResult?.strategyResults ?? [];

  // Bar widths for comparison (percentage)
  const maxAmount = Math.max(beforeTax, 1);
  const beforeBarPct = 100;
  const afterBarPct = Math.round((afterTax / maxAmount) * 100);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Title */}
        <Text style={styles.title}>節税シミュレーション結果</Text>
        <Text style={styles.titleSub}>
          被相続人: {decedentName}　|　基準日: {referenceDateWareki}（{referenceDate}）
        </Text>

        {/* Current tax card */}
        <View style={styles.currentTaxCard}>
          <Text style={styles.currentTaxLabel}>対策前 相続税額</Text>
          <Text style={styles.currentTaxValue}>{formatNum(beforeTax)}円</Text>
        </View>

        {/* Strategy details */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>節税対策の効果一覧</Text>
        </View>

        {!hasStrategies ? (
          <Text style={styles.emptyMessage}>
            節税対策が設定されていません。節税シミュレーション画面で対策を追加してください。
          </Text>
        ) : (
          <>
            {/* Table header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { width: '22%' }]}>対策名</Text>
              <Text style={[styles.tableHeaderText, { width: '18%', textAlign: 'right' }]}>節税額</Text>
              <Text style={[styles.tableHeaderText, { width: '60%', paddingLeft: 8 }]}>詳細</Text>
            </View>

            {/* Strategy rows */}
            {strategyResults.map((sr, idx) => (
              <View key={sr.strategyId} style={idx % 2 === 0 ? styles.strategyRow : styles.strategyRowAlt}>
                <Text style={styles.strategyName}>{sr.label}</Text>
                <Text style={styles.strategySaving}>-{formatNum(sr.saving)}円</Text>
                <Text style={styles.strategyDetail}>{sr.detail}</Text>
              </View>
            ))}

            {/* Also show strategies with 0 saving if they're in the enabled list but had no result */}
          </>
        )}

        {/* Summary cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderColor: GOLD, backgroundColor: '#fffdf5' }]}>
            <Text style={[styles.summaryLabel, { color: GRAY_TEXT }]}>合計節税額</Text>
            <Text style={[styles.summaryValue, { color: GREEN }]}>
              -{formatNum(totalSaving)}円
            </Text>
          </View>
          <View style={[styles.summaryCard, { borderColor: NAVY, backgroundColor: '#f0f4f8' }]}>
            <Text style={[styles.summaryLabel, { color: GRAY_TEXT }]}>対策後 相続税額（推定）</Text>
            <Text style={[styles.summaryValue, { color: NAVY }]}>
              {formatNum(afterTax)}円
            </Text>
          </View>
        </View>

        {/* Comparison bar visualization */}
        <View style={styles.barContainer}>
          <Text style={[styles.sectionHeaderText, { color: NAVY, fontSize: 10, marginBottom: 10 }]}>
            税額比較
          </Text>

          {/* Before bar */}
          <Text style={styles.barLabel}>対策前</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, {
              width: `${beforeBarPct}%`,
              backgroundColor: '#c53030',
            }]} />
          </View>
          <Text style={[styles.barValueLabel, { color: '#c53030' }]}>
            {formatNum(beforeTax)}円（{formatYenShort(beforeTax)}）
          </Text>

          {/* After bar */}
          <Text style={[styles.barLabel, { marginTop: 10 }]}>対策後</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, {
              width: `${Math.max(afterBarPct, 1)}%`,
              backgroundColor: NAVY,
            }]} />
          </View>
          <Text style={[styles.barValueLabel, { color: NAVY }]}>
            {formatNum(afterTax)}円（{formatYenShort(afterTax)}）
          </Text>

          {/* Saving indicator */}
          {totalSaving > 0 && (
            <View style={{
              marginTop: 10,
              backgroundColor: LIGHT_GREEN,
              borderWidth: 1,
              borderColor: GREEN,
              borderRadius: 4,
              padding: 8,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <Text style={{ fontSize: 9, color: GREEN }}>
                削減額: {formatNum(totalSaving)}円（{formatYenShort(totalSaving)}）
              </Text>
              <Text style={{ fontSize: 9, color: GREEN, fontWeight: 'bold' }}>
                削減率: {beforeTax > 0 ? ((totalSaving / beforeTax) * 100).toFixed(1) : '0'}%
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.footer}>
          本シミュレーションは参考資料としてご利用ください。各対策の効果は独立して評価しており、対策間の相互影響は考慮しておりません。正確な効果の算定には税理士等の専門家にご相談ください。
        </Text>
      </Page>
    </Document>
  );
}

/**
 * 節税シミュレーション結果PDFをダウンロード
 */
export async function exportTaxSavingPdf(caseData: Case) {
  const blob = await pdf(<TaxSavingReport caseData={caseData} />).toBlob();
  saveAs(blob, `節税シミュレーション結果_${caseData.decedent.name || '未入力'}.pdf`);
}
