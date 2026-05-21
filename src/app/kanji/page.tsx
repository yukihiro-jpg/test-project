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

type Screen = 'home' | 'settings' | 'quiz' | 'result'

type Question = (ReadItem | WriteItem) & {
  // 出題側で扱う共通フィールド
  prompt: string // 画面に表示する設問本文
  answer: string // 正解
  hint?: string
}

type Stats = {
  totalCorrect: number
  totalAnswered: number
  streakDays: number
  lastDay: string // YYYY-MM-DD
  badges: string[]
}

const STATS_KEY = 'kanji-app-stats-v1'
const SETTINGS_KEY = 'kanji-app-settings-v1'

const todayStr = () => new Date().toISOString().slice(0, 10)

function loadStats(): Stats {
  if (typeof window === 'undefined') {
    return { totalCorrect: 0, totalAnswered: 0, streakDays: 0, lastDay: '', badges: [] }
  }
  try {
    const raw = localStorage.getItem(STATS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { totalCorrect: 0, totalAnswered: 0, streakDays: 0, lastDay: '', badges: [] }
}

function saveStats(s: Stats) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(s))
  } catch {}
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
          {stats.badges.map((b, i) => (
            <span key={i} title={b}>
              {b}
            </span>
          ))}
        </div>
      )}

      <button
        onClick={onStart}
        className="rounded-full bg-orange-500 px-10 py-4 text-2xl font-bold text-white shadow-lg active:scale-95"
      >
        はじめる
      </button>
      <p className="text-xs text-stone-400">
        ※ iPadのSafariで開き「共有 → ホーム画面に追加」でアプリ化できます
      </p>
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
// Settings
// ============================================================================
type SettingsState = {
  mode: Mode
  fromNo: number
  toNo: number
  count: number
  loopWrong: boolean
  readInput: 'voice' | 'write' // 読み問題の入力方式
}

function loadSettings(): SettingsState {
  if (typeof window === 'undefined') {
    return { mode: 'read', fromNo: MIN_LESSON, toNo: MAX_LESSON, count: 10, loopWrong: true, readInput: 'voice' }
  }
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { mode: 'read', fromNo: MIN_LESSON, toNo: MAX_LESSON, count: 10, loopWrong: true, readInput: 'voice' }
}

