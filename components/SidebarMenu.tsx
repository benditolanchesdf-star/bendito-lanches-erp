'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut, Menu, X, LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export interface MenuItem {
  icon: LucideIcon
  label: string
  href: string
}

interface SidebarMenuProps {
  titulo: string
  subtitulo: string
  itens: MenuItem[]
}

export default function SidebarMenu({ titulo, subtitulo, itens }: SidebarMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      <button onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-bendito-dourado rounded-lg shadow-lg">
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {isOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setIsOpen(false)} />
      )}

      <aside className={`
        fixed lg:sticky top-0 left-0 h-screen w-72 bg-bendito-verde-escuro text-white
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 z-40
        flex flex-col`}>
        <div className="p-6 border-b border-bendito-verde">
          <h1 className="text-2xl font-bold text-bendito-dourado">🍕 {titulo}</h1>
          <p className="text-xs text-bendito-creme mt-1">{subtitulo}</p>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {itens.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || (item.href !== '/dashboard' && item.href !== '/vendedor' && item.href !== '/cliente' && pathname.startsWith(item.href))
              return (
                <li key={item.href}>
                  <Link href={item.href} onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all
                      ${isActive ? 'bg-bendito-dourado text-bendito-verde-escuro font-semibold'
                                  : 'hover:bg-bendito-verde text-bendito-creme'}`}>
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-bendito-verde">
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-red-600 text-bendito-creme transition-all">
            <LogOut size={20} />
            <span>Sair</span>
          </button>
        </div>
      </aside>
    </>
  )
}
