/**
 * /hooks/index.ts
 * Hooks customizados — Bendito Lanches ERP
 * Importar de '@/hooks' em qualquer parte do projeto
 */

'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'

// ── useProfile ────────────────────────────────────────
/**
 * Retorna o perfil do usuário logado e funções de controle
 * Uso: const { profile, isAdmin, loading } = useProfile()
 */
export function useProfile() {
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading]  = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await supabase
        .from('profiles').select('*').eq('id', user.id).maybeSingle()
      setProfile(data)
      setLoading(false)
    }
    load()
  }, [])

  return {
    profile,
    loading,
    isAdmin:   ['admin','matriz'].includes(profile?.papel || ''),
    isVendedor: profile?.papel === 'vendedor',
    isCliente:  profile?.papel === 'cliente',
    filialId:   profile?.filial_id,
  }
}

// ── useFiliais ────────────────────────────────────────
/**
 * Retorna lista de filiais ativas
 * Uso: const { filiais, loading } = useFiliais()
 */
export function useFiliais() {
  const supabase = createClient()
  const [filiais, setFiliais]  = useState<any[]>([])
  const [loading, setLoading]  = useState(true)

  useEffect(() => {
    supabase.from('filiais').select('id, nome').eq('ativo', true).order('nome')
      .then(({ data }) => { setFiliais(data || []); setLoading(false) })
  }, [])

  return { filiais, loading }
}

// ── useProdutos ───────────────────────────────────────
/**
 * Retorna produtos por filial com cache simples
 * Uso: const { produtos, loading, refetch } = useProdutos(filialId)
 */
export function useProdutos(filialId: string) {
  const supabase = createClient()
  const [produtos, setProdutos] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)

  const fetch = useCallback(async () => {
    if (!filialId) return
    setLoading(true)
    const { data } = await supabase
      .from('vw_produtos_filial')
      .select('*')
      .eq('filial_id', filialId)
      .eq('ativo_na_filial', true)
      .order('nome')
    setProdutos(data || [])
    setLoading(false)
  }, [filialId])

  useEffect(() => { fetch() }, [fetch])

  return { produtos, loading, refetch: fetch }
}

// ── useAprovacoesPendentes ────────────────────────────
/**
 * Conta aprovações pendentes com polling a cada 2min
 * Uso: const count = useAprovacoesPendentes()
 */
export function useAprovacoesPendentes() {
  const supabase = createClient()
  const [count, setCount] = useState(0)

  const fetch = useCallback(async () => {
    const { count: c } = await supabase
      .from('vw_aprovacoes_pendentes')
      .select('*', { count: 'exact', head: true })
    setCount(c || 0)
  }, [])

  useEffect(() => {
    fetch()
    const interval = setInterval(fetch, 120000)
    return () => clearInterval(interval)
  }, [fetch])

  return count
}

// ── useDebounce ───────────────────────────────────────
/**
 * Debounce de valor para buscas
 * Uso: const termoBusca = useDebounce(input, 300)
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debouncedValue
}

// ── useLocalStorage ───────────────────────────────────
/**
 * Estado persistido em localStorage
 * Uso: const [filtro, setFiltro] = useLocalStorage('filtro-pedidos', 'todos')
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch { return initialValue }
  })

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore))
      }
    } catch (error) { console.error(error) }
  }

  return [storedValue, setValue] as const
}

// ── useConfirm ────────────────────────────────────────
/**
 * Diálogo de confirmação programático
 * Uso: const { confirm, ConfirmDialog } = useConfirm()
 *      await confirm('Deseja excluir?') && excluirItem()
 */
export function useConfirm() {
  const [state, setState] = useState<{
    open: boolean; msg: string; resolve?: (v: boolean) => void
  }>({ open: false, msg: '' })

  const confirm = (msg: string) => new Promise<boolean>(resolve => {
    setState({ open: true, msg, resolve })
  })

  const handleResp = (resp: boolean) => {
    state.resolve?.(resp)
    setState({ open: false, msg: '' })
  }

  return { confirm, isOpen: state.open, msg: state.msg, handleResp }
}

// ── useFormatters ─────────────────────────────────────
/**
 * Funções de formatação reutilizáveis
 * Uso: const { brl, data, telefone } = useFormatters()
 */
export function useFormatters() {
  const brl = (valor: number | string | null | undefined) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
      .format(Number(valor || 0))

  const data = (iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions) =>
    iso ? new Date(iso).toLocaleDateString('pt-BR', opts) : '—'

  const dataHora = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleString('pt-BR') : '—'

  const hora = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'

  const telefone = (tel: string | null | undefined) => {
    if (!tel) return '—'
    const d = tel.replace(/\D/g, '')
    if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
    if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
    return tel
  }

  const percentual = (valor: number) =>
    `${valor >= 0 ? '+' : ''}${Number(valor).toFixed(1)}%`

  return { brl, data, dataHora, hora, telefone, percentual }
}

// ── useAutoRefresh ────────────────────────────────────
/**
 * Executa uma função periodicamente
 * Uso: useAutoRefresh(carregarDados, 60000) // a cada 1 min
 */
export function useAutoRefresh(fn: () => void, intervalMs = 120000) {
  useEffect(() => {
    const interval = setInterval(fn, intervalMs)
    return () => clearInterval(interval)
  }, [fn, intervalMs])
}

// ── usePrevious ───────────────────────────────────────
/**
 * Retorna o valor anterior de uma variável
 * Útil para comparar mudanças de estado
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>()
  useEffect(() => { ref.current = value }, [value])
  return ref.current
}
