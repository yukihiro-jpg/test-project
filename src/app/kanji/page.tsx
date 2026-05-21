'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  LESSONS,
  MIN_LESSON,
  MAX_LESSON,
  collectItems,
  normalizeKana,
  type Mode,
  type ReadItem,
  type WriteItem,
} from './data'

type Screen = 'home' | 'menu' | 'studySetup' | 'study' | 'settings' | 'quiz' | 'result'

type Question = {
  prompt: string
  answer: string
  hint?: string
}

type Stats = {
  totalCorrect: number
  totalAnswered: number
  streakDays: number
  lastDay: string
  badges: string[]
}

const STATS_KEY = 'kanji-app-stats-v1'
const SETTINGS_KEY = 'kanji-app-settings-v1'

const todayStr = () => new Date().toISOString().slice(0, 10)

function loadStats(): Stats {
  if (typeof window === 'undefined') return { totalCorrect: 0, totalAnswered: 0, streakDays: 0, lastDay: '', badges: [] }
  try {
    const raw = localStorage.getItem(STATS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { totalCorrect: 0, totalAnswered: 0, streakDays: 0, lastDay: '', badges: [] }
}
function saveStats(s: Stats) {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(s)) } catch {}
}
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ============================================================================
// Range / lesson picker (shared)
// ============================================================================
function LessonRangePicker({
  fromNo, toNo, onChange,
}: { fromNo: number; toNo: number; onChange: (f: number, t: number) => void }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow">
      <h3 className="mb-2 font-bold">学習番号のはんい：{fromNo} 〜 {toNo}</h3>
      <div className="flex flex-wrap gap-2">
        {LESSONS.map((l) => {
          const inRange = l.no >= fromNo && l.no <= toNo
          return (
            <button
              key={l.no}
              onClick={() => {
                if (l.no < fromNo) onChange(l.no, toNo)
                else if (l.no > toNo) onChange(fromNo, l.no)
                else if (l.no - fromNo < toNo - l.no) onChange(l.no, toNo)
                else onChange(fromNo, l.no)
              }}
              className={`rounded-lg border px-3 py-2 text-sm ${
                inRange ? 'border-orange-400 bg-orange-100 text-orange-900' : 'border-stone-200 bg-stone-50 text-stone-400'
              }`}
            >
              {l.no}
            </button>
          )
        })}
      </div>
      <div className="mt-2 flex gap-2">
        <button onClick={() => onChange(MIN_LESSON, MAX_LESSON)} className="rounded-lg bg-stone-100 px-3 py-1 text-xs">
          ぜんぶ
        </button>
      </div>
    </section>
  )
}

