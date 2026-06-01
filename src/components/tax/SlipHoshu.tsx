'use client'
// 報酬・料金等の所得税徴収高計算書（税目番号 32319）

import React from 'react'

export type HoshuRow = {
  code: string
  people: number
  amount: number
  tax: number
}

export type HoshuSlipData = {
  reiwaYear: string
  taxOffice: string
  taxOfficeNumber: string
  seiriNumber: string
  payerNumber: string
  noukiYear: string
  noukiMonth: string
  noukiYearTo?: string
  noukiMonthTo?: string
  address: string
  name: string
  phone: string
  rows: HoshuRow[]
  honzei: number
  entaizei: number
  goukei: number
  ateSaki: string
  tekiyou: string
}

const COLS_AMOUNT = 10
const COLS_PEOPLE = 6
const COLS_TAX = 10

const cellsW = (cols: number) => 23 * cols + 1
const colW = (cols: number) => cellsW(cols) + 8

const W_KUBUN = 64 // w-16
const W_PEOPLE = colW(COLS_PEOPLE)
const W_AMOUNT = colW(COLS_AMOUNT)
const W_TAX = colW(COLS_TAX)
const TABLE_W = W_KUBUN + W_PEOPLE + W_AMOUNT + W_TAX

function Digits({
  value,
  cols,
  align = 'right',
}: {
  value: string | number
  cols: number
  align?: 'right' | 'left'
}) {
  const s = String(value ?? '')
  const padded = align === 'right' ? s.padStart(cols, ' ') : s.padEnd(cols, ' ')
  const chars = padded.slice(-cols).split('')
  return (
    <div className="flex" style={{ width: cellsW(cols) }}>
      {chars.map((c, i) => (
        <div
          key={i}
          className="w-6 h-7 border border-gray-700 -ml-px first:ml-0 text-center text-sm leading-7 bg-white"
        >
          {c.trim()}
        </div>
      ))}
    </div>
  )
}

