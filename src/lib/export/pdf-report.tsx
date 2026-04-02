// PDF報告書生成（@react-pdf/renderer）- 日本語対応版

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

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'NotoSansJP',
  },
  title: {
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: 'bold',
    color: '#1a365d',
  },
  titleSub: {
    fontSize: 10,
    textAlign: 'center',
    marginBottom: 24,
    color: '#666',
  },
  subtitle: {
    fontSize: 13,
    marginBottom: 8,
    marginTop: 16,
    fontWeight: 'bold',
    color: '#1a365d',
    borderBottomWidth: 2,
    borderBottomColor: '#2b6cb0',
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 5,
  },
  label: {
    width: '45%',
    color: '#4a5568',
  },
  value: {
    width: '55%',
    textAlign: 'right',
    color: '#1a202c',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#2b6cb0',
    paddingVertical: 5,
  },
  tableHeaderText: {
    color: '#ffffff',
    fontSize: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 4,
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 4,
    backgroundColor: '#f7fafc',
  },
  cell: {
    paddingHorizontal: 4,
    fontSize: 8,
  },
  totalRow: {
    flexDirection: 'row',
    borderTopWidth: 2,
    borderTopColor: '#2b6cb0',
    paddingVertical: 5,
    fontWeight: 'bold',
    backgroundColor: '#ebf4ff',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 7,
    color: '#a0aec0',
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: '#f7fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    padding: 12,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 3,
  },
  infoLabel: {
    width: '25%',
    color: '#718096',
    fontSize: 9,
  },
  infoValue: {
    width: '75%',
    fontSize: 9,
    color: '#1a202c',
  },
  summaryHighlight: {
    flexDirection: 'row',
    backgroundColor: '#ebf4ff',
    borderWidth: 1,
    borderColor: '#2b6cb0',
    borderRadius: 4,
    padding: 10,
    marginTop: 8,
    marginBottom: 4,
  },
});

function formatNum(n: number): string {
  return n.toLocaleString('ja-JP');
}

interface ReportProps {
  caseData: Case;
  result: TaxCalculationResult;
}

