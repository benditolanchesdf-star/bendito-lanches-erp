'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader, Loading, Field, Input, PrimaryButton, SecondaryButton } from '@/components/ui'
import { MessageCircle, CheckCircle, XCircle, Send, RefreshCw, Eye, EyeOff, Building2 } from 'lucide-react'

const EVENTOS: { key: string; label: string; desc: string; paraCliente: boolean }[] = [
  { key: 'pedido_confirmado',       label: '✅ Pedido Confirmado',         desc: 'Ao confirmar pedido do cliente',           paraCliente: true  },
  { key: 'pedido_producao',         label: '👨‍🍳 Pedido em Produção',       desc: 'Ao iniciar produção do pedido',            paraCliente: true  },
  { key: 'pedido_saiu_entrega',     label: '🚗 Saiu para Entrega',         desc: 'Ao despachar para entrega',                paraCliente: true  },
  { key: 'pedido_entregue',         label: '📦 Pedido Entregue',           desc: 'Ao confirmar entrega',                     paraCliente: true  },
  { key: 'pedido_cancelado',        label: '❌ Pedido Cancelado',           desc: 'Ao cancelar pedido',                       paraCliente: true  },
  { key: 'cobranca_vencida',        label: '⚠️ Cobrança Vencida',          desc: 'Quando conta a receber vence',             paraCliente: true  },
  { key: 'cobranca_lembrete',       label: '🔔 Lembrete de Cobrança',      desc: '1 dia antes do vencimento',                paraCliente: true  },
  { key: 'pedido_interno_aprovado', label: '✅ Pedido Interno Aprovado',   desc: 'Quando Matriz aprova pedido interno',      paraCliente: false },
  { key: 'pedido_interno_enviado',  label: '🚚 Pedido Interno Enviado',    desc: 'Quando Matriz envia itens',                paraCliente: false },
  { key: 'pedido_compra_aprovado',  label: '✅ Compra Aprovada',           desc: 'Quando pedido de compra é aprovado',       paraCliente: false },
  { key: 'pedido_compra_recusado',  label: '❌ Compra Recusada',           desc: 'Quando pedido de compra é recusado',       paraCliente: false },
]

const VARIAVEIS = ['{{nome}}', '{{numero_pedido}}', '{{valor}}', '{{data}}', '{{status}}', '{{filial}}', '{{motivo}}']

