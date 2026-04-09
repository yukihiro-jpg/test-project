'use client'

import { useRef, useEffect, useCallback } from 'react'
import type { StatementPage } from '@/lib/bank-statement/types'
import BalanceInfo from './BalanceInfo'

interface Props {
  pages: StatementPage[]
  currentPageIndex: number
  onPageChange: (index: number) => void
  selectedTransactionId: string | null
}

export default function StatementViewer({
  pages,
  currentPageIndex,
  onPageChange,
  selectedTransactionId,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const currentPage = pages[currentPageIndex]

  const drawPage = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || !currentPage) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (currentPage.imageDataUrl) {
      // PDF画像表示
      const img = new Image()
      img.onload = () => {
        const containerWidth = container.clientWidth
        const scale = containerWidth / img.width
        canvas.width = containerWidth
        canvas.height = img.height * scale

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        // ハイライト描画
        if (selectedTransactionId) {
          const tx = currentPage.transactions.find(
            (t) => t.id === selectedTransactionId,
          )
          if (tx?.boundingBox) {
            const { x, y, width, height } = tx.boundingBox
            ctx.save()
            ctx.fillStyle = 'rgba(59, 130, 246, 0.2)'
            ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)'
            ctx.lineWidth = 2
            ctx.fillRect(
              x * scale,
              y * scale,
              width * scale,
              height * scale,
            )
            ctx.strokeRect(
              x * scale,
              y * scale,
              width * scale,
              height * scale,
            )
            ctx.restore()
          }
        }
      }
      img.src = currentPage.imageDataUrl
    } else {
      // Excel等: テーブル表示（canvasではなくHTMLで表示するため空にする）
      canvas.width = 0
      canvas.height = 0
    }
  }, [currentPage, selectedTransactionId])

  useEffect(() => {
    drawPage()
  }, [drawPage])

  // ウィンドウリサイズ時に再描画
  useEffect(() => {
    const handleResize = () => drawPage()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [drawPage])

  if (!currentPage) return null

  return (
    <div className="flex flex-col h-full">
      {/* ページ送り */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200 shrink-0">
        <button
          onClick={() => onPageChange(currentPageIndex - 1)}
          disabled={currentPageIndex === 0}
          className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          &lt; 前
        </button>
        <span className="text-sm text-gray-600">
          {currentPageIndex + 1} / {pages.length} ページ
        </span>
        <button
          onClick={() => onPageChange(currentPageIndex + 1)}
          disabled={currentPageIndex >= pages.length - 1}
          className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          次 &gt;
        </button>
      </div>

      {/* 画像表示エリア */}
      <div ref={containerRef} className="flex-1 overflow-auto p-2">
        {currentPage.imageDataUrl ? (
          <canvas ref={canvasRef} className="w-full" />
        ) : (
          /* Excel等: テーブル表示 */
          <div className="bg-white border border-gray-200 rounded overflow-auto">
            <table className="w-full text-xs border-collapse">
              <tbody>
                {currentPage.transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className={`border-b border-gray-100 ${
                      tx.id === selectedTransactionId
                        ? 'bg-blue-100 border-blue-300'
                        : 'hover:bg-gray-50'
                    }`}
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
      <BalanceInfo page={currentPage} />
    </div>
  )
}