function SimulationReport({ caseData, result }: ReportProps) {
  const { decedent, heirs, referenceDate } = caseData;
  const totalFinalTax = result.heirTaxDetails.reduce((s, h) => s + h.finalTax, 0);
  const referenceDateWareki = toWareki(referenceDate);
  const deathDateWareki = decedent.deathDate ? toWareki(decedent.deathDate) : '';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* タイトル */}
        <Text style={styles.title}>相続税シミュレーション報告書</Text>
        <Text style={styles.titleSub}>
          基準日: {referenceDateWareki}（{referenceDate}）
        </Text>

        {/* 基本情報 */}
        <Text style={styles.subtitle}>基本情報</Text>
        <View style={styles.infoBox}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>被相続人</Text>
            <Text style={styles.infoValue}>{decedent.name || '（未入力）'}</Text>
          </View>
          {deathDateWareki && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>死亡日</Text>
              <Text style={styles.infoValue}>{deathDateWareki}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>基準日</Text>
            <Text style={styles.infoValue}>{referenceDateWareki}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>相続人数</Text>
            <Text style={styles.infoValue}>{heirs.length}名</Text>
          </View>
        </View>

        {/* 計算概要 */}
        <Text style={styles.subtitle}>計算概要</Text>
        {([
          ['財産総額（保険金含む）', result.totalAssetValue],
          ['債務・葬式費用合計', result.totalDeductions],
          ['保険金非課税枠', result.insuranceExemption],
          ['課税価格合計', result.netTaxableValue],
          ['基礎控除額', result.basicDeduction],
          ['課税遺産総額', result.taxableAmount],
        ] as [string, number][]).map(([label, value]) => (
          <View key={label} style={styles.row}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value}>{formatNum(value)}円</Text>
          </View>
        ))}
        <View style={styles.summaryHighlight}>
          <Text style={[styles.label, { fontWeight: 'bold', color: '#1a365d' }]}>
            相続税の総額
          </Text>
          <Text style={[styles.value, { fontWeight: 'bold', color: '#2b6cb0', fontSize: 14 }]}>
            {formatNum(result.totalInheritanceTax)}円
          </Text>
        </View>

        {/* 各相続人の税額 */}
        <Text style={styles.subtitle}>各相続人の相続税額</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.cell, styles.tableHeaderText, { width: '16%' }]}>氏名</Text>
          <Text style={[styles.cell, styles.tableHeaderText, { width: '10%' }]}>続柄</Text>
          <Text style={[styles.cell, styles.tableHeaderText, { width: '18%', textAlign: 'right' }]}>取得額</Text>
          <Text style={[styles.cell, styles.tableHeaderText, { width: '10%', textAlign: 'right' }]}>法定相続分</Text>
          <Text style={[styles.cell, styles.tableHeaderText, { width: '16%', textAlign: 'right' }]}>按分税額</Text>
          <Text style={[styles.cell, styles.tableHeaderText, { width: '14%', textAlign: 'right' }]}>税額控除</Text>
          <Text style={[styles.cell, styles.tableHeaderText, { width: '16%', textAlign: 'right' }]}>納付税額</Text>
        </View>
        {result.heirTaxDetails.map((d, idx) => {
          const heir = heirs.find(h => h.id === d.heirId);
          const totalDeductions = d.spouseDeduction + d.minorDeduction + d.disabilityDeduction;
          const rowStyle = idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt;
          return (
            <View key={d.heirId} style={rowStyle}>
              <Text style={[styles.cell, { width: '16%' }]}>{d.heirName}</Text>
              <Text style={[styles.cell, { width: '10%' }]}>
                {heir ? RELATIONSHIP_LABELS[heir.relationship] : ''}
              </Text>
              <Text style={[styles.cell, { width: '18%', textAlign: 'right' }]}>
                {formatNum(d.acquiredValue)}
              </Text>
              <Text style={[styles.cell, { width: '10%', textAlign: 'right' }]}>
                {(d.legalShareRatio * 100).toFixed(1)}%
              </Text>
              <Text style={[styles.cell, { width: '16%', textAlign: 'right' }]}>
                {formatNum(d.allocatedTax)}
              </Text>
              <Text style={[styles.cell, { width: '14%', textAlign: 'right' }]}>
                {formatNum(totalDeductions)}
              </Text>
              <Text style={[styles.cell, { width: '16%', textAlign: 'right', fontWeight: 'bold' }]}>
                {formatNum(d.finalTax)}
              </Text>
            </View>
          );
        })}
        <View style={styles.totalRow}>
          <Text style={[styles.cell, { width: '70%', fontWeight: 'bold' }]}>納付税額合計</Text>
          <Text style={[styles.cell, { width: '14%' }]} />
          <Text style={[styles.cell, { width: '16%', textAlign: 'right', fontWeight: 'bold', fontSize: 10 }]}>
            {formatNum(totalFinalTax)}円
          </Text>
        </View>

        {/* 税額控除の内訳（控除がある場合のみ） */}
        {result.heirTaxDetails.some(d => d.spouseDeduction > 0 || d.minorDeduction > 0 || d.disabilityDeduction > 0) && (
          <>
            <Text style={[styles.subtitle, { fontSize: 11 }]}>税額控除の内訳</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '25%' }]}>氏名</Text>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '25%', textAlign: 'right' }]}>配偶者控除</Text>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '25%', textAlign: 'right' }]}>未成年者控除</Text>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '25%', textAlign: 'right' }]}>障害者控除</Text>
            </View>
            {result.heirTaxDetails
              .filter(d => d.spouseDeduction > 0 || d.minorDeduction > 0 || d.disabilityDeduction > 0)
              .map((d, idx) => (
                <View key={d.heirId} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <Text style={[styles.cell, { width: '25%' }]}>{d.heirName}</Text>
                  <Text style={[styles.cell, { width: '25%', textAlign: 'right' }]}>
                    {d.spouseDeduction > 0 ? formatNum(d.spouseDeduction) + '円' : '-'}
                  </Text>
                  <Text style={[styles.cell, { width: '25%', textAlign: 'right' }]}>
                    {d.minorDeduction > 0 ? formatNum(d.minorDeduction) + '円' : '-'}
                  </Text>
                  <Text style={[styles.cell, { width: '25%', textAlign: 'right' }]}>
                    {d.disabilityDeduction > 0 ? formatNum(d.disabilityDeduction) + '円' : '-'}
                  </Text>
                </View>
              ))}
          </>
        )}

        <Text style={styles.footer}>
          本シミュレーションは参考資料としてご利用ください。正確な税額の算定には税理士等の専門家にご相談ください。
        </Text>
      </Page>
    </Document>
  );
}

/**
 * シミュレーション結果PDFのBlobを生成（アップロード用）
 */
export async function generateSimulationPdfBlob(caseData: Case, result: TaxCalculationResult): Promise<Blob> {
  return pdf(<SimulationReport caseData={caseData} result={result} />).toBlob();
}

/**
 * シミュレーション結果PDFをダウンロード
 */
export async function exportSimulationPdf(caseData: Case, result: TaxCalculationResult) {
  const blob = await generateSimulationPdfBlob(caseData, result);
  saveAs(blob, `相続税シミュレーション報告書_${caseData.decedent.name || '未入力'}.pdf`);
}
