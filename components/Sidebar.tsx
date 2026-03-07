'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Building2, Users, CheckSquare, DollarSign, GraduationCap } from 'lucide-react'

const nav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/accounts', label: 'Accounts', icon: Building2 },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
]

const accountSubNav = [
  { href: '/accounts/funders', label: 'Funders', icon: DollarSign },
  { href: '/accounts/schools', label: 'Schools/Districts', icon: GraduationCap },
]

export default function Sidebar() {
  const pathname = usePathname()
  const isAccountsSection = pathname.startsWith('/accounts')

  return (
    <aside className="w-56 bg-slate-900 flex flex-col shrink-0">
      <div className="px-5 py-5 border-b border-slate-700">
        <h1 className="text-white font-bold text-lg tracking-tight">Partner OS</h1>
        <p className="text-slate-400 text-xs mt-0.5">Relationship Management</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === '/accounts' ? pathname === href : pathname === href
          return (
            <div key={href}>
              <Link
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
              {href === '/accounts' && isAccountsSection && (
                <div className="ml-5 mt-0.5 space-y-0.5">
                  {accountSubNav.map(({ href: subHref, label: subLabel, icon: SubIcon }) => {
                    const subActive = pathname === subHref
                    return (
                      <Link
                        key={subHref}
                        href={subHref}
                        className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          subActive
                            ? 'bg-indigo-500/20 text-indigo-300'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                        }`}
                      >
                        <SubIcon size={13} />
                        {subLabel}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
