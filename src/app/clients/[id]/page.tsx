import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AppShell } from '@/components/groupware/AppShell'
import { DeadlineTable } from '@/components/groupware/DeadlineTable'
import { RequestList } from '@/components/groupware/RequestList'
import { DeleteClientButton } from '@/components/groupware/DeleteClientButton'
import { getClient, listDeadlines, listRequests } from '@/lib/groupware/store'
import { formatDateJP, formatYen } from '@/lib/groupware/format'
import { getFiscalYearEndDate } from '@/lib/groupware/deadlines'

export const dynamic = 'force-dynamic'

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const client = await getClient(params.id)
  if (!client) notFound()

  const [deadlines, requests] = await Promise.all([
    listDeadlines(client.id),
    listRequests(client.id),
  ])

  const activeDeadlines = deadlines.filter((d) => d.status !== '提出済' && d.status !== '納付済')
  const closedDeadlines = deadlines.filter((d) => d.status === '提出済' || d.status === '納付済')

  const fye = client.corporation ? getFiscalYearEndDate(client.corporation) : undefined

  return (
    <AppShell>
      <div className="mb-6">
        <Link href="/clients" className="text-[13px] text-ink-mute hover:text-ink">← 顧問先一覧</Link>
        <div className="flex items-end justify-between mt-2">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[36px] font-semibold tracking-tight">{client.name}</h1>
              <span className="gw-chip-info">{client.entityType === 'corporation' ? '法人' : '個人'}</span>
              {client.corporation?.corporationType ? (
                <span className="gw-chip">{client.corporation.corporationType}</span>
              ) : null}
            </div>
            {client.nameKana ? (
              <p className="text-ink-mute mt-1">{client.nameKana}</p>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Link href={`/clients/${client.id}/edit`} className="gw-btn-secondary">
              編集
            </Link>
            <DeleteClientButton id={client.id} name={client.name} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        <div className="gw-card p-5">
          <div className="gw-label mb-3">基本情報</div>
          <InfoRow label="契約開始" value={formatDateJP(client.contractStartDate)} />
          <InfoRow label="月額顧問料" value={formatYen(client.monthlyFee)} />
          <InfoRow label="住所" value={[client.postalCode, client.address].filter(Boolean).join(' ')} />
          <InfoRow label="電話" value={client.phone} />
          <InfoRow label="メール" value={client.email} />
          <InfoRow label="Web" value={client.website} />
        </div>

        {client.entityType === 'corporation' ? (
          <div className="gw-card p-5">
            <div className="gw-label mb-3">法人情報</div>
            <InfoRow label="法人番号" value={client.corporation?.corporationNumber} />
            <InfoRow label="代表者" value={[client.corporation?.representativeTitle, client.corporation?.representativeName].filter(Boolean).join(' ')} />
            <InfoRow label="設立日" value={formatDateJP(client.corporation?.establishedDate)} />
            <InfoRow label="資本金" value={formatYen(client.corporation?.capital)} />
            <InfoRow
              label="決算月"
              value={
                client.corporation?.fiscalYearEndMonth
                  ? `${client.corporation.fiscalYearEndMonth}月${client.corporation.fiscalYearEndDay ? `${client.corporation.fiscalYearEndDay}日` : '末日'}`
                  : ''
              }
            />
            <InfoRow label="当期決算日 (推定)" value={formatDateJP(fye)} />
            <InfoRow label="業種" value={client.corporation?.industry} />
            <InfoRow label="青色申告" value={client.corporation?.blueReturn ? '承認あり' : '—'} />
          </div>
        ) : (
          <div className="gw-card p-5">
            <div className="gw-label mb-3">個人情報</div>
            <InfoRow label="青色申告" value={client.individual?.blueReturn ? '承認あり' : '—'} />
          </div>
        )}

        <div className="gw-card p-5">
          <div className="gw-label mb-3">税務・インボイス</div>
          <InfoRow
            label="消費税課税方式"
            value={client.corporation?.consumptionTaxMethod ?? client.individual?.consumptionTaxMethod}
          />
          {client.corporation?.consumptionTaxFrequency ? (
            <InfoRow label="消費税申告区分" value={client.corporation.consumptionTaxFrequency} />
          ) : null}
          <InfoRow
            label="インボイス登録番号"
            value={
              client.corporation?.invoiceRegistrationNumber ??
              client.individual?.invoiceRegistrationNumber
            }
          />
          <InfoRow label="e-Tax識別番号" value={client.corporation?.etaxId} />
          <InfoRow label="eLTAX利用者ID" value={client.corporation?.eltaxId} />
          <InfoRow label="所轄税務署" value={client.taxOffice?.nationalTaxOffice} />
          <InfoRow label="都道府県税" value={client.taxOffice?.prefecturalTaxOffice} />
          <InfoRow label="市区町村税" value={client.taxOffice?.municipalTaxOffice} />
        </div>
      </div>

      {client.taxCategories && client.taxCategories.length > 0 ? (
        <div className="mb-10">
          <div className="gw-label mb-3">管理対象税目</div>
          <div className="flex flex-wrap gap-2">
            {client.taxCategories.map((c) => (
              <span key={c} className="gw-chip">
                {c}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mb-10">
        <h2 className="text-[22px] font-semibold tracking-tight mb-4">進行中の申告・納付期限</h2>
        <DeadlineTable
          deadlines={activeDeadlines}
          clientIdForCreate={client.id}
        />
      </div>

      <div className="mb-10">
        <RequestList clientId={client.id} requests={requests} />
      </div>

      {closedDeadlines.length > 0 ? (
        <div className="mb-10">
          <h2 className="text-[22px] font-semibold tracking-tight mb-4">完了した期限</h2>
          <DeadlineTable deadlines={closedDeadlines} />
        </div>
      ) : null}

      {client.memo ? (
        <div className="gw-card p-5 mb-10">
          <div className="gw-label mb-2">メモ</div>
          <p className="whitespace-pre-wrap text-[14px] text-ink-soft">{client.memo}</p>
        </div>
      ) : null}
    </AppShell>
  )
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex gap-3 py-1.5 text-[14px]">
      <div className="w-32 text-ink-mute shrink-0">{label}</div>
      <div className="flex-1 text-ink">{value || '—'}</div>
    </div>
  )
}
