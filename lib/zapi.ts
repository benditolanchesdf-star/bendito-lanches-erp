/**
 * Serviço de envio de mensagens WhatsApp via Z-API
 * Usado pelo dashboard e pela lógica de mudança de status de pedidos
 */

import { createClient } from '@/lib/supabase/client'
import { FILIAL_ID } from '@/lib/constants'

export type ZAPIConfig = {
  instanceId: string
  token: string
  clientToken: string
  ativo: boolean
}

export type MensagensWpp = {
  confirmado: string
  producao: string
  saiu: string
  entregue: string
}

/** Carrega configurações Z-API e mensagens do banco */
export async function carregarConfigZAPI(): Promise<{ config: ZAPIConfig; mensagens: MensagensWpp }> {
  const supabase = createClient()
  const { data } = await supabase
    .from('configuracoes')
    .select('chave, valor')
    .eq('filial_id', FILIAL_ID)
    .in('chave', [
      'zapi_instance_id', 'zapi_token', 'zapi_client_token', 'zapi_ativo',
      'wpp_msg_confirmado', 'wpp_msg_producao', 'wpp_msg_saiu', 'wpp_msg_entregue',
    ])

  const map: Record<string, string> = {}
  for (const r of data || []) map[r.chave] = r.valor || ''

  return {
    config: {
      instanceId: map['zapi_instance_id'] || '',
      token: map['zapi_token'] || '',
      clientToken: map['zapi_client_token'] || '',
      ativo: map['zapi_ativo'] === 'true',
    },
    mensagens: {
      confirmado: map['wpp_msg_confirmado'] || '',
      producao:   map['wpp_msg_producao'] || '',
      saiu:       map['wpp_msg_saiu'] || '',
      entregue:   map['wpp_msg_entregue'] || '',
    },
  }
}

/** Interpola variáveis na mensagem */
export function interpolar(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}

/** Envia mensagem de texto via Z-API */
export async function enviarWhatsApp(
  config: ZAPIConfig,
  telefone: string,
  mensagem: string,
): Promise<{ ok: boolean; erro?: string }> {
  if (!config.ativo) return { ok: false, erro: 'WhatsApp desativado nas configurações.' }
  if (!config.instanceId || !config.token) return { ok: false, erro: 'Instância ou token Z-API não configurados.' }

  // Normaliza telefone para formato internacional sem +
  const fone = telefone.replace(/\D/g, '')
  const foneFormatado = fone.startsWith('55') ? fone : `55${fone}`

  try {
    const url = `https://api.z-api.io/instances/${config.instanceId}/token/${config.token}/send-text`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': config.clientToken,
      },
      body: JSON.stringify({ phone: foneFormatado, message: mensagem }),
    })

    if (!res.ok) {
      const body = await res.text()
      return { ok: false, erro: `Z-API ${res.status}: ${body}` }
    }

    return { ok: true }
  } catch (e: any) {
    return { ok: false, erro: e?.message || 'Erro desconhecido ao enviar WhatsApp.' }
  }
}

/** Envia notificação de mudança de status e registra no log */
export async function notificarStatusPedido(pedido: {
  id: string
  numero_pedido: string | number
  status: string
  data_entrega?: string | null
  horario_entrega?: string | null
  clientes?: { nome: string; nome_loja?: string | null; telefone?: string | null } | null
}): Promise<void> {
  const supabase = createClient()

  // Status que disparam notificação
  const statusNotificaveis = ['confirmado', 'producao', 'saiu_entrega', 'entregue']
  if (!statusNotificaveis.includes(pedido.status)) return

  const telefone = pedido.clientes?.telefone
  if (!telefone) return

  const { config, mensagens } = await carregarConfigZAPI()
  if (!config.ativo) return

  const templateMap: Record<string, string> = {
    confirmado:   mensagens.confirmado,
    producao:     mensagens.producao,
    saiu_entrega: mensagens.saiu,
    entregue:     mensagens.entregue,
  }

  const template = templateMap[pedido.status]
  if (!template) return

  const horario = pedido.horario_entrega ? ` às ${pedido.horario_entrega.slice(0, 5)}` : ''
  const dataEntrega = pedido.data_entrega
    ? new Date(pedido.data_entrega + 'T12:00:00').toLocaleDateString('pt-BR')
    : ''

  const mensagem = interpolar(template, {
    nome_loja:      pedido.clientes?.nome_loja || pedido.clientes?.nome || 'Cliente',
    numero_pedido:  String(pedido.numero_pedido),
    data_entrega:   dataEntrega,
    horario:        horario,
  })

  const result = await enviarWhatsApp(config, telefone, mensagem)

  // Registra no log
  await supabase.from('whatsapp_logs').insert({
    filial_id: FILIAL_ID,
    pedido_id: pedido.id,
    telefone,
    mensagem,
    status: result.ok ? 'enviado' : 'erro',
    erro: result.ok ? null : result.erro,
  })
}
