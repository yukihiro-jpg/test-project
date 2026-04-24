// 財産目録 PDF生成（@react-pdf/renderer）

'use client';

import { Document, Page, Text, View, StyleSheet, Font, pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import type { Case } from '@/types';
import {
  calculateLandValue,
  calculateBuildingValue,
  calculateCashValue,
  calculateListedStockValue,
  calculateUnlistedStockValue,
  calculateOtherAssetValue,
} from '@/lib/tax/asset-valuation';
import { toWareki } from '@/lib/dates/wareki';

// 日本語フォント登録
Font.register({
  family: 'NotoSansJP',
  src: '/fonts/NotoSansJP-Regular.ttf',
});

// --- Premium color palette ---
const NAVY = '#1F4E79';
const GOLD = '#D4AF37';
const DARK_TEXT = '#1a202c';
const GRAY_TEXT = '#4a5568';
const LIGHT_GRAY = '#f7fafc';
const BORDER_GRAY = '#e2e8f0';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: 'NotoSansJP',
    color: DARK_TEXT,
  },
  // --- Title page ---
  titlePage: {
    padding: 40,
    fontFamily: 'NotoSansJP',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  titleBorder: {
    borderWidth: 2,
    borderColor: GOLD,
    padding: 40,
    alignItems: 'center',
    width: '80%',
  },
  titleMain: {
    fontSize: 32,
    color: NAVY,
    fontWeight: 'bold',
    letterSpacing: 8,
    marginBottom: 24,
  },
  titleDivider: {
    width: 80,
    height: 2,
    backgroundColor: GOLD,
    marginBottom: 24,
  },
  titleDecedent: {
    fontSize: 14,
    color: GRAY_TEXT,
    marginBottom: 8,
  },
  titleDate: {
    fontSize: 11,
    color: GRAY_TEXT,
    marginTop: 8,
  },
  // --- Section headers ---
  sectionHeader: {
    backgroundColor: NAVY,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 16,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeaderText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  sectionSubtotalText: {
    color: GOLD,
    fontSize: 10,
    fontWeight: 'bold',
  },
  // --- Table ---
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#e8eef4',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: NAVY,
  },
  tableHeaderText: {
    fontSize: 7,
    color: NAVY,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER_GRAY,
    paddingVertical: 3,
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER_GRAY,
    paddingVertical: 3,
    backgroundColor: LIGHT_GRAY,
  },
  cell: {
    paddingHorizontal: 4,
    fontSize: 8,
  },
  // --- Grand total ---
  grandTotalBox: {
    marginTop: 20,
    borderWidth: 2,
    borderColor: NAVY,
    backgroundColor: '#f0f4f8',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  grandTotalLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: NAVY,
  },
  grandTotalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: NAVY,
  },
  // --- Empty message ---
  emptyMessage: {
    fontSize: 8,
    color: GRAY_TEXT,
    paddingVertical: 6,
    paddingHorizontal: 10,
    fontStyle: 'italic',
  },
  // --- Footer ---
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#a0aec0',
  },
});

function formatNum(n: number): string {
  return n.toLocaleString('ja-JP');
}

// --- Component ---

interface Props {
  caseData: Case;
}