export default function WppConfiguracoesPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [filiais, setFiliais] = useState<any[]>([])
  const [filialSel, setFilialSel] = useState('')
  const [configs, setConfigs] = useState<Record<string, any>>({})
  const [zapiConfig, setZapiConfig] = useState({
    zapi_instance_id: '', zapi_token: '', zapi_client_token: '', zapi_ativo: 'false',
  })
  const [showToken, setShowToken] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [salvandoZapi, setSalvandoZapi] = useState(false)
  const [testeFone, setTesteFone] = useState('')
  const [testando, setTestando] = useState(false)
  const [testeResult, setTesteResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [eventoEditando, setEventoEditando] = useState<string | null>(null)

  async function load(fid?: string) {
    setLoading(true)
    const { data: fils } = await supabase.from('filiais').select('id, nome').eq('ativo', true)
    setFiliais(fils || [])

    const filialId = fid || filialSel || (fils?.[0]?.id || '')
    if (!filialSel && fils?.[0]?.id) setFilialSel(fils[0].id)
    if (!filialId) { setLoading(false); return }

    const [{ data: cfgs }, { data: zapCfgs }] = await Promise.all([
      supabase.from('wpp_configuracoes').select('*').eq('filial_id', filialId),
      supabase.from('configuracoes').select('chave, valor').eq('filial_id', filialId)
        .in('chave', ['zapi_instance_id', 'zapi_token', 'zapi_client_token', 'zapi_ativo']),
    ])

    const cfgMap: Record<string, any> = {}
    for (const c of cfgs || []) cfgMap[c.evento] = c
    setConfigs(cfgMap)

    const zapMap: Record<string, string> = {}
    for (const z of zapCfgs || []) zapMap[z.chave] = z.valor || ''
    setZapiConfig(prev => ({ ...prev, ...zapMap }))
    setLoading(false)
  }

  useEffect(() => { load() }, [])
  useEffect(() => { if (filialSel) load(filialSel) }, [filialSel])

  async function toggleEvento(evento: string, campo: 'ativo' | 'enviar_cliente' | 'enviar_interno') {
    const cfg = configs[evento]
    if (!cfg) return
    const novoValor = !cfg[campo]
    await supabase.from('wpp_configuracoes').update({
      [campo]: novoValor, updated_at: new Date().toISOString()
    }).eq('id', cfg.id)
    setConfigs(prev => ({ ...prev, [evento]: { ...prev[evento], [campo]: novoValor } }))
  }

  async function salvarMensagem(evento: string) {
    const cfg = configs[evento]
    if (!cfg) return
    setSalvando(true)
    await supabase.from('wpp_configuracoes').update({
      mensagem: cfg.mensagem,
      telefone_interno: cfg.telefone_interno || null,
      updated_at: new Date().toISOString(),
    }).eq('id', cfg.id)
    setSalvando(false)
    setEventoEditando(null)
  }

  async function salvarZapi() {
    setSalvandoZapi(true)
    for (const [chave, valor] of Object.entries(zapiConfig)) {
      await supabase.from('configuracoes').upsert(
        { filial_id: filialSel, chave, valor, updated_at: new Date().toISOString() },
        { onConflict: 'filial_id,chave' }
      )
    }
    setSalvandoZapi(false)
    alert('Configurações Z-API salvas!')
  }

  async function testarWhatsApp() {
    if (!testeFone.trim()) return
    setTestando(true); setTesteResult(null)
    try {
      const fone = testeFone.replace(/\D/g, '')
      const tel = fone.startsWith('55') ? fone : `55${fone}`
      const res = await fetch(
        `https://api.z-api.io/instances/${zapiConfig.zapi_instance_id}/token/${zapiConfig.zapi_token}/send-text`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': zapiConfig.zapi_client_token,
          },
          body: JSON.stringify({
            phone: tel,
            message: '🧪 *Teste de conexão — Bendito Lanches ERP*\n\nSe você recebeu esta mensagem, a integração WhatsApp está funcionando! ✅',
          }),
        }
      )
      if (res.ok) {
        setTesteResult({ ok: true, msg: 'Mensagem enviada com sucesso!' })
      } else {
        const err = await res.text()
        setTesteResult({ ok: false, msg: err })
      }
    } catch (e: any) {
      setTesteResult({ ok: false, msg: e.message })
    }
    setTestando(false)
  }

  if (loading) return <Loading />

  const eventosPorTipo = {
    cliente:  EVENTOS.filter(e => e.paraCliente),
    interno:  EVENTOS.filter(e => !e.paraCliente),
  }

  return (
    <div className="space-y-6">
      <PageHeader title="WhatsApp — Notificações" subtitle="Configure mensagens automáticas por evento"
        action={
          <button onClick={() => load(filialSel)} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-semibold transition">
            <RefreshCw size={15}/> Atualizar
          </button>
        }
      />

      {/* Seletor de filial */}
      <div className="bg-white rounded-xl shadow-md p-4 flex flex-wrap gap-3 items-center">
        <Building2 size={18} className="text-bendito-verde"/>
        <span className="text-sm font-semibold text-gray-700">Unidade:</span>
        <div className="flex gap-2 flex-wrap">
          {filiais.map(f => (
            <button key={f.id} onClick={() => setFilialSel(f.id)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition ${filialSel === f.id ? 'bg-bendito-verde text-white border-bendito-verde' : 'bg-white border-gray-300 text-gray-600 hover:border-bendito-verde'}`}>
              {f.nome}
            </button>
          ))}
        </div>
      </div>

      {/* Z-API Config */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageCircle size={22} className="text-green-500"/>
            <h2 className="text-lg font-bold text-bendito-verde-escuro">Configuração Z-API</h2>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm text-gray-600">WhatsApp ativo</span>
            <div onClick={() => setZapiConfig(z => ({ ...z, zapi_ativo: z.zapi_ativo === 'true' ? 'false' : 'true' }))}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${zapiConfig.zapi_ativo === 'true' ? 'bg-green-500' : 'bg-gray-300'}`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${zapiConfig.zapi_ativo === 'true' ? 'translate-x-5' : 'translate-x-0.5'}`}/>
            </div>
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <Field label="Instance ID">
            <Input value={zapiConfig.zapi_instance_id}
              onChange={e => setZapiConfig(z => ({ ...z, zapi_instance_id: e.target.value }))}
              placeholder="Ex: 3F270655F5F201F43..."/>
          </Field>
          <Field label="Token">
            <div className="relative">
              <Input type={showToken ? 'text' : 'password'} value={zapiConfig.zapi_token}
                onChange={e => setZapiConfig(z => ({ ...z, zapi_token: e.target.value }))}
                placeholder="Token da instância"/>
              <button onClick={() => setShowToken(!showToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showToken ? <EyeOff size={15}/> : <Eye size={15}/>}
              </button>
            </div>
          </Field>
          <Field label="Client Token">
            <Input type="password" value={zapiConfig.zapi_client_token}
              onChange={e => setZapiConfig(z => ({ ...z, zapi_client_token: e.target.value }))}
              placeholder="Client Token"/>
          </Field>
        </div>

        {/* Teste de envio */}
        <div className="flex gap-3 items-end mb-4">
          <Field label="Número para teste">
            <Input value={testeFone} onChange={e => setTesteFone(e.target.value)} placeholder="(61) 9xxxx-xxxx"/>
          </Field>
          <button onClick={testarWhatsApp} disabled={testando || !testeFone || !zapiConfig.zapi_instance_id}
            className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50 whitespace-nowrap">
            <Send size={15}/> {testando ? 'Enviando...' : 'Testar'}
          </button>
        </div>
        {testeResult && (
          <div className={`flex items-center gap-2 text-sm font-semibold mb-4 ${testeResult.ok ? 'text-green-600' : 'text-red-600'}`}>
            {testeResult.ok ? <CheckCircle size={16}/> : <XCircle size={16}/>} {testeResult.msg}
          </div>
        )}

        <PrimaryButton onClick={salvarZapi} disabled={salvandoZapi} className="flex items-center gap-2">
          <MessageCircle size={16}/> {salvandoZapi ? 'Salvando...' : 'Salvar configurações Z-API'}
        </PrimaryButton>
      </div>

      {/* Variáveis disponíveis */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-xs font-bold text-blue-700 mb-2">📝 Variáveis disponíveis nas mensagens:</p>
        <div className="flex flex-wrap gap-2">
          {VARIAVEIS.map(v => (
            <span key={v} className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-mono text-xs">{v}</span>
          ))}
        </div>
      </div>

      {/* Eventos para clientes */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h2 className="font-bold text-bendito-verde-escuro flex items-center gap-2">
            👥 Notificações para Clientes Externos
          </h2>
          <p className="text-xs text-gray-500 mt-1">Enviadas automaticamente para o WhatsApp do cliente</p>
        </div>
        <div className="divide-y">
          {eventosPorTipo.cliente.map(ev => {
            const cfg = configs[ev.key]
            if (!cfg) return null
            const editando = eventoEditando === ev.key
            return (
              <div key={ev.key} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="font-semibold text-bendito-verde-escuro">{ev.label}</p>
                      <p className="text-xs text-gray-500">{ev.desc}</p>
                    </div>
                    {!editando && (
                      <p className="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded line-clamp-2">{cfg.mensagem}</p>
                    )}
                    {editando && (
                      <div className="mt-3 space-y-2">
                        <textarea value={cfg.mensagem}
                          onChange={e => setConfigs(prev => ({ ...prev, [ev.key]: { ...prev[ev.key], mensagem: e.target.value } }))}
                          rows={4} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado resize-none"/>
                        <div className="flex gap-2">
                          <SecondaryButton onClick={() => setEventoEditando(null)} className="text-xs py-1.5">Cancelar</SecondaryButton>
                          <PrimaryButton onClick={() => salvarMensagem(ev.key)} disabled={salvando} className="text-xs py-1.5">
                            {salvando ? 'Salvando...' : '💾 Salvar mensagem'}
                          </PrimaryButton>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {!editando && (
                      <button onClick={() => setEventoEditando(ev.key)}
                        className="text-xs text-bendito-verde hover:underline font-semibold">✏️ Editar</button>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500">Ativo</span>
                      <div onClick={() => toggleEvento(ev.key, 'ativo')}
                        className={`w-10 h-5 rounded-full cursor-pointer relative transition-colors ${cfg.ativo ? 'bg-green-500' : 'bg-gray-300'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${cfg.ativo ? 'translate-x-5' : 'translate-x-0.5'}`}/>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Eventos internos */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h2 className="font-bold text-bendito-verde-escuro flex items-center gap-2">
            🏢 Notificações para Equipe Interna
          </h2>
          <p className="text-xs text-gray-500 mt-1">Enviadas para o número configurado em cada evento</p>
        </div>
        <div className="divide-y">
          {eventosPorTipo.interno.map(ev => {
            const cfg = configs[ev.key]
            if (!cfg) return null
            const editando = eventoEditando === ev.key
            return (
              <div key={ev.key} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="font-semibold text-bendito-verde-escuro">{ev.label}</p>
                      <p className="text-xs text-gray-500">{ev.desc}</p>
                    </div>
                    {!editando && cfg.telefone_interno && (
                      <p className="text-xs text-blue-600 mt-1">📱 Enviar para: {cfg.telefone_interno}</p>
                    )}
                    {!editando && (
                      <p className="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded line-clamp-2">{cfg.mensagem}</p>
                    )}
                    {editando && (
                      <div className="mt-3 space-y-2">
                        <div>
                          <label className="text-xs font-semibold text-gray-600 mb-1 block">Número para receber notificações</label>
                          <Input value={cfg.telefone_interno || ''}
                            onChange={e => setConfigs(prev => ({ ...prev, [ev.key]: { ...prev[ev.key], telefone_interno: e.target.value } }))}
                            placeholder="(61) 9xxxx-xxxx"/>
                        </div>
                        <textarea value={cfg.mensagem}
                          onChange={e => setConfigs(prev => ({ ...prev, [ev.key]: { ...prev[ev.key], mensagem: e.target.value } }))}
                          rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado resize-none"/>
                        <div className="flex gap-2">
                          <SecondaryButton onClick={() => setEventoEditando(null)} className="text-xs py-1.5">Cancelar</SecondaryButton>
                          <PrimaryButton onClick={() => salvarMensagem(ev.key)} disabled={salvando} className="text-xs py-1.5">
                            {salvando ? 'Salvando...' : '💾 Salvar'}
                          </PrimaryButton>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {!editando && (
                      <button onClick={() => setEventoEditando(ev.key)}
                        className="text-xs text-bendito-verde hover:underline font-semibold">✏️ Editar</button>
                    )}
                    <div className="flex flex-col gap-1.5 items-end">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-500">Ativo</span>
                        <div onClick={() => toggleEvento(ev.key, 'ativo')}
                          className={`w-10 h-5 rounded-full cursor-pointer relative transition-colors ${cfg.ativo ? 'bg-green-500' : 'bg-gray-300'}`}>
                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${cfg.ativo ? 'translate-x-5' : 'translate-x-0.5'}`}/>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-500">Interno</span>
                        <div onClick={() => toggleEvento(ev.key, 'enviar_interno')}
                          className={`w-10 h-5 rounded-full cursor-pointer relative transition-colors ${cfg.enviar_interno ? 'bg-blue-500' : 'bg-gray-300'}`}>
                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${cfg.enviar_interno ? 'translate-x-5' : 'translate-x-0.5'}`}/>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
