'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import type { StatementPage } from '@/lib/bank-statement/types'
import BalanceInfo from './BalanceInfo'

interface Props {
  pages: StatementPage[]
  currentPageIndex: number
  onPageChange: (index: number) => void
  selectedTransactionId: string | null
}

const ZOOM_STEP = 10
const ZOOM_MIN = 30
const ZOOM_MAX = 300
const ZOOM_PRESETS = [50, 75, 100, 125, 150, 200]

export default function StatementViewer({
  pages,
  currentPageIndex,
  onPageChange,
  selectedTransactionId,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(100)
  const currentPage = pages[currentPageIndex]

  const drawPage = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || !currentPage) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (currentPage.imageDataUrl) {
      const img = new Image()
      img.onload = () => {
        // ベースサイズ: コンテナ幅にフィット
        const containerWidth = container.clientWidth - 16 // padding分
        const baseScale = containerWidth / img.width
        const zoomFactor = zoom / 100
        const finalScale = baseScale * zoomFactor

        canvas.width = img.width * finalScale
        canvas.height = img.height * finalScale

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        // ハイライト描画
        if (selectedTransactionId) {
          const tx = currentPage.transactions.find(
            (t) => t.id === selectedTransactionId,
          )
          if (tx?.boundingBox) {
            const { x, y, width, height } = tx.boundingBox
            // boundingBoxはPDF座標系（scale=1基準）なのでfinalScaleで変換
            const pdfToImg = finalScale
            ctx.save()
            ctx.fillStyle = 'rgba(59, 130, 246, 0.2)'
            ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)'
            ctx.lineWidth = 2
            ctx.fillRect(x * pdfToImg, y * pdfToImg, width * pdfToImg, height * pdfToImg)
            ctx.strokeRect(x * pdfToImg, y * pdfToImg, width * pdfToImg, height * pdfToImg)
            ctx.restore()
          }
        }
      }
      img.src = currentPage.imageDataUrl
    } else {
      canvas.width = 0
      canvas.height = 0
    }
  }, [currentPage, selectedTransactionId, zoom])

  useEffect(() => {
    drawPage()
  }, [drawPage])

  useEffect(() => {
    const handleResize = () => drawPage()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [drawPage])

  const handleZoomIn = () => setZoom((z) => Math.min(z + ZOOM_STEP, ZOOM_MAX))
  const handleZoomOut = () => setZoom((z) => Math.max(z - ZOOM_STEP, ZOOM_MIN))

  if (!currentPage) return null

  return (
    <div className="flex flex-col h-full">
      {/* ページ送り + ズームコントロール */}
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

        {/* ズームコントロール */}
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
              <option key={p} value={p}>
                {p}%
              </option>
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

      {/* 画像表示エリア */}
      <div ref={containerRef} className="flex-1 overflow-auto p-2">
        {currentPage.imageDataUrl ? (
          <canvas ref={canvasRef} />
        ) : (
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
