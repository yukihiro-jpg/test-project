'use client'
// 給与所得・退職所得等の所得税徴収高計算書（税目番号 30203）
// 国税庁公表の標準レイアウトに基づき新規作成。

import React from 'react'

export type KyuyoSlipData = {
  reiwaYear: string
  taxOffice: string
  taxOfficeNumber: string
  seiriNumber: string
  payerNumber: string
  noukiYear: string
  noukiMonth: string
  address: string
  name: string
  phone: string
  // 区分別
  houkyu: { people: number; amount: number; tax: number } // 01 俸給・給料等（乙欄含む）
  shoyo: { people: number; amount: number; tax: number } // 02 賞与
  hiyatoi: { people: number; amount: number; tax: number } // 03 日雇労務者の賃金
  zeirishi: { people: number; amount: number; tax: number } // 06 税理士等の報酬
  yakuin: { people: number; amount: number; tax: number } // 04 役員賞与
  taishokuTax: number
  nenchoFusoku: number // 年末調整不足税額
  nenchoChoka: number // 年末調整超過税額
  honzei: number
  entaizei: number
  goukei: number
  tekiyou: string
}

function D({ value, cols }: { value: string | number; cols: number }) {
  const s = String(value ?? '')
  const padded = s.padStart(cols, ' ').slice(-cols)
  return (
    <div className="flex">
      {padded.split('').map((c, i) => (
        <div key={i} className="w-6 h-7 border border-gray-700 -ml-px first:ml-0 text-center text-sm leading-7 bg-white">
          {c.trim()}
        </div>
      ))}
    </div>
  )
}

const Row = ({ code, label, people, amount, tax }: { code: string; label: string; people: number; amount: number; tax: number }) => (
  <div className="flex border-t border-gray-700">
    <div className="w-8 border-r border-gray-700 text-center py-1 font-mono">{code}</div>
    <div className="w-28 border-r border-gray-700 text-[10px] px-1 leading-tight flex items-center">{label}</div>
    <div className="border-r border-gray-700 p-1"><D value={people || ''} cols={6} /></div>
    <div className="border-r border-gray-700 p-1"><D value={amount || ''} cols={10} /></div>
    <div className="p-1"><D value={tax || ''} cols={10} /></div>
  </div>
)

