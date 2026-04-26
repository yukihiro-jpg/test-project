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
  const scaleRef = useRef(1.0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [numPages, setNumPages] = useState(0)
  const dragState = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    scaleRef.current = scale
  }, [scale])

  useImperativeHandle(
    ref,
    () => ({
      goToPage(page: number) {
        const host = pagesRef.current
        const c = containerRef.current
        if (!host || !c) return
        const target = host.querySelector<HTMLCanvasElement>(`canvas[data-page="${page}"]`)
        if (!target) return
        // canvas は親要素に scale() がかかっているので、レイアウト上の位置を計算
        const s = scaleRef.current
        const top = target.offsetTop * s
        c.scrollTo({ top: Math.max(0, top - 8), behavior: 'smooth' })

        // ハイライト
        target.style.outline = '4px solid #fbbf24'
        target.style.outlineOffset = '0px'
        window.setTimeout(() => {
          target.style.outline = ''
          target.style.outlineOffset = ''
        }, HIGHLIGHT_DURATION_MS)
      }
    }),
    []
  )

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

  return (
    <div className="flex flex-col h-full border rounded bg-slate-100">
      <div className="flex items-center gap-2 px-2 py-1 bg-slate-200 border-b text-sm">
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
        <span className="text-xs text-slate-500 ml-auto">
          {numPages > 0 && `${numPages}ページ`} ／ ドラッグで移動・Ctrl+ホイールで拡縮
        </span>
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