export default function SlipHoshu({ data }: { data: HoshuSlipData }) {
  const rows = [...data.rows]
  while (rows.length < 5) rows.push({ code: '', people: 0, amount: 0, tax: 0 })

  return (
    <div
      className="bg-white border-2 border-gray-800 p-3 text-[11px] text-gray-800"
      style={{ minWidth: TABLE_W + 24 }}
    >
      <div className="flex items-start gap-2 mb-2">
        <div className="border border-gray-700 px-2 py-1 font-bold">
          国税 収納金<br />整理資金
        </div>
        <div className="border border-gray-700 px-2 py-1 font-bold">（納付書）</div>
        <div className="border border-gray-700 px-2 py-1 text-center leading-tight">
          報酬・料金等の<br />所得税徴収高計算書
        </div>
        <div className="border border-gray-700 px-2 py-1 font-bold">⊛ 領収済通知書</div>
      </div>

      <div className="flex items-end gap-2 mb-2 flex-wrap">
        <div>
          <div className="text-[10px]">税目番号</div>
          <div className="border border-gray-700 px-2 py-0.5 font-mono">32319</div>
        </div>
        <div>
          <div className="text-[10px]">令和 年度</div>
          <Digits value={data.reiwaYear} cols={2} />
        </div>
        <div>
          <div className="text-[10px]">税務署名</div>
          <div className="border border-gray-700 px-2 h-7 leading-7 min-w-[140px]">
            {data.taxOffice}
          </div>
        </div>
        <div>
          <div className="text-[10px]">税務署番号</div>
          <Digits value={data.taxOfficeNumber} cols={3} />
        </div>
        <div>
          <div className="text-[10px]">整理番号</div>
          <Digits value={data.seiriNumber} cols={8} />
        </div>
        <div>
          <div className="text-[10px]">記入者</div>
          <Digits value={data.payerNumber} cols={13} />
        </div>
      </div>

      <div className="text-[10px] mb-1">
        コード表: 01 原稿料・著作権使用料等 / 05 外交員等 / 06 俳優等 / 07 芸能人事業 /{' '}
        <b>08 ホステス等の報酬・料金</b> / 21 契約金 / 31 賞金 / 41 公的年金等
      </div>

      <div className="border border-gray-700 mb-2" style={{ width: TABLE_W }}>
        <div className="flex bg-gray-100 text-center font-semibold">
          <div style={{ width: W_KUBUN }} className="border-r border-gray-700 py-1">区分</div>
          <div style={{ width: W_PEOPLE }} className="border-r border-gray-700 py-1">人員</div>
          <div style={{ width: W_AMOUNT }} className="border-r border-gray-700 py-1">支払額</div>
          <div style={{ width: W_TAX }} className="py-1">税額</div>
        </div>
        {rows.map((r, i) => (
          <div key={i} className="flex border-t border-gray-700">
            <div
              style={{ width: W_KUBUN }}
              className="border-r border-gray-700 flex justify-center items-center"
            >
              <Digits value={r.code} cols={2} />
            </div>
            <div style={{ width: W_PEOPLE }} className="border-r border-gray-700 p-1">
              <Digits value={r.people || ''} cols={COLS_PEOPLE} />
            </div>
            <div style={{ width: W_AMOUNT }} className="border-r border-gray-700 p-1">
              <Digits value={r.amount || ''} cols={COLS_AMOUNT} />
            </div>
            <div style={{ width: W_TAX }} className="p-1">
              <Digits value={r.tax || ''} cols={COLS_TAX} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_280px] gap-2">
        <div className="border border-gray-700 p-2">
          <div className="text-[10px]">住所（所在地）　（電話番号 {data.phone}）</div>
          <div className="min-h-[28px] border-b border-dotted border-gray-400 pt-1">
            {data.address}
          </div>
          <div className="text-[10px] mt-2">氏名（名称）</div>
          <div className="min-h-[28px] border-b border-dotted border-gray-400 pt-1 text-right pr-2">
            {data.name} <span className="text-[10px]">様（御中）</span>
          </div>
          <div className="text-[10px] mt-2">摘要</div>
          <div className="min-h-[22px]">{data.tekiyou}</div>
        </div>
        <div>
          <div className="mb-1">
            <div className="text-[10px]">納期等の区分</div>
            {data.noukiMonthTo ? (
              <div className="space-y-0.5">
                <div className="flex items-center gap-1">
                  <span className="text-[10px]">自</span>
                  <span>令和</span>
                  <Digits value={data.noukiYear} cols={2} />
                  <span>年</span>
                  <Digits value={data.noukiMonth} cols={2} />
                  <span>月</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px]">至</span>
                  <span>令和</span>
                  <Digits value={data.noukiYearTo || data.noukiYear} cols={2} />
                  <span>年</span>
                  <Digits value={data.noukiMonthTo} cols={2} />
                  <span>月</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <span>令和</span>
                <Digits value={data.noukiYear} cols={2} />
                <span>年</span>
                <Digits value={data.noukiMonth} cols={2} />
                <span>月</span>
              </div>
            )}
            <div className="text-[10px] mt-1">支払分源泉所得税及び復興特別所得税</div>
          </div>
          <div className="border border-gray-700">
            <div className="flex border-b border-gray-700">
              <div className="w-12 px-1 py-1 border-r border-gray-700 font-bold shrink-0">本税</div>
              <div className="p-1">
                <Digits value={data.honzei || ''} cols={9} />
              </div>
            </div>
            <div className="flex border-b border-gray-700">
              <div className="w-12 px-1 py-1 border-r border-gray-700 shrink-0">延滞税</div>
              <div className="p-1">
                <Digits value={data.entaizei || ''} cols={9} />
              </div>
            </div>
            <div className="flex">
              <div className="w-12 px-1 py-1 border-r border-gray-700 font-bold shrink-0">合計額</div>
              <div className="p-1">
                <Digits value={data.goukei ? `¥${data.goukei}` : ''} cols={9} />
              </div>
            </div>
          </div>
          <div className="text-[10px] mt-2">あて先</div>
          <div className="border border-gray-700 min-h-[28px] px-1 py-0.5">{data.ateSaki}</div>
        </div>
      </div>
    </div>
  )
}
