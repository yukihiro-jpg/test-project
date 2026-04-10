'use client'

import { useRef, useState, useCallback } from 'react'
import type { StatementPage, JournalEntry } from '@/lib/bank-statement/types'
import BalanceInfo from './BalanceInfo'

interface Props {
  pages: StatementPage[]
  currentPageIndex: number
  onPageChange: (index: number) => void
  entries?: JournalEntry[]
  bankAccountCode?: string
  onBalanceOverride?: (pageIndex: number, field: 'openingBalance' | 'closingBalance', value: number) => void
}

const ZOOM_STEP = 10
const ZOOM_MIN = 30
const ZOOM_MAX = 300
const ZOOM_PRESETS = [50, 75, 100, 125, 150, 200]

export default function StatementViewer({
  pages,
  currentPageIndex,
  onPageChange,
  entries,
  bankAccountCode,
  onBalanceOverride,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(100)

  // ドラッグによるパン移動
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [scrollStart, setScrollStart] = useState({ x: 0, y: 0 })

  const currentPage = pages[currentPageIndex]

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // 画像エリアでのドラッグ開始
    if (!containerRef.current) return
    setIsDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
    setScrollStart({
      x: containerRef.current.scrollLeft,
      y: containerRef.current.scrollTop,
    })
    e.preventDefault()
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !containerRef.current) return
      const dx = e.clientX - dragStart.x
      const dy = e.clientY - dragStart.y
      containerRef.current.scrollLeft = scrollStart.x - dx
      containerRef.current.scrollTop = scrollStart.y - dy
    },
    [isDragging, dragStart, scrollStart],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleZoomIn = () => setZoom((z) => Math.min(z + ZOOM_STEP, ZOOM_MAX))
  const handleZoomOut = () => setZoom((z) => Math.max(z - ZOOM_STEP, ZOOM_MIN))

  if (!currentPage) return null

  return (
    <div className="flex flex-col h-full">
      {/* ページ送り + ズーム */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(currentPageIndex - 1)}
            disabled={currentPageIndex === 0}
            className="px-2 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            &lt;
          </button>
          <span className="text-xs text-gray-600 mx-1">
            {currentPageIndex + 1}/{pages.length}
          </span>
          <button
            onClick={() => onPageChange(currentPageIndex + 1)}
            disabled={currentPageIndex >= pages.length - 1}
            className="px-2 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            &gt;
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            disabled={zoom <= ZOOM_MIN}
            className="w-7 h-7 flex items-center justify-center text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            -
          </button>
          <select
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="px-1 py-1 text-xs border border-gray-300 rounded bg-white text-center w-16"
          >
            {ZOOM_PRESETS.map((p) => (
              <option key={p} value={p}>{p}%</option>
            ))}
            {!ZOOM_PRESETS.includes(zoom) && (
              <option value={zoom}>{zoom}%</option>
            )}
          </select>
          <button
            onClick={handleZoomIn}
            disabled={zoom >= ZOOM_MAX}
            className="w-7 h-7 flex items-center justify-center text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            +
          </button>
        </div>
      </div>

      {/* 画像表示エリア（ドラッグ移動対応） */}
      <div
        ref={containerRef}
        className={`flex-1 overflow-auto p-2 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {currentPage.imageDataUrl ? (
          <div className="inline-block" style={{ width: `${zoom}%`, minWidth: '100%' }}>
            <img
              src={currentPage.imageDataUrl}
              alt={`通帳ページ ${currentPageIndex + 1}`}
              className="w-full select-none pointer-events-none"
              draggable={false}
            />
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded overflow-auto">
            <table className="w-full text-xs border-collapse">
              <tbody>
                {currentPage.transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-2 py-1.5 whitespace-nowrap">{tx.date}</td>
                    <td className="px-2 py-1.5">{tx.description}</td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">
                      {tx.deposit ? tx.deposit.toLocaleString() : ''}
                    </td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">
                      {tx.withdrawal ? tx.withdrawal.toLocaleString() : ''}
                    </td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap font-medium">
                      {tx.balance.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 残高情報 */}
      <BalanceInfo page={currentPage} entries={entries} bankAccountCode={bankAccountCode} onBalanceOverride={onBalanceOverride} />
    </div>
  )
}
