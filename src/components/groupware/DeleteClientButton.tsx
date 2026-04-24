'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

export function DeleteClientButton({ id, name }: { id: string; name: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleClick() {
    if (!confirm(`${name} を削除します。関連する期限・依頼資料もすべて削除されます。よろしいですか？`)) {
      return
    }
    startTransition(async () => {
      const res = await fetch(`/api/groupware/clients/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        alert('削除に失敗しました')
        return
      }
      router.push('/clients')
      router.refresh()
    })
  }

  return (
    <button onClick={handleClick} className="gw-btn-danger" disabled={pending}>
      {pending ? '削除中…' : '削除'}
    </button>
  )
}
