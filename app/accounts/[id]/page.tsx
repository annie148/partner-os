'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { Account } from '@/types'
import { SCHOOL_TYPES } from '@/types'

/**
 * Generic account detail page — redirects to the type-specific detail page.
 * Schools → /accounts/schools/[id]
 * Funders → /accounts/funders/[id]
 */
export default function AccountRedirectPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch('/api/accounts')
      .then((r) => r.json())
      .then((accounts) => {
        const acc = (Array.isArray(accounts) ? accounts : []).find((a: Account) => a.id === id)
        if (!acc) {
          setNotFound(true)
          return
        }
        if (SCHOOL_TYPES.includes(acc.type)) {
          router.replace(`/accounts/schools/${id}`)
        } else {
          router.replace(`/accounts/funders/${id}`)
        }
      })
  }, [id, router])

  if (notFound) {
    return (
      <div className="p-8">
        <p className="text-sm text-gray-500">Account not found.</p>
        <a href="/accounts" className="text-sm text-indigo-600 hover:underline mt-2 inline-block">← Back to Accounts</a>
      </div>
    )
  }

  return <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
}
