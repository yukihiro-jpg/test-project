'use client'

import { useEffect } from 'react'

/**
 * iOS Safari等でプルツーリフレッシュを完全に防ぐ。
 * このコンポーネントが mount されている間、html要素に no-pull-refresh クラスを付与する。
 */
export default function NoPullRefresh() {
  useEffect(() => {
    document.documentElement.classList.add('no-pull-refresh')
    return () => {
      document.documentElement.classList.remove('no-pull-refresh')
    }
  }, [])

  return null
}
