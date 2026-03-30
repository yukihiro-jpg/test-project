// PDF報告書生成（@react-pdf/renderer）

'use client';

import { Document, Page, Text, View, StyleSheet, Font, pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import type { Case, TaxCalculationResult } from '@/types';
import { RELATIONSHIP_LABELS } from '@/types';
import { toWareki } from '@/lib/dates/wareki';

// Note: For production, register a Japanese font
// Font.register({ family: 'NotoSansJP', src: '/fonts/NotoSansJP-Regular.ttf' });

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    // fontFamily: 'NotoSansJP', // Enable when Japanese font is registered
  },
  title: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 10,
    marginTop: 15,
    fontWeight: 'bold',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#ccc',
    paddingVertical: 4,
  },
  label: {
    width: '45%',
    color: '#555',
  },
  value: {
    width: '55%',
    textAlign: 'right',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingVertical: 4,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#ccc',
    paddingVertical: 3,
  },
  cell: {
    paddingHorizontal: 4,
  },
  totalRow: {
    flexDirection: 'row',
    borderTopWidth: 2,
    borderTopColor: '#333',
    paddingVertical: 4,
    fontWeight: 'bold',
    backgroundColor: '#e8f0fe',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#999',
    textAlign: 'center',
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

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Inheritance Tax Simulation Report</Text>
        <Text style={{ textAlign: 'center', marginBottom: 20, fontSize: 14 }}>
          Souzoku Zei Simulation Houkokusho
        </Text>

        {/* Basic Info */}
        <Text style={styles.subtitle}>Basic Information</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Decedent (Hisouzokunin)</Text>
          <Text style={styles.value}>{decedent.name}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Reference Date (Kijunbi)</Text>
          <Text style={styles.value}>{referenceDate}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Number of Heirs (Souzokuninsu)</Text>
          <Text style={styles.value}>{heirs.length}</Text>
        </View>

        {/* Summary */}
        <Text style={styles.subtitle}>Calculation Summary</Text>
        {[
          ['Total Assets (Zaisan Sougaku)', result.totalAssetValue],
          ['Debts/Funeral (Saimu/Soushiki)', result.totalDeductions],
          ['Insurance Exemption (Hoken Hikazei)', result.insuranceExemption],
          ['Taxable Total (Kazei Kakaku)', result.netTaxableValue],
          ['Basic Deduction (Kiso Koujo)', result.basicDeduction],
          ['Taxable Estate (Kazei Isan)', result.taxableAmount],
          ['Total Inheritance Tax (Souzokuzei Sougaku)', result.totalInheritanceTax],
        ].map(([label, value]) => (
          <View key={String(label)} style={styles.row}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value}>{formatNum(value as number)} yen</Text>
          </View>
        ))}

        {/* Per Heir */}
        <Text style={styles.subtitle}>Tax per Heir</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.cell, { width: '20%' }]}>Name</Text>
          <Text style={[styles.cell, { width: '15%' }]}>Relationship</Text>
          <Text style={[styles.cell, { width: '20%', textAlign: 'right' }]}>Acquired</Text>
          <Text style={[styles.cell, { width: '15%', textAlign: 'right' }]}>Legal Share</Text>
          <Text style={[styles.cell, { width: '15%', textAlign: 'right' }]}>Deductions</Text>
          <Text style={[styles.cell, { width: '15%', textAlign: 'right' }]}>Final Tax</Text>
        </View>
        {result.heirTaxDetails.map(d => {
          const heir = heirs.find(h => h.id === d.heirId);
          const ded = d.spouseDeduction + d.minorDeduction + d.disabilityDeduction;
          return (
            <View key={d.heirId} style={styles.tableRow}>
              <Text style={[styles.cell, { width: '20%' }]}>{d.heirName}</Text>
              <Text style={[styles.cell, { width: '15%' }]}>
                {heir ? RELATIONSHIP_LABELS[heir.relationship] : ''}
              </Text>
              <Text style={[styles.cell, { width: '20%', textAlign: 'right' }]}>
                {formatNum(d.acquiredValue)}
              </Text>
              <Text style={[styles.cell, { width: '15%', textAlign: 'right' }]}>
                {(d.legalShareRatio * 100).toFixed(1)}%
              </Text>
              <Text style={[styles.cell, { width: '15%', textAlign: 'right' }]}>
                {formatNum(ded)}
              </Text>
              <Text style={[styles.cell, { width: '15%', textAlign: 'right' }]}>
                {formatNum(d.finalTax)}
              </Text>
            </View>
          );
        })}
        <View style={styles.totalRow}>
          <Text style={[styles.cell, { width: '70%' }]}>Total Payment (Noufu Gaku Goukei)</Text>
          <Text style={[styles.cell, { width: '15%' }]} />
          <Text style={[styles.cell, { width: '15%', textAlign: 'right' }]}>
            {formatNum(totalFinalTax)} yen
          </Text>
        </View>

        <Text style={styles.footer}>
          This simulation is for reference purposes only. Please consult a tax professional for official calculations.
        </Text>
      </Page>
    </Document>
  );
}

/**
 * シミュレーション結果PDFをダウンロード
 */
export async function exportSimulationPdf(caseData: Case, result: TaxCalculationResult) {
  const blob = await pdf(<SimulationReport caseData={caseData} result={result} />).toBlob();
  saveAs(blob, `simulation_report_${caseData.decedent.name || 'unnamed'}.pdf`);
}