function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-base font-bold ${
        active ? 'border-orange-500 bg-orange-500 text-white' : 'border-stone-200 bg-stone-50 text-stone-700'
      }`}
    >
      {children}
    </button>
  )
}

// ============================================================================
// Home
// ============================================================================
function Home({ onStart, stats }: { onStart: () => void; stats: Stats }) {
  const acc = stats.totalAnswered > 0 ? Math.round((stats.totalCorrect / stats.totalAnswered) * 100) : 0
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="text-6xl">🦊📚</div>
      <h1 className="text-4xl font-extrabold tracking-tight text-orange-700">かんじドリル</h1>
      <p className="text-base text-stone-600">小学4年（上・新学社）</p>
      <div className="my-2 grid w-full max-w-md grid-cols-3 gap-3 rounded-2xl bg-white p-4 shadow-md">
        <Stat label="連続日数" value={`${stats.streakDays}日`} icon="🔥" />
        <Stat label="正解数" value={`${stats.totalCorrect}`} icon="⭐" />
        <Stat label="正答率" value={`${acc}%`} icon="🎯" />
      </div>
      {stats.badges.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 text-2xl">
          {stats.badges.map((b, i) => <span key={i}>{b}</span>)}
        </div>
      )}
      <button onClick={onStart} className="rounded-full bg-orange-500 px-10 py-4 text-2xl font-bold text-white shadow-lg active:scale-95">
        はじめる
      </button>
      <p className="text-xs text-stone-400">※ iPad Safariで開き「共有 → ホーム画面に追加」でアプリ化</p>
    </div>
  )
}
function Stat({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-2xl">{icon}</div>
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-stone-500">{label}</div>
    </div>
  )
}

// ============================================================================
// Mode menu (basic learning / quiz)
// ============================================================================
function ModeMenu({ onPick, onBack }: { onPick: (m: 'study' | 'quiz') => void; onBack: () => void }) {
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-xl flex-col gap-4 p-5">
      <header className="flex items-center justify-between">
        <button onClick={onBack} className="text-stone-500">← もどる</button>
        <h2 className="text-xl font-bold">なにをする？</h2>
        <span className="w-12" />
      </header>
      <button
        onClick={() => onPick('study')}
        className="rounded-3xl bg-gradient-to-br from-sky-400 to-blue-600 p-6 text-left text-white shadow-lg active:scale-95"
      >
        <div className="text-5xl">📖</div>
        <div className="mt-2 text-2xl font-extrabold">基本学習モード</div>
        <div className="mt-1 text-sm opacity-90">カードをめくって、新しい漢字・例文をじっくり覚える</div>
      </button>
      <button
        onClick={() => onPick('quiz')}
        className="rounded-3xl bg-gradient-to-br from-orange-400 to-red-500 p-6 text-left text-white shadow-lg active:scale-95"
      >
        <div className="text-5xl">📝</div>
        <div className="mt-2 text-2xl font-extrabold">問題モード</div>
        <div className="mt-1 text-sm opacity-90">読み・書きの問題に答えて、まちがいは正解するまで！</div>
      </button>
    </div>
  )
}

// ============================================================================
// Study mode (flashcards)
// ============================================================================
type StudySetting = { fromNo: number; toNo: number; what: 'kanji' | 'words' }

function StudySetup({
  initial, onBack, onStart,
}: { initial: StudySetting; onBack: () => void; onStart: (s: StudySetting) => void }) {
  const [s, setS] = useState<StudySetting>(initial)
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-xl flex-col gap-4 p-5">
      <header className="flex items-center justify-between">
        <button onClick={onBack} className="text-stone-500">← もどる</button>
        <h2 className="text-xl font-bold">基本学習のせってい</h2>
        <span className="w-12" />
      </header>
      <section className="rounded-2xl bg-white p-4 shadow">
        <h3 className="mb-2 font-bold">なにを覚える？</h3>
        <div className="grid grid-cols-2 gap-2">
          <Toggle active={s.what === 'kanji'} onClick={() => setS({ ...s, what: 'kanji' })}>新しい漢字</Toggle>
          <Toggle active={s.what === 'words'} onClick={() => setS({ ...s, what: 'words' })}>単語（読み）</Toggle>
        </div>
      </section>
      <LessonRangePicker fromNo={s.fromNo} toNo={s.toNo} onChange={(f, t) => setS({ ...s, fromNo: f, toNo: t })} />
      <button
        onClick={() => onStart(s)}
        className="mt-2 rounded-full bg-sky-500 px-8 py-4 text-xl font-bold text-white shadow-lg active:scale-95"
      >
        スタート
      </button>
    </div>
  )
}

type Card = { front: string; back: string; sub?: string; examples?: string[] }

function StudyView({ setting, onExit }: { setting: StudySetting; onExit: () => void }) {
  const cards = useMemo<Card[]>(() => {
    const out: Card[] = []
    for (const l of LESSONS) {
      if (l.no < setting.fromNo || l.no > setting.toNo) continue
      if (setting.what === 'kanji') {
        for (const k of l.newKanji) {
          out.push({ front: k.kanji, back: k.readings, sub: `学習${l.no}・${l.unit}`, examples: k.examples })
        }
      } else {
        for (const r of l.read) {
          out.push({ front: r.kanji, back: r.reading, sub: `学習${l.no}` + (r.hint ? `｜${r.hint.replace('__', '〇〇')}` : '') })
        }
      }
    }
    return out
  }, [setting])

  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)

  if (cards.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="mb-4">この範囲にカードがありません</p>
        <button onClick={onExit} className="rounded-full bg-stone-200 px-6 py-2">もどる</button>
      </div>
    )
  }
  const c = cards[idx]
  const next = () => { setFlipped(false); setIdx((idx + 1) % cards.length) }
  const prev = () => { setFlipped(false); setIdx((idx - 1 + cards.length) % cards.length) }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-xl flex-col gap-3 p-4">
      <header className="flex items-center justify-between">
        <button onClick={onExit} className="rounded-full bg-stone-200 px-3 py-1 text-sm">✕ やめる</button>
        <span className="text-sm text-stone-600">{idx + 1} / {cards.length}</span>
        <span className="w-12" />
      </header>
      <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200">
        <div className="h-full bg-sky-500" style={{ width: `${((idx + 1) / cards.length) * 100}%` }} />
      </div>
      <button
        onClick={() => setFlipped(!flipped)}
        className="flex min-h-[300px] flex-1 flex-col items-center justify-center rounded-3xl bg-white p-6 text-center shadow-lg active:scale-[0.98]"
      >
        {c.sub && <p className="mb-2 text-xs text-stone-400">{c.sub}</p>}
        <div
          className={`font-bold text-stone-900 ${setting.what === 'kanji' ? 'text-9xl' : 'text-6xl'}`}
          style={{ fontFamily: "'Hiragino Mincho ProN','Yu Mincho',serif" }}
        >
          {c.front}
        </div>
        {flipped && (
          <div className="mt-6 space-y-2">
            <div className="text-3xl font-bold text-orange-600">{c.back}</div>
            {c.examples && c.examples.map((ex, i) => (
              <div key={i} className="text-sm text-stone-600">・{ex}</div>
            ))}
          </div>
        )}
        {!flipped && <p className="mt-6 text-sm text-stone-400">タップで答え</p>}
      </button>
      <div className="grid grid-cols-3 gap-2">
        <button onClick={prev} className="rounded-full bg-stone-200 px-4 py-3 font-bold">← まえ</button>
        <button onClick={() => setFlipped(!flipped)} className="rounded-full bg-sky-100 px-4 py-3 font-bold text-sky-700">
          {flipped ? '🙈 ふせる' : '👀 みる'}
        </button>
        <button onClick={next} className="rounded-full bg-sky-500 px-4 py-3 font-bold text-white">つぎ →</button>
      </div>
    </div>
  )
}

// ============================================================================
// Settings (quiz)
// ============================================================================
type SettingsState = {
  mode: Mode
  fromNo: number
  toNo: number
  count: number
  loopWrong: boolean
  readInput: 'voice' | 'text'
}

function loadSettings(): SettingsState {
  if (typeof window === 'undefined') return { mode: 'read', fromNo: MIN_LESSON, toNo: MAX_LESSON, count: 10, loopWrong: true, readInput: 'voice' }
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { mode: 'read', fromNo: MIN_LESSON, toNo: MAX_LESSON, count: 10, loopWrong: true, readInput: 'voice' }
}

function Settings({
  initial, onBack, onStart,
}: { initial: SettingsState; onBack: () => void; onStart: (s: SettingsState) => void }) {
  const [s, setS] = useState<SettingsState>(initial)
  const max = collectItems(s.mode, s.fromNo, s.toNo).length
  const count = Math.min(s.count, max || 1)
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-xl flex-col gap-4 p-5">
      <header className="flex items-center justify-between">
        <button onClick={onBack} className="text-stone-500">← もどる</button>
        <h2 className="text-xl font-bold">問題のせってい</h2>
        <span className="w-12" />
      </header>
      <section className="rounded-2xl bg-white p-4 shadow">
        <h3 className="mb-2 font-bold">問題のしゅるい</h3>
        <div className="grid grid-cols-2 gap-2">
          <Toggle active={s.mode === 'read'} onClick={() => setS({ ...s, mode: 'read' })}>読み問題</Toggle>
          <Toggle active={s.mode === 'write'} onClick={() => setS({ ...s, mode: 'write' })}>書き問題</Toggle>
        </div>
      </section>
      {s.mode === 'read' && (
        <section className="rounded-2xl bg-white p-4 shadow">
          <h3 className="mb-2 font-bold">読み問題の答え方</h3>
          <div className="grid grid-cols-2 gap-2">
            <Toggle active={s.readInput === 'voice'} onClick={() => setS({ ...s, readInput: 'voice' })}>🎤 こえで答える</Toggle>
            <Toggle active={s.readInput === 'text'} onClick={() => setS({ ...s, readInput: 'text' })}>✍️ 書いて答える</Toggle>
          </div>
          <p className="mt-2 text-xs text-stone-500">「書いて答える」はApple Pencilで枠内に書くと文字に変換されます（Scribble）</p>
        </section>
      )}
      {s.mode === 'write' && (
        <section className="rounded-2xl bg-white p-4 shadow text-sm text-stone-600">
          <p>✍️ Apple Pencilで答えの枠内に <b>漢字</b> を書くと自動で文字に変換されます（iPadOSのScribble機能）。練習用キャンバスも使えます。</p>
        </section>
      )}
      <LessonRangePicker fromNo={s.fromNo} toNo={s.toNo} onChange={(f, t) => setS({ ...s, fromNo: f, toNo: t })} />
      <section className="rounded-2xl bg-white p-4 shadow">
        <h3 className="mb-2 font-bold">問題数：{count}</h3>
        <div className="flex flex-wrap gap-2">
          {[5, 10, 15, 20, 30].map((n) => (
            <Toggle key={n} active={s.count === n} onClick={() => setS({ ...s, count: n })}>{n}問</Toggle>
          ))}
        </div>
        <p className="mt-2 text-xs text-stone-500">この範囲には {max} 問あります</p>
      </section>
      <section className="rounded-2xl bg-white p-4 shadow">
        <label className="flex items-center justify-between">
          <span className="font-bold">まちがえた問題をくりかえす</span>
          <input type="checkbox" checked={s.loopWrong} onChange={(e) => setS({ ...s, loopWrong: e.target.checked })} className="h-6 w-6" />
        </label>
      </section>
      <button
        onClick={() => {
          try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...s, count })) } catch {}
          onStart({ ...s, count })
        }}
        disabled={max === 0}
        className="mt-2 rounded-full bg-orange-500 px-8 py-4 text-xl font-bold text-white shadow-lg active:scale-95 disabled:bg-stone-300"
      >
        スタート
      </button>
    </div>
  )
}

// ============================================================================
// Drawing pad (練習用)
// ============================================================================
function DrawingPad({ width = 280, height = 280 }: { width?: number; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const resetCanvas = () => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height)
    ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(c.width / 2, 0); ctx.lineTo(c.width / 2, c.height)
    ctx.moveTo(0, c.height / 2); ctx.lineTo(c.width, c.height / 2); ctx.stroke()
    ctx.setLineDash([4, 6]); ctx.strokeRect(8, 8, c.width - 16, c.height - 16); ctx.setLineDash([])
  }
  useEffect(() => { resetCanvas() }, [])
  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = ref.current!; const r = c.getBoundingClientRect()
    return { x: ((e.clientX - r.left) * c.width) / r.width, y: ((e.clientY - r.top) * c.height) / r.height }
  }
  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault(); drawing.current = true; last.current = pos(e)
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return; e.preventDefault()
    const c = ref.current!; const ctx = c.getContext('2d')!; const p = pos(e)
    ctx.strokeStyle = '#1c1917'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.beginPath(); ctx.moveTo(last.current!.x, last.current!.y); ctx.lineTo(p.x, p.y); ctx.stroke()
    last.current = p
  }
  const end = () => { drawing.current = false; last.current = null }
  return (
    <div className="flex flex-col items-center gap-2">
      <canvas
        ref={ref} width={width} height={height}
        onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
        style={{ touchAction: 'none' }}
        className="rounded-xl border-2 border-stone-300 bg-white shadow"
      />
      <button onClick={resetCanvas} className="rounded-lg bg-stone-200 px-4 py-1 text-sm text-stone-700">🧽 けす</button>
    </div>
  )
}

// ============================================================================
// Voice input - 自動文字起こし＆自動判定
// ============================================================================
function VoiceAnswer({
  expected, onJudge,
}: { expected: string; onJudge: (ok: boolean, transcript: string) => void }) {
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(true)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<any>(null)
  const judgedRef = useRef(false)

  useEffect(() => {
    const W = window as any
    const SR = W.SpeechRecognition || W.webkitSpeechRecognition
    if (!SR) { setSupported(false); return }
    const rec = new SR()
    rec.lang = 'ja-JP'
    rec.interimResults = true
    rec.continuous = false
    rec.maxAlternatives = 5
    rec.onresult = (ev: any) => {
      let finalText = ''
      let interimText = ''
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i]
        if (res.isFinal) {
          // 複数候補のうち expected に一致するものがあれば優先
          let best = res[0].transcript
          for (let j = 0; j < res.length; j++) {
            if (normalizeKana(res[j].transcript) === normalizeKana(expected)) {
              best = res[j].transcript; break
            }
          }
          finalText += best
        } else {
          interimText += res[0].transcript
        }
      }
      const text = finalText || interimText
      setTranscript(text)
      if (finalText && !judgedRef.current) {
        judgedRef.current = true
        const ok = normalizeKana(finalText) === normalizeKana(expected)
        setTimeout(() => onJudge(ok, finalText), 600)
      }
    }
    rec.onerror = (e: any) => {
      setError(
        e.error === 'not-allowed' ? 'マイクの許可がありません。Safari設定からマイクを許可してください。' :
        e.error === 'no-speech' ? '声が聞きとれませんでした。もう一度ためしてみよう' :
        e.error === 'audio-capture' ? 'マイクが見つかりません' :
        'エラー: ' + e.error
      )
      setListening(false)
    }
    rec.onend = () => setListening(false)
    recRef.current = rec
    return () => { try { rec.stop() } catch {} }
  }, [expected, onJudge])

  // expected が変わったらリセット
  useEffect(() => {
    judgedRef.current = false
    setTranscript('')
    setError(null)
  }, [expected])

  const start = () => {
    if (!recRef.current) return
    setTranscript(''); setError(null); judgedRef.current = false
    try { recRef.current.start(); setListening(true) } catch (e) {
      try { recRef.current.stop(); recRef.current.start(); setListening(true) } catch {}
    }
  }
  const stop = () => { try { recRef.current?.stop() } catch {} }

  if (!supported) {
    return <p className="text-sm text-red-600">このブラウザでは音声入力に対応していません。「書いて答える」をご利用ください。</p>
  }
  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={listening ? stop : start}
        className={`flex h-28 w-28 items-center justify-center rounded-full text-5xl shadow-lg active:scale-95 ${
          listening ? 'animate-pulse bg-red-500 text-white' : 'bg-orange-500 text-white'
        }`}
      >
        🎤
      </button>
      <p className="text-sm text-stone-600">
        {listening ? '聞いています…（もう一度押すと止まります）' : 'タップしてはなす'}
      </p>
      {transcript && (
        <div className="rounded-xl bg-stone-100 px-4 py-2 text-center">
          <p className="text-xs text-stone-500">聞きとれた言葉</p>
          <p className="text-2xl font-bold">「{transcript}」</p>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}

// ============================================================================
// Text answer (Scribble対応のテキスト入力)
// ============================================================================
function TextAnswer({
  expected, mode, onJudge,
}: { expected: string; mode: 'read' | 'write'; onJudge: (ok: boolean, text: string) => void }) {
  const [text, setText] = useState('')
  useEffect(() => { setText('') }, [expected])
  const compare = (a: string, b: string) => {
    if (mode === 'read') return normalizeKana(a) === normalizeKana(b)
    // write: 余分な空白を除去して厳密比較
    return a.replace(/\s+/g, '') === b.replace(/\s+/g, '')
  }
  const submit = () => {
    if (!text.trim()) return
    const ok = compare(text, expected)
    onJudge(ok, text)
  }
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <input
        type="text"
        inputMode="text"
        lang="ja"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
        placeholder={mode === 'read' ? 'ひらがなで答え' : '漢字で答え'}
        className="w-full max-w-md rounded-2xl border-2 border-orange-300 bg-white px-5 py-6 text-center text-4xl shadow"
        style={{ fontFamily: "'Hiragino Mincho ProN','Yu Mincho',serif", minHeight: 100 }}
      />
      <p className="text-xs text-stone-500">Apple Pencilで枠内に書くと文字に変換されます（Scribble機能）</p>
      <button
        onClick={submit}
        disabled={!text.trim()}
        className="rounded-full bg-orange-500 px-8 py-3 text-lg font-bold text-white shadow active:scale-95 disabled:bg-stone-300"
      >
        ✅ こたえる
      </button>
    </div>
  )
}

// ============================================================================
// Quiz
// ============================================================================
function toQuestions(s: SettingsState, override: Question[] | null): Question[] {
  if (override && override.length > 0) return shuffle(override)
  const items = collectItems(s.mode, s.fromNo, s.toNo)
  return shuffle(items).slice(0, s.count).map((it) => {
    if (s.mode === 'read') {
      const r = it as ReadItem
      return { prompt: r.kanji, answer: r.reading, hint: r.hint }
    }
    const w = it as WriteItem
    return { prompt: w.reading, answer: w.kanji, hint: w.hint }
  })
}

function Quiz({
  settings, overrideQuestions, onFinish, onAbort,
}: {
  settings: SettingsState
  overrideQuestions: Question[] | null
  onFinish: (r: { correct: number; total: number; wrong: Question[] }) => void
  onAbort: (r: { correct: number; total: number; wrong: Question[] }) => void
}) {
  const initial = useMemo(() => toQuestions(settings, overrideQuestions), [settings, overrideQuestions])
  const [queue, setQueue] = useState<Question[]>(initial)
  const [idx, setIdx] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [wrongSet, setWrongSet] = useState<Question[]>([])
  const [feedback, setFeedback] = useState<null | { ok: boolean; user: string }>(null)
  const total = initial.length
  const q = queue[idx]
  const isReadVoice = settings.mode === 'read' && settings.readInput === 'voice'

  const judge = (ok: boolean, user: string) => {
    setFeedback({ ok, user })
  }
  const proceed = () => {
    if (!feedback || !q) return
    const ok = feedback.ok
    const nextCorrect = ok ? correct + 1 : correct
    let nextQueue = queue
    let nextWrong = wrongSet
    if (ok) setCorrect(nextCorrect)
    else {
      if (!wrongSet.find((w) => w.answer === q.answer && w.prompt === q.prompt)) {
        nextWrong = [...wrongSet, q]
        setWrongSet(nextWrong)
      }
      if (settings.loopWrong) {
        nextQueue = [...queue, q]
        setQueue(nextQueue)
      }
    }
    setFeedback(null)
    if (idx + 1 >= nextQueue.length) {
      onFinish({ correct: nextCorrect, total, wrong: nextWrong })
      return
    }
    setIdx(idx + 1)
  }
  const handleAbort = () => {
    if (confirm('問題をやめて結果画面に行きますか？')) {
      onAbort({ correct, total, wrong: wrongSet })
    }
  }
  const skip = () => {
    // 答えを見ずに「わからない」→ 不正解扱い
    setFeedback({ ok: false, user: '（パス）' })
  }

  if (!q) return <div className="p-6 text-center">問題がありません</div>
  const progress = Math.round(((idx + 1) / queue.length) * 100)

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-xl flex-col gap-3 p-4">
      <header className="flex items-center justify-between">
        <button onClick={handleAbort} className="rounded-full bg-stone-200 px-3 py-1 text-sm font-bold text-stone-700">
          ✕ やめる
        </button>
        <span className="text-sm text-stone-600">{idx + 1} / {queue.length}問</span>
        <span className="text-sm text-stone-600">⭐ {correct}</span>
      </header>
      <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200">
        <div className="h-full bg-orange-500 transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="mt-2 rounded-2xl bg-white p-6 text-center shadow">
        <p className="text-sm text-stone-500">
          {settings.mode === 'read' ? '次の漢字の読みは？' : '次の読みを漢字で書こう'}
        </p>
        {q.hint && <p className="mt-2 text-xs text-stone-400">{q.hint.replace('__', '〇〇')}</p>}
        <div
          className={`mt-4 ${settings.mode === 'read' ? 'text-7xl' : 'text-5xl'} font-bold text-stone-900`}
          style={{ fontFamily: "'Hiragino Mincho ProN','Yu Mincho',serif" }}
        >
          {q.prompt}
        </div>
      </div>

      {!feedback && (
        <div className="my-2 flex flex-col items-center gap-3">
          {isReadVoice ? (
            <VoiceAnswer expected={q.answer} onJudge={judge} />
          ) : (
            <>
              <TextAnswer expected={q.answer} mode={settings.mode} onJudge={judge} />
              {settings.mode === 'write' && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-center text-xs text-stone-500">✏️ 練習スペースを開く</summary>
                  <div className="mt-2"><DrawingPad width={280} height={280} /></div>
                </details>
              )}
            </>
          )}
          <button onClick={skip} className="mt-2 text-xs text-stone-400 underline">
            わからない（パス）
          </button>
        </div>
      )}

      {feedback && (
        <div className={`rounded-xl p-4 text-center ${feedback.ok ? 'bg-emerald-100' : 'bg-red-100'}`}>
          <p className="text-3xl font-bold">{feedback.ok ? '⭕ せいかい！' : '❌ ちがうよ'}</p>
          <p className="mt-2 text-xs text-stone-500">あなたの答え</p>
          <p className="text-xl">{feedback.user}</p>
          <p className="mt-2 text-xs text-stone-500">正しい答え</p>
          <p className="text-3xl font-bold text-orange-700" style={{ fontFamily: "'Hiragino Mincho ProN','Yu Mincho',serif" }}>
            {q.answer}
          </p>
          <button
            onClick={proceed}
            className="mt-4 w-full rounded-full bg-orange-500 px-6 py-3 text-lg font-bold text-white shadow active:scale-95"
          >
            つぎへ →
          </button>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Result
// ============================================================================
function Result({
  correct, total, wrong, onHome, onRetry, onRetryWrong,
}: {
  correct: number; total: number; wrong: Question[]
  onHome: () => void; onRetry: () => void; onRetryWrong: () => void
}) {
  const rate = total > 0 ? Math.round((correct / total) * 100) : 0
  const cheer = rate === 100 ? '🏆 パーフェクト！' : rate >= 80 ? '🎉 すごい！' : rate >= 50 ? '💪 もうちょっと！' : '🌱 つづけよう'
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-xl flex-col gap-4 p-6 text-center">
      <h2 className="text-3xl font-bold">けっか</h2>
      <div className="rounded-3xl bg-white p-6 shadow">
        <p className="text-6xl">{rate === 100 ? '🏆' : rate >= 80 ? '🌟' : rate >= 50 ? '🎈' : '🌱'}</p>
        <p className="mt-2 text-4xl font-extrabold text-orange-600">{correct} / {total}</p>
        <p className="text-stone-500">正答率 {rate}%</p>
        <p className="mt-2 font-bold">{cheer}</p>
      </div>
      {wrong.length > 0 && (
        <div className="rounded-2xl bg-white p-4 text-left shadow">
          <h3 className="mb-2 font-bold">まちがえた問題</h3>
          <ul className="space-y-1 text-sm">
            {wrong.map((w, i) => (
              <li key={i} className="flex justify-between border-b border-stone-100 py-1">
                <span style={{ fontFamily: "'Hiragino Mincho ProN','Yu Mincho',serif" }}>{w.prompt}</span>
                <span className="text-orange-700">→ {w.answer}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid grid-cols-1 gap-2">
        {wrong.length > 0 && (
          <button onClick={onRetryWrong} className="rounded-full bg-orange-500 px-6 py-3 font-bold text-white shadow active:scale-95">
            ❌ まちがえた問題だけもう一度
          </button>
        )}
        <button onClick={onRetry} className="rounded-full bg-stone-200 px-6 py-3 font-bold text-stone-800 active:scale-95">
          🔁 同じせっていでもう一度
        </button>
        <button onClick={onHome} className="rounded-full bg-stone-100 px-6 py-3 font-bold text-stone-700 active:scale-95">
          🏠 ホームへ
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// Root
// ============================================================================
export default function KanjiAppPage() {
  const [screen, setScreen] = useState<Screen>('home')
  const [settings, setSettings] = useState<SettingsState | null>(null)
  const [study, setStudy] = useState<StudySetting>({ fromNo: MIN_LESSON, toNo: MAX_LESSON, what: 'kanji' })
  const [stats, setStats] = useState<Stats>(() => loadStats())
  const [lastResult, setLastResult] = useState<{ correct: number; total: number; wrong: Question[] } | null>(null)
  const [override, setOverride] = useState<Question[] | null>(null)

  useEffect(() => { setStats(loadStats()) }, [])

  const recordResult = (r: { correct: number; total: number; wrong: Question[] }) => {
    setLastResult(r)
    const today = todayStr()
    const next: Stats = { ...stats }
    next.totalAnswered += r.total
    next.totalCorrect += r.correct
    if (next.lastDay !== today) {
      const y = new Date(); y.setDate(y.getDate() - 1)
      const yStr = y.toISOString().slice(0, 10)
      next.streakDays = stats.lastDay === yStr ? stats.streakDays + 1 : 1
      next.lastDay = today
    }
    const badges = new Set(next.badges)
    if (next.totalCorrect >= 10) badges.add('🥉')
    if (next.totalCorrect >= 50) badges.add('🥈')
    if (next.totalCorrect >= 100) badges.add('🥇')
    if (next.streakDays >= 3) badges.add('🔥')
    if (next.streakDays >= 7) badges.add('⚡')
    if (r.total > 0 && r.correct === r.total) badges.add('🏆')
    next.badges = Array.from(badges)
    setStats(next); saveStats(next)
    setScreen('result')
  }

  return (
    <main
      className="min-h-[100dvh] w-full bg-gradient-to-b from-orange-50 to-amber-100 text-stone-900"
      style={{ WebkitTapHighlightColor: 'transparent', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {screen === 'home' && <Home stats={stats} onStart={() => setScreen('menu')} />}
      {screen === 'menu' && (
        <ModeMenu
          onBack={() => setScreen('home')}
          onPick={(m) => setScreen(m === 'study' ? 'studySetup' : 'settings')}
        />
      )}
      {screen === 'studySetup' && (
        <StudySetup
          initial={study}
          onBack={() => setScreen('menu')}
          onStart={(s) => { setStudy(s); setScreen('study') }}
        />
      )}
      {screen === 'study' && (
        <StudyView setting={study} onExit={() => setScreen('menu')} />
      )}
      {screen === 'settings' && (
        <Settings
          initial={loadSettings()}
          onBack={() => setScreen('menu')}
          onStart={(s) => { setSettings(s); setOverride(null); setScreen('quiz') }}
        />
      )}
      {screen === 'quiz' && settings && (
        <Quiz
          key={(override ? 'w' : 'n') + JSON.stringify(settings)}
          settings={settings}
          overrideQuestions={override}
          onFinish={recordResult}
          onAbort={recordResult}
        />
      )}
      {screen === 'result' && lastResult && settings && (
        <Result
          {...lastResult}
          onHome={() => setScreen('home')}
          onRetry={() => { setOverride(null); setScreen('quiz') }}
          onRetryWrong={() => { setOverride(lastResult.wrong); setScreen('quiz') }}
        />
      )}
    </main>
  )
}