function PropertyListDocument({ caseData }: Props) {
  const { decedent, assets, referenceDate } = caseData;
  const referenceDateWareki = toWareki(referenceDate);
  const decedentName = decedent.name || '（未入力）';

  // --- Calculate values per category ---

  // Lands
  const landItems = assets.lands.map(land => {
    const linkedBld = land.linkedBuildingId
      ? assets.buildings.find(b => b.id === land.linkedBuildingId)
      : undefined;
    const value = calculateLandValue(land, linkedBld, referenceDate);
    return { land, value };
  });
  const landTotal = landItems.reduce((s, i) => s + i.value, 0);

  // Buildings
  const buildingItems = assets.buildings.map(b => ({
    building: b,
    value: calculateBuildingValue(b),
  }));
  const buildingTotal = buildingItems.reduce((s, i) => s + i.value, 0);

  // Cash deposits
  const cashItems = assets.cashDeposits.map(c => ({
    cash: c,
    value: calculateCashValue(c),
  }));
  const cashTotal = cashItems.reduce((s, i) => s + i.value, 0);

  // Listed stocks
  const listedStockItems = assets.listedStocks.map(s => {
    const result = calculateListedStockValue(s);
    return { stock: s, value: result.totalValue, selectedPrice: result.selectedPrice };
  });
  const listedStockTotal = listedStockItems.reduce((s, i) => s + i.value, 0);

  // Unlisted stocks
  const unlistedStockItems = assets.unlistedStocks.map(s => ({
    stock: s,
    value: calculateUnlistedStockValue(s),
  }));
  const unlistedStockTotal = unlistedStockItems.reduce((s, i) => s + i.value, 0);

  // Insurance
  const insuranceItems = assets.insurances.map(ins => ({
    insurance: ins,
    value: ins.amount,
  }));
  const insuranceTotal = insuranceItems.reduce((s, i) => s + i.value, 0);

  // Retirement benefits
  const retirementItems = (assets.retirementBenefits || []).map(r => ({
    retirement: r,
    value: r.amount,
  }));
  const retirementTotal = retirementItems.reduce((s, i) => s + i.value, 0);

  // Other assets
  const otherItems = assets.others.map(o => ({
    other: o,
    value: calculateOtherAssetValue(o),
  }));
  const otherTotal = otherItems.reduce((s, i) => s + i.value, 0);

  // Debts
  const debtTotal = assets.debts.reduce((s, d) => s + d.amount, 0);

  // Funeral expenses
  const funeralTotal = assets.funeralExpenses.reduce((s, f) => s + f.amount, 0);

  // Grand total (positive assets)
  const positiveTotal = landTotal + buildingTotal + cashTotal + listedStockTotal +
    unlistedStockTotal + insuranceTotal + retirementTotal + otherTotal;
  const netTotal = positiveTotal - debtTotal - funeralTotal;

  return (
    <Document>
      {/* ===== Title Page ===== */}
      <Page size="A4" style={styles.titlePage}>
        <View style={styles.titleBorder}>
          <Text style={styles.titleMain}>財産目録</Text>
          <View style={styles.titleDivider} />
          <Text style={styles.titleDecedent}>被相続人: {decedentName}</Text>
          <Text style={styles.titleDate}>基準日: {referenceDateWareki}（{referenceDate}）</Text>
        </View>
      </Page>

      {/* ===== Content Pages ===== */}
      <Page size="A4" style={styles.page}>
        {/* --- 1. 土地 --- */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>1. 土地</Text>
          <Text style={styles.sectionSubtotalText}>小計: {formatNum(landTotal)}円</Text>
        </View>
        {landItems.length === 0 ? (
          <Text style={styles.emptyMessage}>該当なし</Text>
        ) : (
          <>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '30%' }]}>所在地</Text>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '12%' }]}>地目</Text>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '13%', textAlign: 'right' }]}>地積(㎡)</Text>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '12%' }]}>評価方法</Text>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '13%' }]}>用途</Text>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '20%', textAlign: 'right' }]}>評価額(円)</Text>
            </View>
            {landItems.map((item, idx) => (
              <View key={item.land.id} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <Text style={[styles.cell, { width: '30%' }]}>{item.land.location || '-'}</Text>
                <Text style={[styles.cell, { width: '12%' }]}>{item.land.landCategory}</Text>
                <Text style={[styles.cell, { width: '13%', textAlign: 'right' }]}>{formatNum(item.land.area)}</Text>
                <Text style={[styles.cell, { width: '12%' }]}>
                  {item.land.evaluationMethod === 'rosenka' ? '路線価' : '倍率'}
                </Text>
                <Text style={[styles.cell, { width: '13%' }]}>{item.land.usage || '自用'}</Text>
                <Text style={[styles.cell, { width: '20%', textAlign: 'right' }]}>{formatNum(item.value)}</Text>
              </View>
            ))}
          </>
        )}

        {/* --- 2. 建物 --- */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>2. 建物</Text>
          <Text style={styles.sectionSubtotalText}>小計: {formatNum(buildingTotal)}円</Text>
        </View>
        {buildingItems.length === 0 ? (
          <Text style={styles.emptyMessage}>該当なし</Text>
        ) : (
          <>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '30%' }]}>所在地</Text>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '15%' }]}>構造</Text>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '15%' }]}>用途</Text>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '10%' }]}>貸家</Text>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '30%', textAlign: 'right' }]}>評価額(円)</Text>
            </View>
            {buildingItems.map((item, idx) => (
              <View key={item.building.id} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <Text style={[styles.cell, { width: '30%' }]}>{item.building.location || '-'}</Text>
                <Text style={[styles.cell, { width: '15%' }]}>{item.building.structureType || '-'}</Text>
                <Text style={[styles.cell, { width: '15%' }]}>{item.building.usage || '-'}</Text>
                <Text style={[styles.cell, { width: '10%' }]}>
                  {item.building.rentalReduction ? 'あり' : '-'}
                </Text>
                <Text style={[styles.cell, { width: '30%', textAlign: 'right' }]}>{formatNum(item.value)}</Text>
              </View>
            ))}
          </>
        )}

        {/* --- 3. 現金・預貯金 --- */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>3. 現金・預貯金</Text>
          <Text style={styles.sectionSubtotalText}>小計: {formatNum(cashTotal)}円</Text>
        </View>
        {cashItems.length === 0 ? (
          <Text style={styles.emptyMessage}>該当なし</Text>
        ) : (
          <>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '25%' }]}>金融機関</Text>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '15%' }]}>支店</Text>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '15%' }]}>種類</Text>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '20%', textAlign: 'right' }]}>残高(円)</Text>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '25%', textAlign: 'right' }]}>評価額(円)</Text>
            </View>
            {cashItems.map((item, idx) => (
              <View key={item.cash.id} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <Text style={[styles.cell, { width: '25%' }]}>{item.cash.institutionName || '-'}</Text>
                <Text style={[styles.cell, { width: '15%' }]}>{item.cash.branchName || '-'}</Text>
                <Text style={[styles.cell, { width: '15%' }]}>{item.cash.accountType || '-'}</Text>
                <Text style={[styles.cell, { width: '20%', textAlign: 'right' }]}>{formatNum(item.cash.balance)}</Text>
                <Text style={[styles.cell, { width: '25%', textAlign: 'right' }]}>{formatNum(item.value)}</Text>
              </View>
            ))}
          </>
        )}

        {/* --- 4. 上場株式 --- */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>4. 上場株式</Text>
          <Text style={styles.sectionSubtotalText}>小計: {formatNum(listedStockTotal)}円</Text>
        </View>
        {listedStockItems.length === 0 ? (
          <Text style={styles.emptyMessage}>該当なし</Text>
        ) : (
          <>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '25%' }]}>銘柄</Text>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '15%' }]}>証券コード</Text>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '15%', textAlign: 'right' }]}>株数</Text>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '20%', textAlign: 'right' }]}>単価(円)</Text>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '25%', textAlign: 'right' }]}>評価額(円)</Text>
            </View>
            {listedStockItems.map((item, idx) => (
              <View key={item.stock.id} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <Text style={[styles.cell, { width: '25%' }]}>{item.stock.companyName || '-'}</Text>
                <Text style={[styles.cell, { width: '15%' }]}>{item.stock.stockCode || '-'}</Text>
                <Text style={[styles.cell, { width: '15%', textAlign: 'right' }]}>{formatNum(item.stock.shares)}</Text>
                <Text style={[styles.cell, { width: '20%', textAlign: 'right' }]}>{formatNum(item.selectedPrice)}</Text>
                <Text style={[styles.cell, { width: '25%', textAlign: 'right' }]}>{formatNum(item.value)}</Text>
              </View>
            ))}
          </>
        )}

        <Text style={styles.footer}>
          <Text>財産目録 - {decedentName}</Text>
          <Text>    基準日: {referenceDate}</Text>
        </Text>
      </Page>

      {/* ===== Page 2: Remaining categories + Grand Total ===== */}
      <Page size="A4" style={styles.page}>
        {/* --- 5. 非上場株式 --- */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>5. 非上場株式</Text>
          <Text style={styles.sectionSubtotalText}>小計: {formatNum(unlistedStockTotal)}円</Text>
        </View>
        {unlistedStockItems.length === 0 ? (
          <Text style={styles.emptyMessage}>該当なし</Text>
        ) : (
          <>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '30%' }]}>会社名</Text>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '15%', textAlign: 'right' }]}>保有株数</Text>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '15%', textAlign: 'right' }]}>発行済株数</Text>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '15%', textAlign: 'right' }]}>1株単価(円)</Text>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '25%', textAlign: 'right' }]}>評価額(円)</Text>
            </View>
            {unlistedStockItems.map((item, idx) => (
              <View key={item.stock.id} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <Text style={[styles.cell, { width: '30%' }]}>{item.stock.companyName || '-'}</Text>
                <Text style={[styles.cell, { width: '15%', textAlign: 'right' }]}>{formatNum(item.stock.sharesOwned)}</Text>
                <Text style={[styles.cell, { width: '15%', textAlign: 'right' }]}>{formatNum(item.stock.totalShares)}</Text>
                <Text style={[styles.cell, { width: '15%', textAlign: 'right' }]}>{formatNum(item.stock.pricePerShare)}</Text>
                <Text style={[styles.cell, { width: '25%', textAlign: 'right' }]}>{formatNum(item.value)}</Text>
              </View>
            ))}
          </>
        )}

        {/* --- 6. 生命保険金 --- */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>6. 生命保険金</Text>
          <Text style={styles.sectionSubtotalText}>小計: {formatNum(insuranceTotal)}円</Text>
        </View>
        {insuranceItems.length === 0 ? (
          <Text style={styles.emptyMessage}>該当なし</Text>
        ) : (
          <>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '30%' }]}>保険会社</Text>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '20%' }]}>証券番号</Text>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '15%' }]}>種別</Text>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '35%', textAlign: 'right' }]}>金額(円)</Text>
            </View>
            {insuranceItems.map((item, idx) => (
              <View key={item.insurance.id} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <Text style={[styles.cell, { width: '30%' }]}>{item.insurance.insuranceCompany || '-'}</Text>
                <Text style={[styles.cell, { width: '20%' }]}>{item.insurance.policyNumber || '-'}</Text>
                <Text style={[styles.cell, { width: '15%' }]}>
                  {item.insurance.isDeathBenefit ? '死亡保険' : 'その他'}
                </Text>
                <Text style={[styles.cell, { width: '35%', textAlign: 'right' }]}>{formatNum(item.value)}</Text>
              </View>
            ))}
          </>
        )}

        {/* --- 7. 退職手当金 --- */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>7. 退職手当金等</Text>
          <Text style={styles.sectionSubtotalText}>小計: {formatNum(retirementTotal)}円</Text>
        </View>
        {retirementItems.length === 0 ? (
          <Text style={styles.emptyMessage}>該当なし</Text>
        ) : (
          <>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '40%' }]}>支給者</Text>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '30%' }]}>備考</Text>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '30%', textAlign: 'right' }]}>金額(円)</Text>
            </View>
            {retirementItems.map((item, idx) => (
              <View key={item.retirement.id} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <Text style={[styles.cell, { width: '40%' }]}>{item.retirement.payerName || '-'}</Text>
                <Text style={[styles.cell, { width: '30%' }]}>{item.retirement.note || '-'}</Text>
                <Text style={[styles.cell, { width: '30%', textAlign: 'right' }]}>{formatNum(item.value)}</Text>
              </View>
            ))}
          </>
        )}

        {/* --- 8. その他の財産 --- */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>8. その他の財産</Text>
          <Text style={styles.sectionSubtotalText}>小計: {formatNum(otherTotal)}円</Text>
        </View>
        {otherItems.length === 0 ? (
          <Text style={styles.emptyMessage}>該当なし</Text>
        ) : (
          <>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '20%' }]}>種類</Text>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '30%' }]}>内容</Text>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '10%', textAlign: 'right' }]}>数量</Text>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '15%', textAlign: 'right' }]}>単価(円)</Text>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '25%', textAlign: 'right' }]}>評価額(円)</Text>
            </View>
            {otherItems.map((item, idx) => (
              <View key={item.other.id} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <Text style={[styles.cell, { width: '20%' }]}>{item.other.category || '-'}</Text>
                <Text style={[styles.cell, { width: '30%' }]}>{item.other.description || '-'}</Text>
                <Text style={[styles.cell, { width: '10%', textAlign: 'right' }]}>{formatNum(item.other.quantity)}</Text>
                <Text style={[styles.cell, { width: '15%', textAlign: 'right' }]}>{formatNum(item.other.unitPrice)}</Text>
                <Text style={[styles.cell, { width: '25%', textAlign: 'right' }]}>{formatNum(item.value)}</Text>
              </View>
            ))}
          </>
        )}

        {/* --- 9. 債務 --- */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>9. 債務</Text>
          <Text style={styles.sectionSubtotalText}>小計: {formatNum(debtTotal)}円</Text>
        </View>
        {assets.debts.length === 0 ? (
          <Text style={styles.emptyMessage}>該当なし</Text>
        ) : (
          <>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '20%' }]}>種類</Text>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '25%' }]}>債権者</Text>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '25%' }]}>内容</Text>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '30%', textAlign: 'right' }]}>金額(円)</Text>
            </View>
            {assets.debts.map((debt, idx) => (
              <View key={debt.id} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <Text style={[styles.cell, { width: '20%' }]}>{debt.category || '-'}</Text>
                <Text style={[styles.cell, { width: '25%' }]}>{debt.creditor || '-'}</Text>
                <Text style={[styles.cell, { width: '25%' }]}>{debt.description || '-'}</Text>
                <Text style={[styles.cell, { width: '30%', textAlign: 'right' }]}>{formatNum(debt.amount)}</Text>
              </View>
            ))}
          </>
        )}

        {/* --- 10. 葬式費用 --- */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>10. 葬式費用</Text>
          <Text style={styles.sectionSubtotalText}>小計: {formatNum(funeralTotal)}円</Text>
        </View>
        {assets.funeralExpenses.length === 0 ? (
          <Text style={styles.emptyMessage}>該当なし</Text>
        ) : (
          <>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '35%' }]}>内容</Text>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '25%' }]}>支払先</Text>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '10%' }]}>控除対象</Text>
              <Text style={[styles.cell, styles.tableHeaderText, { width: '30%', textAlign: 'right' }]}>金額(円)</Text>
            </View>
            {assets.funeralExpenses.map((expense, idx) => (
              <View key={expense.id} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <Text style={[styles.cell, { width: '35%' }]}>{expense.description || '-'}</Text>
                <Text style={[styles.cell, { width: '25%' }]}>{expense.payee || '-'}</Text>
                <Text style={[styles.cell, { width: '10%' }]}>{expense.isDeductible ? '○' : '×'}</Text>
                <Text style={[styles.cell, { width: '30%', textAlign: 'right' }]}>{formatNum(expense.amount)}</Text>
              </View>
            ))}
          </>
        )}

        {/* --- Grand Total --- */}
        <View style={styles.grandTotalBox}>
          <View>
            <Text style={styles.grandTotalLabel}>財産合計（プラスの財産）</Text>
            <Text style={{ fontSize: 8, color: GRAY_TEXT, marginTop: 2 }}>
              債務・葬式費用控除前
            </Text>
          </View>
          <Text style={styles.grandTotalValue}>{formatNum(positiveTotal)}円</Text>
        </View>

        <View style={[styles.grandTotalBox, { marginTop: 6, borderColor: GOLD }]}>
          <View>
            <Text style={[styles.grandTotalLabel, { color: NAVY }]}>純資産額</Text>
            <Text style={{ fontSize: 8, color: GRAY_TEXT, marginTop: 2 }}>
              財産合計 - 債務({formatNum(debtTotal)}円) - 葬式費用({formatNum(funeralTotal)}円)
            </Text>
          </View>
          <Text style={[styles.grandTotalValue, { color: NAVY }]}>{formatNum(netTotal)}円</Text>
        </View>

        <Text style={styles.footer}>
          <Text>財産目録 - {decedentName}</Text>
          <Text>    基準日: {referenceDate}</Text>
        </Text>
      </Page>
    </Document>
  );
}

/**
 * 財産目録PDFのBlobを生成（アップロード用）
 */
export async function generatePropertyListPdfBlob(caseData: Case): Promise<Blob> {
  return pdf(<PropertyListDocument caseData={caseData} />).toBlob();
}

/**
 * 財産目録PDFをダウンロード
 */
export async function exportPropertyListPdf(caseData: Case) {
  const blob = await generatePropertyListPdfBlob(caseData);
  saveAs(blob, `財産目録_${caseData.decedent.name || '未入力'}.pdf`);
}
