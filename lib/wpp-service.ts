/**
 * WhatsApp Service — Bendito Lanches ERP
 * Integração Z-API com suporte a fila, templates e notificações automáticas
 */

import { createClient } from '@/lib/supabase/client'

export type WppEvento =
  | 'pedido_confirmado'
  | 'pedido_producao'
  | 'pedido_saiu_entrega'
  | 'pedido_entregue'
  | 'pedido_cancelado'
  | 'cobranca_vencida'
  | 'cobranca_lembrete'
  | 'pedido_interno_aprovado'
  | 'pedido_interno_enviado'
  | 'pedido_compra_aprovado'
  | 'pedido_compra_recusado'

export type WppVariaveis = {
  nome?:          string
  numero_pedido?: string | number
  valor?:         string
  data?:          string
  status?:        string
  filial?:        string
  motivo?:        string
}

/** Substitui variáveis {{nome}} no template */
export function aplicarVariaveis(template: string, vars: WppVariaveis): string {
  let msg = template
  Object.entries(vars).forEach(([k, v]) => {
    msg = msg.replace(new RegExp(`{{${k}}}`, 'g'), String(v ?? ''))
  })
  return msg
}

/** Formata número para E.164 (5561999999999) */
export function formatarTelefone(tel: string): string {
  const digits = tel.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) return digits
  if (digits.length === 11) return `55${digits}`
  if (digits.length === 10) return `55${digits}`
  return `55${digits}`
}

/** Envia mensagem via Z-API */
export async function enviarMensagemZAPI(
  instanceId: string,
  token: string,
  clientToken: string,
  telefone: string,
  mensagem: string
): Promise<{ ok: boolean; erro?: string }> {
  try {
    const fone = formatarTelefone(telefone)
    const res = await fetch(
      `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': clientToken,
        },
        body: JSON.stringify({ phone: fone, message: mensagem }),
      }
    )
    if (!res.ok) {
      const err = await res.text()
      return { ok: false, erro: err }
    }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, erro: e.message }
  }
}

/** Carrega config Z-API da tabela configuracoes */
export async function carregarZAPI(filialId: string): Promise<{
  instance_id: string
  token: string
  client_token: string
  ativo: boolean
} | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('configuracoes')
    .select('chave, valor')
    .eq('filial_id', filialId)
    .in('chave', ['zapi_instance_id', 'zapi_token', 'zapi_client_token', 'zapi_ativo'])

  if (!data || data.length === 0) return null
  const map = Object.fromEntries(data.map(r => [r.chave, r.valor]))

  if (!map.zapi_instance_id || !map.zapi_token) return null
  return {
    instance_id:  map.zapi_instance_id,
    token:        map.zapi_token,
    client_token: map.zapi_client_token || '',
    ativo:        map.zapi_ativo === 'true',
  }
}

/**
 * Notifica via WhatsApp baseado em evento
 * Busca configuração do evento, aplica variáveis e envia
 */
export async function notificarEvento(params: {
  filialId:       string
  evento:         WppEvento
  telefoneCliente?: string
  vars:           WppVariaveis
  referenciaId?:  string
  referenciaTipo?: string
  agendadoPara?:  Date  // para mensagens agendadas
}): Promise<void> {
  const supabase = createClient()

  try {
    // 1. Buscar configuração do evento
    const { data: config } = await supabase
      .from('wpp_configuracoes')
      .select('*')
      .eq('filial_id', params.filialId)
      .eq('evento', params.evento)
      .eq('ativo', true)
      .maybeSingle()

    if (!config) return

    // 2. Carregar Z-API
    const zapi = await carregarZAPI(params.filialId)
    if (!zapi || !zapi.ativo) return

    const mensagem = aplicarVariaveis(config.mensagem, params.vars)
    const agendadoPara = params.agendadoPara?.toISOString() || null

    // 3. Enfileirar para cliente externo
    if (config.enviar_cliente && params.telefoneCliente) {
      const tel = formatarTelefone(params.telefoneCliente)
      if (tel.length >= 12) {
        if (!agendadoPara) {
          // Envio imediato
          const result = await enviarMensagemZAPI(
            zapi.instance_id, zapi.token, zapi.client_token,
            tel, mensagem
          )
          // Salvar no log/fila
          await supabase.from('wpp_fila').insert({
            filial_id:      params.filialId,
            telefone:       tel,
            mensagem,
            evento:         params.evento,
            referencia_id:  params.referenciaId || null,
            referencia_tipo: params.referenciaTipo || null,
            status:         result.ok ? 'enviado' : 'erro',
            tentativas:     1,
            erro_msg:       result.erro || null,
            enviado_em:     result.ok ? new Date().toISOString() : null,
          })
        } else {
          // Agendar
          await supabase.from('wpp_fila').insert({
            filial_id:      params.filialId,
            telefone:       tel,
            mensagem,
            evento:         params.evento,
            referencia_id:  params.referenciaId || null,
            referencia_tipo: params.referenciaTipo || null,
            status:         'pendente',
            agendado_para:  agendadoPara,
          })
        }
      }
    }

    // 4. Enviar para interno (se configurado)
    if (config.enviar_interno && config.telefone_interno) {
      const telInt = formatarTelefone(config.telefone_interno)
      if (telInt.length >= 12) {
        const msgInterna = `[${params.evento.toUpperCase()}] ${mensagem}`
        if (!agendadoPara) {
          const result = await enviarMensagemZAPI(
            zapi.instance_id, zapi.token, zapi.client_token,
            telInt, msgInterna
          )
          await supabase.from('wpp_fila').insert({
            filial_id:      params.filialId,
            telefone:       telInt,
            mensagem:       msgInterna,
            evento:         params.evento,
            referencia_id:  params.referenciaId || null,
            referencia_tipo: params.referenciaTipo || null,
            status:         result.ok ? 'enviado' : 'erro',
            tentativas:     1,
            erro_msg:       result.erro || null,
            enviado_em:     result.ok ? new Date().toISOString() : null,
          })
        } else {
          await supabase.from('wpp_fila').insert({
            filial_id:      params.filialId,
            telefone:       telInt,
            mensagem:       msgInterna,
            evento:         params.evento,
            status:         'pendente',
            agendado_para:  agendadoPara,
          })
        }
      }
    }
  } catch (err) {
    console.error('[WPP] Erro ao notificar evento:', err)
  }
}

/** Envia mensagens agendadas pendentes (chamar periodicamente) */
export async function processarFilaPendente(filialId: string): Promise<number> {
  const supabase = createClient()
  const zapi = await carregarZAPI(filialId)
  if (!zapi || !zapi.ativo) return 0

  const agora = new Date().toISOString()
  const { data: pendentes } = await supabase
    .from('wpp_fila')
    .select('*')
    .eq('filial_id', filialId)
    .eq('status', 'pendente')
    .lte('agendado_para', agora)
    .lt('tentativas', 3)
    .limit(10)

  let enviados = 0
  for (const msg of pendentes || []) {
    const result = await enviarMensagemZAPI(
      zapi.instance_id, zapi.token, zapi.client_token,
      msg.telefone, msg.mensagem
    )
    await supabase.from('wpp_fila').update({
      status:     result.ok ? 'enviado' : (msg.tentativas >= 2 ? 'erro' : 'pendente'),
      tentativas: msg.tentativas + 1,
      erro_msg:   result.erro || null,
      enviado_em: result.ok ? new Date().toISOString() : null,
    }).eq('id', msg.id)
    if (result.ok) enviados++
  }
  return enviados
}
