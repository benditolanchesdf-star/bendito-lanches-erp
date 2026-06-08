'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Retorna a quantidade de pedidos com status='pendente' em tempo real.
 *
 * Usa Supabase Realtime: atualiza automaticamente ao detectar INSERT/UPDATE/DELETE
 * na tabela public.pedidos — sem necessidade de polling.
 *
 * Pré-requisito: a tabela 'pedidos' deve estar na publication supabase_realtime
 * (já adicionada pela migration bendito_apontamento_5_whatsapp_notificacao).
 */
export function usePedidosPendentes() {
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    let mounted = true

    async function fetchCount() {
      const { count, error } = await supabase
        .from('pedidos')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pendente')
      if (mounted && !error) {
        setCount(count || 0)
        setLoading(false)
      }
    }

    fetchCount()

    const channel = supabase
      .channel('pedidos-pendentes-hook')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos' },
        () => fetchCount()
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [])

  return { count, loading }
}