export default function SlipKyuyo({ data }: { data: KyuyoSlipData }) {
  return (
    <div className="bg-white border-2 border-gray-800 p-3 text-[11px] text-gray-800" style={{ minWidth: 760 }}>
      <div className="flex items-start gap-2 mb-2">
        <div className="border border-gray-700 px-2 py-1 font-bold">国税 収納金<br/>整理資金</div>
        <div className="border border-gray-700 px-2 py-1 font-bold">（納付書）</div>
        <div className="border border-gray-700 px-2 py-1 text-center leading-tight">
          給与所得・退職所得等の<br/>所得税徴収高計算書
        </div>
        <div className="border border-gray-700 px-2 py-1 font-bold">⊛ 領収済通知書</div>
      </div>

      <div className="flex items-end gap-2 mb-2 flex-wrap">
        <div>
          <div className="text-[10px]">税目番号</div>
          <div className="border border-gray-700 px-2 py-0.5 font-mono">30203</div>
        </div>
        <div>
          <div className="text-[10px]">令和 年度</div>
          <D value={data.reiwaYear} cols={2} />
        </div>
        <div>
          <div className="text-[10px]">税務署名</div>
          <div className="border border-gray-700 px-2 h-7 leading-7 min-w-[140px]">{data.taxOffice}</div>
        </div>
        <div>
          <div className="text-[10px]">税務署番号</div>
          <D value={data.taxOfficeNumber} cols={3} />
        </div>
        <div>
          <div className="text-[10px]">整理番号</div>
          <D value={data.seiriNumber} cols={8} />
        </div>
        <div>
          <div className="text-[10px]">記入者</div>
          <D value={data.payerNumber} cols={13} />
        </div>
      </div>

      <div className="border border-gray-700 mb-2">
        <div className="flex bg-gray-100 text-center font-semibold">
          <div className="w-8 border-r border-gray-700 py-1">区分</div>
          <div className="w-28 border-r border-gray-700 py-1">摘要</div>
          <div className="border-r border-gray-700 py-1" style={{ width: 6 * 24 + 8 }}>人員</div>
          <div className="border-r border-gray-700 py-1" style={{ width: 10 * 24 + 8 }}>支給額</div>
          <div className="py-1" style={{ width: 10 * 24 + 8 }}>税額</div>
        </div>
        <Row code="01" label="俸給・給料等（乙欄）" {...data.houkyu} />
        <Row code="02" label="賞与（役員賞与を除く）" {...data.shoyo} />
        <Row code="03" label="日雇労務者の賃金" {...data.hiyatoi} />
        <Row code="04" label="役員賞与" {...data.yakuin} />
        <Row code="06" label="税理士等の報酬" {...data.zeirishi} />
        <div className="flex border-t border-gray-700">
          <div className="w-8 border-r border-gray-700 text-center py-1 font-mono">07</div>
          <div className="flex-1 border-r border-gray-700 text-[10px] px-1 leading-tight flex items-center">退職手当等</div>
          <div className="p-1" style={{ width: 10 * 24 + 8 }}><D value={data.taishokuTax || ''} cols={10} /></div>
        </div>
        <div className="flex border-t border-gray-700">
          <div className="flex-1 border-r border-gray-700 text-[10px] px-1 py-1">年末調整による不足税額</div>
          <div className="p-1" style={{ width: 10 * 24 + 8 }}><D value={data.nenchoFusoku || ''} cols={10} /></div>
        </div>
        <div className="flex border-t border-gray-700">
          <div className="flex-1 border-r border-gray-700 text-[10px] px-1 py-1">年末調整による超過税額</div>
          <div className="p-1" style={{ width: 10 * 24 + 8 }}><D value={data.nenchoChoka || ''} cols={10} /></div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_220px] gap-2">
        <div className="border border-gray-700 p-2">
          <div className="text-[10px]">住所（所在地）　（電話番号 {data.phone}）</div>
          <div className="min-h-[28px] border-b border-dotted border-gray-400 pt-1">{data.address}</div>
          <div className="text-[10px] mt-2">氏名（名称）</div>
          <div className="min-h-[28px] border-b border-dotted border-gray-400 pt-1 text-right pr-2">{data.name} <span className="text-[10px]">様（御中）</span></div>
          <div className="text-[10px] mt-2">摘要</div>
          <div className="min-h-[22px]">{data.tekiyou}</div>
        </div>
        <div>
          <div className="mb-1">
            <div className="text-[10px]">納期等の区分</div>
            <div className="flex items-center gap-1">
              <span>令和</span><D value={data.noukiYear} cols={2} />
              <span>年</span><D value={data.noukiMonth} cols={2} /><span>月</span>
            </div>
            <div className="text-[10px] mt-1">支払分源泉所得税及び復興特別所得税</div>
          </div>
          <div className="border border-gray-700">
            <div className="flex border-b border-gray-700">
              <div className="w-12 px-1 py-1 border-r border-gray-700 font-bold">本税</div>
              <div className="p-1"><D value={data.honzei || ''} cols={9} /></div>
            </div>
            <div className="flex border-b border-gray-700">
              <div className="w-12 px-1 py-1 border-r border-gray-700">延滞税</div>
              <div className="p-1"><D value={data.entaizei || ''} cols={9} /></div>
            </div>
            <div className="flex">
              <div className="w-12 px-1 py-1 border-r border-gray-700 font-bold">合計額</div>
              <div className="p-1"><D value={data.goukei ? `¥${data.goukei}` : ''} cols={9} /></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
