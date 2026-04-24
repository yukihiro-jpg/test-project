import type { DeadlineStatus, RequestItemStatus } from '@/lib/groupware/types'

const DEADLINE_STYLES: Record<DeadlineStatus, string> = {
  未着手: 'bg-[#f5f5f7] text-[#515154]',
  資料回収中: 'bg-[#e6f0ff] text-[#0071e3]',
  作成中: 'bg-[#fff3e0] text-[#ff9500]',
  申告書完成: 'bg-[#e7f6ff] text-[#007aff]',
  提出済: 'bg-[#e3fbe7] text-[#1c8433]',
  納付済: 'bg-[#d1fae5] text-[#065f46]',
}

const REQUEST_STYLES: Record<RequestItemStatus, string> = {
  未依頼: 'bg-[#f5f5f7] text-[#515154]',
  依頼済: 'bg-[#e6f0ff] text-[#0071e3]',
  一部受領: 'bg-[#fff3e0] text-[#ff9500]',
  受領済: 'bg-[#e3fbe7] text-[#1c8433]',
  不要: 'bg-[#f5f5f7] text-[#86868b] line-through',
}

export function DeadlineStatusBadge({ status }: { status: DeadlineStatus }) {
  return (
    <span
      className={
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ' +
        DEADLINE_STYLES[status]
      }
    >
      {status}
    </span>
  )
}

export function RequestStatusBadge({ status }: { status: RequestItemStatus }) {
  return (
    <span
      className={
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ' +
        REQUEST_STYLES[status]
      }
    >
      {status}
    </span>
  )
}
