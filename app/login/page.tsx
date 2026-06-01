'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { dashboardPath } from '@/lib/constants'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data: signIn, error: errSign } = await supabase.auth.signInWithPassword({
        email, password,
      })
      if (errSign) throw errSign

      // Busca o perfil para decidir a rota
      const { data: profile } = await supabase
        .from('profiles')
        .select('papel')
        .eq('id', signIn.user!.id)
        .maybeSingle()

      router.push(dashboardPath(profile?.papel ?? 'cliente'))
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-bendito-verde-escuro to-bendito-verde px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-bendito-dourado mb-2">
            🍕 Bendito Lanches
          </h1>
          <p className="text-bendito-creme text-lg">Sistema de Gestão</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-2xl font-bold text-bendito-verde-escuro mb-6 text-center">
            Entrar
          </h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bendito-dourado focus:border-transparent outline-none"
                placeholder="seu@email.com" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bendito-dourado focus:border-transparent outline-none"
                placeholder="••••••••" />
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-bendito-dourado hover:bg-bendito-dourado-escuro text-bendito-verde-escuro font-bold py-3 px-4 rounded-lg transition disabled:opacity-50">
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t text-center text-xs text-gray-500 space-y-1">
            <p>Admin: admin@benditolanches.com.br / Admin@2026</p>
            <p>Vendedor: carlos@bendito.com / Vendedor@2026</p>
            <p>Cliente: bomsabor@cliente.com / Cliente@2026</p>
          </div>
        </div>
      </div>
    </div>
  )
}
