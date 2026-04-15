/**
 * AI 叩き台コメント生成 API
 *
 * 指定されたセクションについて、Gemini で叩き台コメントを生成する。
 * ユーザーは UI 上で編集して確定する。
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { generateAiComment } from '@/lib/ai/gemini-client'
import { getLatestBenchmark } from '@/lib/benchmark/repository'
import { getClient, getProfile } from '@/lib/firestore/clients-repo'
import { listSections } from '@/lib/firestore/reports-repo'

export const runtime = 'nodejs'
export const maxDuration = 60

const Schema = z.object({
  clientId: z.string(),
  reportId: z.string(),
  sectionType: z.string(),
  previousComments: z.array(
    z.object({
      content: z.string(),
      tags: z.array(z.string()),
    }),
  ).default([]),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const client = await getClient(parsed.data.clientId)
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const [sections, profile] = await Promise.all([
    listSections(parsed.data.clientId, parsed.data.reportId),
    getProfile(parsed.data.clientId),
  ])
  const section = sections.find((s) => s.type === parsed.data.sectionType)
  if (!section) return NextResponse.json({ error: 'Section not found' }, { status: 404 })

  const benchmarkData = await getLatestBenchmark(client.industryCode, client.capitalScale).catch(
    () => null,
  )

  const text = await generateAiComment({
    sectionType: parsed.data.sectionType,
    sectionTitle: section.title,
    sectionContent: section.content,
    clientName: client.name,
    industryCode: client.industryCode,
    profile: profile
      ? {
          reportStyle: profile.reportStyle,
          commentTone: profile.commentTone,
          focusedKpis: profile.focusedKpis ?? [],
          vocabularyPreference: profile.vocabularyPreference ?? {},
        }
      : null,
    previousComments: parsed.data.previousComments,
    benchmark: benchmarkData?.value != null ? { [benchmarkData.indicator]: benchmarkData.value } : undefined,
  })

  return NextResponse.json({ content: text })
}
