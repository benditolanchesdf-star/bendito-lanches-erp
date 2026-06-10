/**
 * Helper drop-in: chama a RPC gerar_op_de_pedido no Supabase
 * Cole isso em lib/api/ordens.ts (ou onde preferir centralizar APIs).
 *
 * Uso típico em um componente:
 *
 *   import { gerarOPDePedido } from '@/lib/api/ordens'
 *
 *   async function handleGerarOP(pedidoId: string, numeroPedido: number) {
 *     const r = await gerarOPDePedido(pedidoId)
 *     if (!r.ok) { alert(r.erro); return }
 *     if (r.jaExistia) {
 *       alert(`O pedido #${numeroPedido} já tem a OP #${r.numeroOrdem}.`)
 *     } else {
 *       const extra = r.itensPulados > 0
 *         ? ` (${r.itensPulados} item(ns) de revenda foram ignorados)`
 *         : ''
 *       alert(`OP #${r.numeroOrdem} criada com ${r.itensCriados} itens${extra}.`)
 *     }
 *   }
 */

import { createClient } from '@/lib/supabase/client'

export interface GerarOPResultado {
  ok: boolean
  erro?: string
  ordemId?: string
  jaExistia?: boolean
  itensCriados?: number
  itensPulados?: number
  numeroOrdem?: number
}

interface RpcRow {
  out_ordem_id: string
  out_ja_existia: boolean
  out_itens_criados: number
  out_itens_pulados: number
  out_numero_ordem: number
}

export async function gerarOPDePedido(pedidoId: string): Promise<GerarOPResultado> {
  const supabase = createClient()
  const { data, error } = await supabase
    .rpc('gerar_op_de_pedido', { p_pedido_id: pedidoId })
    .single<RpcRow>()

  if (error) return { ok: false, erro: error.message }
  if (!data)  return { ok: false, erro: 'RPC não retornou dados.' }

  return {
    ok: true,
    ordemId:       data.out_ordem_id,
    jaExistia:     data.out_ja_existia,
    itensCriados:  data.out_itens_criados,
    itensPulados:  data.out_itens_pulados,
    numeroOrdem:   data.out_numero_ordem,
  }
}

/**
 * Verifica se um pedido já tem OP vinculada (não cancelada).
 * Útil pra decidir se mostra o botão "Gerar OP" ou "Ver OP #X".
 */
export async function buscarOPDoPedido(pedidoId: string): Promise<{ id: string; numero_ordem: number } | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('ordens_producao')
    .select('id, numero_ordem')
    .eq('pedido_id', pedidoId)
    .neq('status', 'cancelada')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return data as { id: string; numero_ordem: number }
}
