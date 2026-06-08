'use client'

import { useEffect, useState } from 'react'
import SidebarMenu from './SidebarMenu'
import { createClient } from '@/lib/supabase/client'

/**
 * Hook local: count de pedidos pendentes em tempo real via Supabase Realtime.
 * Mantido neste arquivo para evitar dependência de '@/lib/hooks/...'.
 *
 * Pré-requisito: tabela 'pedidos' na publication supabase_realtime
 * (já adicionada pela migration bendito_apontamento_5_whatsapp_notificacao).
 */
function usePedidosPendentes() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    let mounted = true

    async function fetchCount() {
      const { count } = await supabase
        .from('pedidos')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pendente')
      if (mounted) setCount(count || 0)
    }
    fetchCount()

    const channel = supabase
      .channel('sidebar-pedidos-pendentes-wrapper')
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

  return count
}

/**
 * Wrapper opcional. O SidebarMenu já monta o menu internamente por `tipo`
 * e já tem a lógica de badge piscante. Este componente só serve se algum
 * layout antigo ainda importa <Sidebar />.
 */
export default function Sidebar() {
  // O hook fica disponível aqui caso queira customizar o subtítulo
  // ou usar o count em algum indicador adicional do wrapper.
  const pendentes = usePedidosPendentes()
  const sub = pendentes > 0 ? `Admin · ${pendentes} pedido(s) pendente(s)` : 'Admin / Matriz'

  return <SidebarMenu tipo="admin" titulo="Bendito Lanches" subtitulo={sub} />
}
