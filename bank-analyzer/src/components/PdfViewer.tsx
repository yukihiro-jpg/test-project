'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

type Props = {
  pdfUrl: string
}

export type PdfViewerHandle = {
  goToPage: (page: number) => void
}

const MIN_SCALE = 0.4
const MAX_SCALE = 4.0
const SCALE_STEP = 0.2
const RENDER_BASE_SCALE = 1.5
const HIGHLIGHT_DURATION_MS = 1500

export const PdfViewer = forwardRef<PdfViewerHandle, Props>(function PdfViewer({ pdfUrl }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pagesRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1.0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const dragState = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  const scrollToPage = (page: number) => {
    const host = pagesRef.current
    const c = containerRef.current
    if (!host || !c) return
    const target = host.querySelector<HTMLCanvasElement>(`canvas[data-page="${page}"]`)
    if (!target) return
    // transform: scale を考慮するため、視覚座標で計算
    const targetRect = target.getBoundingClientRect()
    const containerRect = c.getBoundingClientRect()
    const offsetWithinContainer = targetRect.top - containerRect.top + c.scrollTop
    c.scrollTo({ top: Math.max(0, offsetWithinContainer - 8), behavior: 'smooth' })
    setCurrentPage(page)

    // ハイライト
    target.style.outline = '4px solid #fbbf24'
    target.style.outlineOffset = '0px'
    window.setTimeout(() => {
      target.style.outline = ''
      target.style.outlineOffset = ''
    }, HIGHLIGHT_DURATION_MS)
  }

  useImperativeHandle(ref, () => ({ goToPage: scrollToPage }), [])

  useEffect(() => {
    if (!pdfUrl) return
    let cancelled = false
    setLoading(true)
    setError(null)

    const render = async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

        const res = await fetch(pdfUrl)
        const buf = await res.arrayBuffer()
        if (cancelled) return

        const pdf = await pdfjsLib.getDocument({ data: buf }).promise
        if (cancelled) return
        setNumPages(pdf.numPages)
        setCurrentPage(1)

        const host = pagesRef.current
        if (!host) return
        host.innerHTML = ''

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          if (cancelled) return
          const viewport = page.getViewport({ scale: RENDER_BASE_SCALE })
          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          canvas.dataset.page = String(i)
          canvas.style.display = 'block'
          canvas.style.marginBottom = '8px'
          canvas.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)'
          canvas.style.background = 'white'
          canvas.style.transition = 'outline 0.15s ease'
          const ctx = canvas.getContext('2d')
          if (!ctx) continue
          await page.render({ canvasContext: ctx, viewport }).promise
          if (cancelled) return
          host.appendChild(canvas)
        }
        if (!cancelled) setLoading(false)
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message || 'PDFの読み込みに失敗しました')
          setLoading(false)
        }
      }
    }

    render()
    return () => {
      cancelled = true
    }
  }, [pdfUrl])

  // スクロール位置から現在ページを推定（最も多く見えているページを current にする）
  const handleScroll = () => {
    const c = containerRef.current
    if (!c) return
    const containerRect = c.getBoundingClientRect()
    const canvases = c.querySelectorAll<HTMLCanvasElement>('canvas[data-page]')
    let best = 1
    let bestVisibility = -1
    canvases.forEach((canvas) => {
      const r = canvas.getBoundingClientRect()
      const visibleTop = Math.max(r.top, containerRect.top)
      const visibleBottom = Math.min(r.bottom, containerRect.bottom)
      const visibility = Math.max(0, visibleBottom - visibleTop)
      if (visibility > bestVisibility) {
        bestVisibility = visibility
        best = Number(canvas.dataset.page || '1')
      }
    })
    if (best !== currentPage) setCurrentPage(best)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    const c = containerRef.current
    if (!c) return
    dragState.current = { x: e.clientX, y: e.clientY, scrollLeft: c.scrollLeft, scrollTop: c.scrollTop }
    setDragging(true)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    const c = containerRef.current
    const s = dragState.current
    if (!c || !s) return
    c.scrollLeft = s.scrollLeft - (e.clientX - s.x)
    c.scrollTop = s.scrollTop - (e.clientY - s.y)
  }

  const stopDrag = () => {
    dragState.current = null
    setDragging(false)
  }

  const handleWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    setScale((s) => clamp(s + (e.deltaY < 0 ? SCALE_STEP : -SCALE_STEP)))
  }

  const zoomIn = () => setScale((s) => clamp(s + SCALE_STEP))
  const zoomOut = () => setScale((s) => clamp(s - SCALE_STEP))
  const resetZoom = () => setScale(1.0)

  const goFirst = () => scrollToPage(1)
  const goPrev = () => scrollToPage(Math.max(1, currentPage - 1))
  const goNext = () => scrollToPage(Math.min(numPages, currentPage + 1))
  const goLast = () => scrollToPage(numPages)

  const pageBtnClass =
    'px-2 py-0.5 bg-white border rounded hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <div className="flex flex-col h-full border rounded bg-slate-100">
      <div className="flex items-center gap-1 px-2 py-1 bg-slate-200 border-b text-sm flex-wrap">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goFirst}
            disabled={currentPage <= 1 || numPages === 0}
            className={pageBtnClass}
            title="最初のページ"
          >
            ←|
          </button>
          <button
            type="button"
            onClick={goPrev}
            disabled={currentPage <= 1 || numPages === 0}
            className={pageBtnClass}
            title="前のページ"
          >
            ←
          </button>
          <span className="font-mono px-2 text-center min-w-[64px]">
            {numPages === 0 ? '-/-' : `${currentPage} / ${numPages}`}
          </span>
          <button
            type="button"
            onClick={goNext}
            disabled={currentPage >= numPages || numPages === 0}
            className={pageBtnClass}
            title="次のページ"
          >
            →
          </button>
          <button
            type="button"
            onClick={goLast}
            disabled={currentPage >= numPages || numPages === 0}
            className={pageBtnClass}
            title="最後のページ"
          >
            |→
          </button>
        </div>
        <div className="w-px h-5 bg-slate-300 mx-1" />
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={zoomOut}
            className="px-2 py-0.5 bg-white border rounded hover:bg-slate-50"
            title="縮小"
          >
            −
          </button>
          <span className="font-mono w-12 text-center">{Math.round(scale * 100)}%</span>
          <button
            type="button"
            onClick={zoomIn}
            className="px-2 py-0.5 bg-white border rounded hover:bg-slate-50"
            title="拡大"
          >
            ＋
          </button>
          <button
            type="button"
            onClick={resetZoom}
            className="px-2 py-0.5 bg-white border rounded hover:bg-slate-50"
            title="100%"
          >
            リセット
          </button>
        </div>
        <span className="text-xs text-slate-500 ml-auto">ドラッグで移動・Ctrl+ホイールで拡縮</span>
      </div>
      <div
        ref={containerRef}
        className="flex-1 overflow-auto"
        style={{ cursor: dragging ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
        onWheel={handleWheel}
        onScroll={handleScroll}
      >
        {loading && <div className="p-4 text-slate-500 text-sm">PDFを読み込み中…</div>}
        {error && <div className="p-4 text-red-600 text-sm">PDF表示エラー: {error}</div>}
        <div
          ref={pagesRef}
          style={{
            transform: `scale(${scale})`,
            transformOrigin: '0 0',
            display: 'inline-block',
            padding: '8px',
            userSelect: dragging ? 'none' : 'auto'
          }}
        />
      </div>
    </div>
  )
})

function clamp(v: number) {
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, v))
}
