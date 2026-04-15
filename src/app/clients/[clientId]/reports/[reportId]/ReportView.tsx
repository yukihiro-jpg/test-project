'use client'

/**
 * レポート詳細のインタラクティブ部分
 *
 * セクション一覧を表示し、各セクションに対して：
 * - コメント一覧表示・追加
 * - AI叩き台生成
 */

import { useState } from 'react'
import type { Comment, CommentTag, ReportSection, SectionType } from '@/lib/types'

export default function ReportView({
  clientId,
  reportId,
  sections,
  initialComments,
}: {
  clientId: string
  reportId: string
  sections: ReportSection[]
  initialComments: Comment[]
}) {
  const [comments, setComments] = useState(initialComments)
  const [activeSection, setActiveSection] = useState<SectionType | null>(null)

  const commentsFor = (type: SectionType) => comments.filter((c) => c.sectionType === type)

  const addComment = async (
    sectionType: SectionType,
    pageNumber: number,
    content: string,
    tags: CommentTag[],
    aiGenerated = false,
    aiOriginalContent?: string,
  ) => {
    const res = await fetch(`/api/reports/${clientId}/${reportId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sectionType,
        pageNumber,
        content,
        tags,
        aiGenerated,
        aiOriginalContent,
      }),
    })
    if (res.ok) {
      const { comment } = await res.json()
      setComments((c) => [...c, comment])
    }
  }

  const generateAi = async (section: ReportSection) => {
    setActiveSection(section.type)
    try {
      const res = await fetch('/api/ai/suggest-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          reportId,
          sectionType: section.type,
          previousComments: commentsFor(section.type).map((c) => ({
            content: c.content,
            tags: c.tags,
          })),
        }),
      })
      if (!res.ok) throw new Error('AI 生成に失敗しました')
      const { content } = await res.json()
      await addComment(section.type, section.pageNumber, content, [], true, content)
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setActiveSection(null)
    }
  }

  return (
    <div className="space-y-6">
      {sections.map((s) => (
        <section key={s.type} className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">
              {s.pageNumber}. {s.title}
            </h2>
            <button
              onClick={() => generateAi(s)}
              disabled={activeSection === s.type}
              className="text-sm bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white px-3 py-1 rounded"
            >
              {activeSection === s.type ? 'AI 生成中...' : '✨ AI 叩き台を生成'}
            </button>
          </div>

          <details className="mb-3">
            <summary className="cursor-pointer text-sm text-gray-600">
              セクションデータを表示
            </summary>
            <pre className="mt-2 p-3 bg-gray-50 rounded text-xs overflow-auto max-h-60">
              {JSON.stringify(s.content, null, 2)}
            </pre>
          </details>

          <CommentList comments={commentsFor(s.type)} />
          <CommentForm section={s} onSubmit={addComment} />
        </section>
      ))}
    </div>
  )
}

function CommentList({ comments }: { comments: Comment[] }) {
  if (comments.length === 0) return null
  return (
    <div className="space-y-2 mb-3">
      {comments.map((c) => (
        <div
          key={c.id}
          className={`p-3 rounded border ${
            c.aiGenerated ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-200'
          }`}
        >
          {c.tags.length > 0 && (
            <div className="flex gap-1 mb-1">
              {c.tags.map((t) => (
                <span
                  key={t}
                  className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800"
                >
                  {tagLabel(t)}
                </span>
              ))}
            </div>
          )}
          <p className="text-sm whitespace-pre-wrap">{c.content}</p>
          {c.aiGenerated && (
            <p className="text-xs text-purple-600 mt-1">✨ AI 生成</p>
          )}
        </div>
      ))}
    </div>
  )
}

function CommentForm({
  section,
  onSubmit,
}: {
  section: ReportSection
  onSubmit: (
    sectionType: SectionType,
    pageNumber: number,
    content: string,
    tags: CommentTag[],
  ) => Promise<void>
}) {
  const [content, setContent] = useState('')
  const [tags, setTags] = useState<CommentTag[]>([])

  const toggleTag = (t: CommentTag) => {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }

  const submit = async () => {
    if (!content.trim()) return
    await onSubmit(section.type, section.pageNumber, content, tags)
    setContent('')
    setTags([])
  }

  return (
    <div className="border-t pt-3">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="コメントを入力..."
        className="w-full px-3 py-2 border border-gray-300 rounded text-sm min-h-[60px]"
      />
      <div className="flex items-center justify-between mt-2">
        <div className="flex gap-2 text-xs">
          {(['important', 'next_month', 'continuing'] as CommentTag[]).map((t) => (
            <label key={t} className="flex items-center gap-1">
              <input type="checkbox" checked={tags.includes(t)} onChange={() => toggleTag(t)} />
              {tagLabel(t)}
            </label>
          ))}
        </div>
        <button
          onClick={submit}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
        >
          追加
        </button>
      </div>
    </div>
  )
}

function tagLabel(tag: CommentTag): string {
  return {
    important: '重要',
    next_month: '来月への宿題',
    continuing: '継続論点',
    completed: '解決済み',
  }[tag]
}