function Settings({
  initial,
  onBack,
  onStart,
}: {
  initial: SettingsState
  onBack: () => void
  onStart: (s: SettingsState) => void
}) {
  const [s, setS] = useState<SettingsState>(initial)
  const max = collectItems(s.mode, s.fromNo, s.toNo).length
  const count = Math.min(s.count, max || 1)
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-xl flex-col gap-4 p-5">
      <header className="flex items-center justify-between">
        <button onClick={onBack} className="text-stone-500">
          ← もどる
        </button>
        <h2 className="text-xl font-bold">学習せってい</h2>
        <span className="w-12" />
      </header>

      <section className="rounded-2xl bg-white p-4 shadow">
        <h3 className="mb-2 font-bold">問題のしゅるい</h3>
        <div className="grid grid-cols-2 gap-2">
          <Toggle active={s.mode === 'read'} onClick={() => setS({ ...s, mode: 'read' })}>
            読み問題
          </Toggle>
          <Toggle active={s.mode === 'write'} onClick={() => setS({ ...s, mode: 'write' })}>
            書き問題
          </Toggle>
        </div>
      </section>

      {s.mode === 'read' && (
        <section className="rounded-2xl bg-white p-4 shadow">
          <h3 className="mb-2 font-bold">読み問題の答え方</h3>
          <div className="grid grid-cols-2 gap-2">
            <Toggle active={s.readInput === 'voice'} onClick={() => setS({ ...s, readInput: 'voice' })}>
              🎤 こえで答える
            </Toggle>
            <Toggle active={s.readInput === 'write'} onClick={() => setS({ ...s, readInput: 'write' })}>
              ✍️ 書いて答える
            </Toggle>
          </div>
        </section>
      )}

      <section className="rounded-2xl bg-white p-4 shadow">
        <h3 className="mb-2 font-bold">
          学習番号のはんい：{s.fromNo} 〜 {s.toNo}
        </h3>
        <div className="flex flex-wrap gap-2">
          {LESSONS.map((l) => {
            const inRange = l.no >= s.fromNo && l.no <= s.toNo
            return (
              <button
                key={l.no}
                onClick={() => {
                  // クリックした番号をはんいの端に
                  if (l.no < s.fromNo) setS({ ...s, fromNo: l.no })
                  else if (l.no > s.toNo) setS({ ...s, toNo: l.no })
                  else if (l.no - s.fromNo < s.toNo - l.no) setS({ ...s, fromNo: l.no })
                  else setS({ ...s, toNo: l.no })
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
          <button
            onClick={() => setS({ ...s, fromNo: MIN_LESSON, toNo: MAX_LESSON })}
            className="rounded-lg bg-stone-100 px-3 py-1 text-xs"
          >
            ぜんぶ
          </button>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow">
        <h3 className="mb-2 font-bold">問題数：{count}</h3>
        <div className="flex flex-wrap gap-2">
          {[5, 10, 15, 20, 30].map((n) => (
            <Toggle key={n} active={s.count === n} onClick={() => setS({ ...s, count: n })}>
              {n}問
            </Toggle>
          ))}
        </div>
        <p className="mt-2 text-xs text-stone-500">この範囲には {max} 問あります</p>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow">
        <label className="flex items-center justify-between">
          <span className="font-bold">まちがえた問題をくりかえす</span>
          <input
            type="checkbox"
            checked={s.loopWrong}
            onChange={(e) => setS({ ...s, loopWrong: e.target.checked })}
            className="h-6 w-6"
          />
        </label>
        <p className="mt-1 text-xs text-stone-500">正解するまで何回でも出題します</p>
      </section>

      <button
        onClick={() => {
          try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...s, count }))
          } catch {}
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
// Drawing canvas（手書き入力）
// ============================================================================
function DrawingPad({
  width = 320,
  height = 320,
  inkColor = '#1c1917',
}: {
  width?: number
  height?: number
  inkColor?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, c.width, c.height)
    // うすいマス目
    ctx.strokeStyle = '#fde68a'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(c.width / 2, 0)
    ctx.lineTo(c.width / 2, c.height)
    ctx.moveTo(0, c.height / 2)
    ctx.lineTo(c.width, c.height / 2)
    ctx.stroke()
    ctx.setLineDash([4, 6])
    ctx.strokeRect(8, 8, c.width - 16, c.height - 16)
    ctx.setLineDash([])
  }, [])

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = ref.current!
    const r = c.getBoundingClientRect()
    return { x: ((e.clientX - r.left) * c.width) / r.width, y: ((e.clientY - r.top) * c.height) / r.height }
  }

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    drawing.current = true
    last.current = pos(e)
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    e.preventDefault()
    const c = ref.current!
    const ctx = c.getContext('2d')!
    const p = pos(e)
    ctx.strokeStyle = inkColor
    ctx.lineWidth = 6
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(last.current!.x, last.current!.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    last.current = p
  }
  const end = () => {
    drawing.current = false
    last.current = null
  }
  const clear = () => {
    const c = ref.current!
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.strokeStyle = '#fde68a'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(c.width / 2, 0)
    ctx.lineTo(c.width / 2, c.height)
    ctx.moveTo(0, c.height / 2)
    ctx.lineTo(c.width, c.height / 2)
    ctx.stroke()
    ctx.setLineDash([4, 6])
    ctx.strokeRect(8, 8, c.width - 16, c.height - 16)
    ctx.setLineDash([])
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <canvas
        ref={ref}
        width={width}
        height={height}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        style={{ touchAction: 'none' }}
        className="rounded-xl border-2 border-orange-300 bg-white shadow"
      />
      <button onClick={clear} className="rounded-lg bg-stone-200 px-4 py-1 text-sm text-stone-700">
        🧽 けす
      </button>
    </div>
  )
}

// ============================================================================
// Voice input (Web Speech API)
// ============================================================================
function VoiceInput({ onResult }: { onResult: (text: string) => void }) {
  const [listening, setListening] = useState(false)
  const [text, setText] = useState('')
  const [supported, setSupported] = useState(true)
  const recRef = useRef<any>(null)

  useEffect(() => {
    const W = window as any
    const SR = W.SpeechRecognition || W.webkitSpeechRecognition
    if (!SR) {
      setSupported(false)
      return
    }
    const rec = new SR()
    rec.lang = 'ja-JP'
    rec.interimResults = false
    rec.maxAlternatives = 3
    rec.onresult = (ev: any) => {
      const candidates: string[] = []
      const res = ev.results[0]
      for (let i = 0; i < res.length; i++) candidates.push(res[i].transcript)
      const picked = candidates[0] || ''
      setText(picked)
      onResult(picked)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recRef.current = rec
    return () => {
      try {
        rec.stop()
      } catch {}
    }
  }, [onResult])

  const start = () => {
    if (!recRef.current) return
    setText('')
    try {
      recRef.current.start()
      setListening(true)
    } catch {}
  }

  if (!supported) {
    return <p className="text-sm text-red-600">このブラウザでは音声入力に対応していません。「書いて答える」をご利用ください。</p>
  }
  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={start}
        className={`flex h-28 w-28 items-center justify-center rounded-full text-5xl shadow-lg active:scale-95 ${
          listening ? 'animate-pulse bg-red-500 text-white' : 'bg-orange-500 text-white'
        }`}
      >
        🎤
      </button>
      <p className="text-sm text-stone-600">{listening ? '聞いています…' : 'タップしてはなす'}</p>
      {text && <p className="text-2xl font-bold">「{text}」</p>}
    </div>
  )
}

// ============================================================================
// Quiz
// ============================================================================
function toQuestion(mode: Mode, it: ReadItem | WriteItem): Question {
  if (mode === 'read') {
    const r = it as ReadItem
    return { ...r, prompt: r.kanji, answer: r.reading, hint: r.hint }
  }
  const w = it as WriteItem
  return { ...w, prompt: w.reading, answer: w.kanji, hint: w.hint }
}

function Quiz({
  settings,
  onFinish,
}: {
  settings: SettingsState
  onFinish: (r: { correct: number; total: number; wrong: Question[] }) => void
}) {
  const initial = useMemo(() => {
    const items = collectItems(settings.mode, settings.fromNo, settings.toNo)
    const picked = shuffle(items).slice(0, settings.count)
    return picked.map((it) => toQuestion(settings.mode, it))
  }, [settings])

  const [queue, setQueue] = useState<Question[]>(initial)
  const [idx, setIdx] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [wrongSet, setWrongSet] = useState<Question[]>([])
  const [revealed, setRevealed] = useState(false)
  const [voiceAnswer, setVoiceAnswer] = useState('')
  const total = initial.length
  const q = queue[idx]

  const isReadVoice = settings.mode === 'read' && settings.readInput === 'voice'

  const next = (gotIt: boolean) => {
    let nextQueue = queue
    let nextWrong = wrongSet
    const nextCorrect = gotIt ? correct + 1 : correct
    if (gotIt) {
      setCorrect(nextCorrect)
    } else {
      // 重複しないように
      if (!wrongSet.find((w) => w.answer === q.answer && w.prompt === q.prompt)) {
        nextWrong = [...wrongSet, q]
        setWrongSet(nextWrong)
      }
      if (settings.loopWrong) {
        // 末尾に再追加
        nextQueue = [...queue, q]
        setQueue(nextQueue)
      }
    }
    setRevealed(false)
    setVoiceAnswer('')
    if (idx + 1 >= nextQueue.length) {
      onFinish({ correct: nextCorrect, total, wrong: nextWrong })
      return
    }
    setIdx(idx + 1)
  }

  if (!q) {
    return (
      <div className="p-6 text-center">
        <p>問題がありません。せっていを見直してください。</p>
      </div>
    )
  }

  const progress = Math.round(((idx + 1) / queue.length) * 100)

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-xl flex-col gap-3 p-4">
      <div className="flex items-center justify-between text-sm text-stone-600">
        <span>
          {idx + 1} / {queue.length}問
        </span>
        <span>
          ⭐ {correct} / {total}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200">
        <div className="h-full bg-orange-500 transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="mt-2 rounded-2xl bg-white p-6 text-center shadow">
        <p className="text-sm text-stone-500">
          {settings.mode === 'read' ? '次の漢字の読みは？' : '次の読みを漢字で書こう'}
        </p>
        {q.hint && <p className="mt-2 text-xs text-stone-400">{q.hint.replace('__', '〇〇')}</p>}
        <div
          className={`mt-4 ${
            settings.mode === 'read' ? 'text-7xl' : 'text-5xl'
          } font-bold tracking-wide text-stone-900`}
          style={{ fontFamily: "'Hiragino Mincho ProN','Yu Mincho',serif" }}
        >
          {q.prompt}
        </div>
      </div>

      <div className="my-2 flex flex-col items-center gap-3">
        {isReadVoice ? (
          <VoiceInput onResult={(t) => setVoiceAnswer(t)} />
        ) : (
          <DrawingPad
            width={settings.mode === 'write' ? 360 : 320}
            height={settings.mode === 'write' ? 360 : 200}
            inkColor="#1c1917"
          />
        )}

        {isReadVoice && voiceAnswer && !revealed && (
          <AutoJudge voice={voiceAnswer} expected={q.answer} onJudge={(ok) => next(ok)} />
        )}
      </div>

      {revealed ? (
        <div className="rounded-xl bg-orange-50 p-4 text-center">
          <p className="text-xs text-stone-500">こたえ</p>
          <p className="text-3xl font-bold text-orange-700" style={{ fontFamily: "'Hiragino Mincho ProN','Yu Mincho',serif" }}>
            {q.answer}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => next(false)}
              className="rounded-full bg-red-100 px-4 py-3 font-bold text-red-700 active:scale-95"
            >
              ❌ まちがえた
            </button>
            <button
              onClick={() => next(true)}
              className="rounded-full bg-emerald-500 px-4 py-3 font-bold text-white active:scale-95"
            >
              ⭕ できた！
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setRevealed(true)}
            className="rounded-full bg-stone-200 px-4 py-3 font-bold text-stone-700 active:scale-95"
          >
            👀 こたえを見る
          </button>
          {!isReadVoice && (
            <button
              onClick={() => setRevealed(true)}
              className="rounded-full bg-orange-500 px-4 py-3 font-bold text-white active:scale-95"
            >
              ✅ かいた！
            </button>
          )}
          {isReadVoice && (
            <button
              onClick={() => setRevealed(true)}
              className="rounded-full bg-orange-500 px-4 py-3 font-bold text-white active:scale-95"
            >
              ✅ こたえ合わせ
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// 音声判定（自動）
function AutoJudge({ voice, expected, onJudge }: { voice: string; expected: string; onJudge: (ok: boolean) => void }) {
  const ok = normalizeKana(voice) === normalizeKana(expected)
  return (
    <div className={`mt-2 rounded-xl px-4 py-3 text-center ${ok ? 'bg-emerald-100' : 'bg-red-100'}`}>
      <p className="text-sm">
        {ok ? '✅ せいかい！' : '❌ ちがうかも'} / こたえ：<b>{expected}</b>
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button onClick={() => onJudge(false)} className="rounded-lg bg-white px-3 py-2 text-sm">
          ❌ まちがえた
        </button>
        <button onClick={() => onJudge(true)} className="rounded-lg bg-emerald-500 px-3 py-2 text-sm text-white">
          {ok ? '⭕ つぎへ' : '⭕ 正解だった'}
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// Result
// ============================================================================
function Result({
  correct,
  total,
  wrong,
  onHome,
  onRetry,
  onRetryWrong,
}: {
  correct: number
  total: number
  wrong: Question[]
  onHome: () => void
  onRetry: () => void
  onRetryWrong: () => void
}) {
  const rate = total > 0 ? Math.round((correct / total) * 100) : 0
  const cheer = rate === 100 ? '🏆 パーフェクト！' : rate >= 80 ? '🎉 すごい！' : rate >= 50 ? '💪 もうちょっと！' : '🌱 つづけよう'
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-xl flex-col gap-4 p-6 text-center">
      <h2 className="text-3xl font-bold">けっか</h2>
      <div className="rounded-3xl bg-white p-6 shadow">
        <p className="text-6xl">{rate === 100 ? '🏆' : rate >= 80 ? '🌟' : rate >= 50 ? '🎈' : '🌱'}</p>
        <p className="mt-2 text-4xl font-extrabold text-orange-600">
          {correct} / {total}
        </p>
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
          <button
            onClick={onRetryWrong}
            className="rounded-full bg-orange-500 px-6 py-3 font-bold text-white shadow active:scale-95"
          >
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
  const [stats, setStats] = useState<Stats>(() => loadStats())
  const [lastResult, setLastResult] = useState<{ correct: number; total: number; wrong: Question[] } | null>(null)
  const [override, setOverride] = useState<Question[] | null>(null) // 「間違いだけ再挑戦」用

  // 初期ロード
  useEffect(() => {
    setStats(loadStats())
  }, [])

  const finishQuiz = (r: { correct: number; total: number; wrong: Question[] }) => {
    setLastResult(r)
    // stats更新
    const today = todayStr()
    const next: Stats = { ...stats }
    next.totalAnswered += r.total
    next.totalCorrect += r.correct
    if (next.lastDay !== today) {
      // 連続日数
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const y = yesterday.toISOString().slice(0, 10)
      next.streakDays = stats.lastDay === y ? stats.streakDays + 1 : 1
      next.lastDay = today
    }
    // バッジ
    const badges = new Set(next.badges)
    if (next.totalCorrect >= 10) badges.add('🥉')
    if (next.totalCorrect >= 50) badges.add('🥈')
    if (next.totalCorrect >= 100) badges.add('🥇')
    if (next.streakDays >= 3) badges.add('🔥')
    if (next.streakDays >= 7) badges.add('⚡')
    if (r.total > 0 && r.correct === r.total) badges.add('🏆')
    next.badges = Array.from(badges)
    setStats(next)
    saveStats(next)
    setScreen('result')
  }

  return (
    <main
      className="min-h-[100dvh] w-full bg-gradient-to-b from-orange-50 to-amber-100 text-stone-900"
      style={{ WebkitTapHighlightColor: 'transparent', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {screen === 'home' && <Home stats={stats} onStart={() => setScreen('settings')} />}
      {screen === 'settings' && (
        <Settings
          initial={loadSettings()}
          onBack={() => setScreen('home')}
          onStart={(s) => {
            setSettings(s)
            setOverride(null)
            setScreen('quiz')
          }}
        />
      )}
      {screen === 'quiz' && settings && (
        <QuizRunner key={(override ? 'w' : 'n') + JSON.stringify(settings)} settings={settings} overrideQuestions={override} onFinish={finishQuiz} />
      )}
      {screen === 'result' && lastResult && settings && (
        <Result
          {...lastResult}
          onHome={() => setScreen('home')}
          onRetry={() => {
            setOverride(null)
            setScreen('quiz')
          }}
          onRetryWrong={() => {
            setOverride(lastResult.wrong)
            setScreen('quiz')
          }}
        />
      )}
    </main>
  )
}

// 間違い再挑戦のため、外部から問題リストを差し込めるラッパー
function QuizRunner({
  settings,
  overrideQuestions,
  onFinish,
}: {
  settings: SettingsState
  overrideQuestions: Question[] | null
  onFinish: (r: { correct: number; total: number; wrong: Question[] }) => void
}) {
  if (overrideQuestions && overrideQuestions.length > 0) {
    // override では既に Question[] になっているので Quiz の useMemo を回避するため、
    // 設定を上書きして count を絞り、collectItems の結果を使わずに直接渡せるようにする。
    // → 設定上は count=overrideQuestions.length にして、Quiz は range/mode を尊重するが、
    //    最初の picked を override に置き換える。簡略化のため OverrideQuiz を別実装。
    return <OverrideQuiz settings={settings} questions={overrideQuestions} onFinish={onFinish} />
  }
  return <Quiz settings={settings} onFinish={onFinish} />
}

function OverrideQuiz({
  settings,
  questions,
  onFinish,
}: {
  settings: SettingsState
  questions: Question[]
  onFinish: (r: { correct: number; total: number; wrong: Question[] }) => void
}) {
  // Quiz の中身を再利用するために、ここでは settings.count を渡しつつ、collectItems を上書きする
  // 実装簡略化：Quiz と同等のロジックを持つ別ランナー
  const initial = useMemo(() => shuffle(questions), [questions])
  const [queue, setQueue] = useState<Question[]>(initial)
  const [idx, setIdx] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [wrongSet, setWrongSet] = useState<Question[]>([])
  const [revealed, setRevealed] = useState(false)
  const [voiceAnswer, setVoiceAnswer] = useState('')
  const total = initial.length
  const q = queue[idx]
  const isReadVoice = settings.mode === 'read' && settings.readInput === 'voice'

  const next = (gotIt: boolean) => {
    let nextQueue = queue
    let nextWrong = wrongSet
    if (gotIt) setCorrect((c) => c + 1)
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
    setRevealed(false)
    setVoiceAnswer('')
    if (idx + 1 >= nextQueue.length) {
      onFinish({ correct: gotIt ? correct + 1 : correct, total, wrong: nextWrong })
      return
    }
    setIdx(idx + 1)
  }

  if (!q) return null
  const progress = Math.round(((idx + 1) / queue.length) * 100)

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-xl flex-col gap-3 p-4">
      <div className="flex items-center justify-between text-sm text-stone-600">
        <span>
          {idx + 1} / {queue.length}問（まちがい再挑戦）
        </span>
        <span>
          ⭐ {correct} / {total}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200">
        <div className="h-full bg-orange-500 transition-all" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-2 rounded-2xl bg-white p-6 text-center shadow">
        <p className="text-sm text-stone-500">
          {settings.mode === 'read' ? '次の漢字の読みは？' : '次の読みを漢字で書こう'}
        </p>
        {q.hint && <p className="mt-2 text-xs text-stone-400">{q.hint.replace('__', '〇〇')}</p>}
        <div
          className={`mt-4 ${settings.mode === 'read' ? 'text-7xl' : 'text-5xl'} font-bold tracking-wide`}
          style={{ fontFamily: "'Hiragino Mincho ProN','Yu Mincho',serif" }}
        >
          {q.prompt}
        </div>
      </div>
      <div className="my-2 flex flex-col items-center gap-3">
        {isReadVoice ? (
          <VoiceInput onResult={(t) => setVoiceAnswer(t)} />
        ) : (
          <DrawingPad width={settings.mode === 'write' ? 360 : 320} height={settings.mode === 'write' ? 360 : 200} />
        )}
        {isReadVoice && voiceAnswer && !revealed && (
          <AutoJudge voice={voiceAnswer} expected={q.answer} onJudge={(ok) => next(ok)} />
        )}
      </div>
      {revealed ? (
        <div className="rounded-xl bg-orange-50 p-4 text-center">
          <p className="text-xs text-stone-500">こたえ</p>
          <p className="text-3xl font-bold text-orange-700" style={{ fontFamily: "'Hiragino Mincho ProN','Yu Mincho',serif" }}>
            {q.answer}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={() => next(false)} className="rounded-full bg-red-100 px-4 py-3 font-bold text-red-700">
              ❌ まちがえた
            </button>
            <button onClick={() => next(true)} className="rounded-full bg-emerald-500 px-4 py-3 font-bold text-white">
              ⭕ できた！
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setRevealed(true)} className="rounded-full bg-orange-500 px-4 py-3 font-bold text-white">
          ✅ こたえ合わせ
        </button>
      )}
    </div>
  )
}
