'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatBRL, formatData } from '@/lib/constants'
import { PageHeader, Loading, EmptyState, Field, Input, Textarea, PrimaryButton, SecondaryButton } from '@/components/ui'
import Modal from '@/components/Modal'
import {
  Plus, Edit, Truck, User, MapPin, CheckCircle, XCircle,
  RefreshCw, Filter, Package, Clock, Star, AlertTriangle,
  ChevronRight, Building2, Phone,
} from 'lucide-react'

const STATUS_COR: Record<string, string> = {
  pendente:    'bg-yellow-100 text-yellow-700',
  saiu:        'bg-blue-100 text-blue-700',
  entregue:    'bg-green-100 text-green-700',
  problema:    'bg-red-100 text-red-700',
  cancelada:   'bg-gray-100 text-gray-500',
}
const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente', saiu: 'Saiu p/ Entrega',
  entregue: 'Entregue', problema: 'Problema', cancelada: 'Cancelada',
}

export default function EntregasPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [entregas, setEntregas] = useState<any[]>([])
  const [entregadores, setEntregadores] = useState<any[]>([])
  const [filiais, setFiliais] = useState<any[]>([])
  const [pedidosPendentes, setPedidosPendentes] = useState<any[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [filialFiltro, setFilialFiltro] = useState('todas')
  const [statusFiltro, setStatusFiltro] = useState('todas')
  const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split('T')[0])
  const [modalOpen, setModalOpen] = useState(false)
  const [modalDetalhe, setModalDetalhe] = useState(false)
  const [entregaSel, setEntregaSel] = useState<any>(null)
  const [editando, setEditando] = useState<any>(null)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState<any>({
    filial_id: '', pedido_id: '', entregador_id: '',
    endereco_completo: '', cliente_nome: '', cliente_tel: '',
    tempo_estimado_min: 45, observacoes: '',
  })
  // Confirmação de entrega
  const [modalConfirmar, setModalConfirmar] = useState(false)
  const [motivoProblema, setMotivoProblema] = useState('')
  const [avaliacao, setAvaliacao] = useState(5)
  const [confirmando, setConfirmando] = useState(false)

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('papel, filial_id').eq('id', user!.id).maybeSingle()
    const admin = ['admin', 'matriz'].includes(profile?.papel || '')
    setIsAdmin(admin)

    let query = supabase.from('vw_entregas_dia').select('*')
    if (filialFiltro !== 'todas') query = query.eq('filial_id', filialFiltro)
    if (statusFiltro !== 'todas') query = query.eq('status', statusFiltro)
    if (dataFiltro) query = query.gte('created_at', `${dataFiltro}T00:00:00`).lte('created_at', `${dataFiltro}T23:59:59`)

    const [ents, entrs, fils, peds] = await Promise.all([
      query,
      supabase.from('entregadores').select('id, nome, telefone, veiculo_tipo, filial_id').eq('ativo', true).order('nome'),
      supabase.from('filiais').select('id, nome').eq('ativo', true),
      supabase.from('pedidos').select('id, numero_pedido, valor_total, clientes(nome, nome_loja, telefone, endereco)')
        .in('status', ['confirmado', 'em_producao']).order('created_at', { ascending: false }).limit(50),
    ])
    setEntregas(ents.data || [])
    setEntregadores(entrs.data || [])
    setFiliais(fils.data || [])
    setPedidosPendentes(peds.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [filialFiltro, statusFiltro, dataFiltro])

  function abrirNova() {
    setEditando(null)
    setForm({
      filial_id: filiais[0]?.id || '', pedido_id: '', entregador_id: '',
      endereco_completo: '', cliente_nome: '', cliente_tel: '',
      tempo_estimado_min: 45, observacoes: '',
    })
    setModalOpen(true)
  }

  function preencherPedido(pedidoId: string) {
    const p = pedidosPendentes.find(x => x.id === pedidoId)
    if (!p) return
    setForm((prev: any) => ({
      ...prev,
      pedido_id: pedidoId,
      cliente_nome: p.clientes?.nome_loja || p.clientes?.nome || '',
      cliente_tel:  p.clientes?.telefone || '',
      endereco_completo: p.clientes?.endereco || '',
    }))
  }

  async function salvar() {
    if (!form.filial_id || !form.endereco_completo) return
    setSalvando(true)
    const payload = {
      ...form,
      pedido_id: form.pedido_id || null,
      entregador_id: form.entregador_id || null,
      status: 'pendente',
      tempo_estimado_min: Number(form.tempo_estimado_min) || 45,
    }
    if (editando) {
      await supabase.from('entregas').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editando.id)
    } else {
      await supabase.from('entregas').insert(payload)
    }
    setSalvando(false); setModalOpen(false); load()
  }

  async function marcarSaiu(id: string) {
    await supabase.from('entregas').update({
      status: 'saiu', hora_saida: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', id)
    // Atualizar pedido para "saiu_para_entrega"
    const e = entregas.find(x => x.id === id)
    if (e?.pedido_id) {
      await supabase.from('pedidos').update({ status: 'saiu_para_entrega' }).eq('id', e.pedido_id)
    }
    load()
  }

  async function confirmarEntrega(status: 'entregue' | 'problema') {
    if (!entregaSel) return
    setConfirmando(true)
    await supabase.from('entregas').update({
      status,
      hora_entrega: new Date().toISOString(),
      avaliacao:    status === 'entregue' ? avaliacao : null,
      motivo_problema: status === 'problema' ? motivoProblema : null,
      updated_at: new Date().toISOString(),
    }).eq('id', entregaSel.id)
    // Atualizar pedido
    if (entregaSel.pedido_id) {
      await supabase.from('pedidos').update({
        status: status === 'entregue' ? 'entregue' : 'problema_entrega',
      }).eq('id', entregaSel.pedido_id)
    }
    setConfirmando(false); setModalConfirmar(false); setModalDetalhe(false)
    setMotivoProblema(''); setAvaliacao(5); load()
  }

  // KPIs
  const total    = entregas.length
  const pendentes = entregas.filter(e => e.status === 'pendente').length
  const saindo   = entregas.filter(e => e.status === 'saiu').length
  const entregues = entregas.filter(e => e.status === 'entregue').length
  const problemas = entregas.filter(e => e.status === 'problema').length

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <PageHeader title="Gestão de Entregas" subtitle="Controle de rotas, entregadores e confirmações"
        action={
          <PrimaryButton onClick={abrirNova} className="flex items-center gap-2">
            <Plus size={16}/> Nova entrega
          </PrimaryButton>
        }
      />

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-md p-4 flex flex-wrap gap-3 items-center">
        <Filter size={16} className="text-gray-400"/>
        <input type="date" value={dataFiltro} onChange={e => setDataFiltro(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado"/>
        <select value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
          <option value="todas">Todos os status</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {isAdmin && (
          <select value={filialFiltro} onChange={e => setFilialFiltro(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
            <option value="todas">Todas as unidades</option>
            {filiais.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        )}
        <button onClick={load} className="ml-auto text-gray-400 hover:text-bendito-verde">
          <RefreshCw size={15}/>
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total',     valor: total,     cor: 'text-gray-700',   bg: 'bg-white' },
          { label: 'Pendentes', valor: pendentes, cor: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'Em Rota',   valor: saindo,    cor: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'Entregues', valor: entregues, cor: 'text-green-600',  bg: 'bg-green-50' },
          { label: '⚠️ Problemas', valor: problemas, cor: 'text-red-600', bg: 'bg-red-50' },
        ].map(c => (
          <div key={c.label} className={`${c.bg} rounded-xl shadow-md p-4 text-center border border-gray-100`}>
            <p className="text-xs text-gray-500">{c.label}</p>
            <p className={`text-2xl font-bold ${c.cor} mt-1`}>{c.valor}</p>
          </div>
        ))}
      </div>

      {/* Lista de entregas */}
      {entregas.length === 0 ? <EmptyState message="Nenhuma entrega encontrada." /> : (
        <div className="space-y-3">
          {entregas.map(e => (
            <div key={e.id} className={`bg-white rounded-xl shadow-md p-4 border-l-4 ${
              e.status === 'entregue' ? 'border-green-400' :
              e.status === 'saiu'    ? 'border-blue-400' :
              e.status === 'problema'? 'border-red-400' :
              'border-yellow-400'
            }`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className={`p-2 rounded-lg shrink-0 ${STATUS_COR[e.status] || 'bg-gray-100'}`}>
                    <Truck size={16}/>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {e.numero_pedido && (
                        <span className="font-bold text-bendito-verde-escuro">Pedido #{e.numero_pedido}</span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COR[e.status]}`}>
                        {STATUS_LABEL[e.status]}
                      </span>
                      {e.valor_total && (
                        <span className="text-xs font-semibold text-bendito-verde">{formatBRL(e.valor_total)}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 mt-1 text-sm text-gray-600">
                      <User size={13} className="text-gray-400 shrink-0"/>
                      <span>{e.cliente_nome || '—'}</span>
                      {e.cliente_tel && (
                        <a href={`tel:${e.cliente_tel}`} className="ml-1 text-blue-500 hover:underline flex items-center gap-0.5 text-xs">
                          <Phone size={11}/> {e.cliente_tel}
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-500">
                      <MapPin size={11} className="text-gray-400 shrink-0"/>
                      <span className="truncate">{e.endereco_completo}</span>
                    </div>

                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                      {e.entregador_nome && (
                        <span className="flex items-center gap-1"><Truck size={11}/> {e.entregador_nome}</span>
                      )}
                      {e.tempo_estimado_min && e.status === 'pendente' && (
                        <span className="flex items-center gap-1"><Clock size={11}/> ~{e.tempo_estimado_min} min</span>
                      )}
                      {e.hora_saida && (
                        <span className="flex items-center gap-1"><Clock size={11}/> Saiu: {new Date(e.hora_saida).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span>
                      )}
                      {e.hora_entrega && e.status === 'entregue' && (
                        <span className="flex items-center gap-1 text-green-600"><CheckCircle size={11}/> {new Date(e.hora_entrega).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span>
                      )}
                      {e.avaliacao && (
                        <span className="flex items-center gap-0.5 text-yellow-500">
                          {'⭐'.repeat(e.avaliacao)}
                        </span>
                      )}
                    </div>

                    {e.motivo_problema && (
                      <p className="text-xs text-red-600 mt-1 bg-red-50 px-2 py-1 rounded flex items-center gap-1">
                        <AlertTriangle size={11}/> {e.motivo_problema}
                      </p>
                    )}
                  </div>
                </div>

                {/* Ações */}
                <div className="flex flex-col gap-2 shrink-0">
                  <button onClick={() => { setEntregaSel(e); setModalDetalhe(true) }}
                    className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold transition">
                    Ver detalhes
                  </button>
                  {e.status === 'pendente' && e.entregador_id && (
                    <button onClick={() => marcarSaiu(e.id)}
                      className="flex items-center gap-1 bg-blue-500 hover:bg-blue-400 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition">
                      <Truck size={12}/> Despachar
                    </button>
                  )}
                  {e.status === 'saiu' && (
                    <button onClick={() => { setEntregaSel(e); setModalConfirmar(true) }}
                      className="flex items-center gap-1 bg-green-500 hover:bg-green-400 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition">
                      <CheckCircle size={12}/> Confirmar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal nova entrega */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editando ? 'Editar entrega' : 'Nova Entrega'}>
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {isAdmin && (
            <Field label="Unidade">
              <select value={form.filial_id} onChange={e => setForm({...form, filial_id: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                {filiais.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </Field>
          )}

          {/* Vincular pedido */}
          <Field label="Pedido (opcional)">
            <select value={form.pedido_id} onChange={e => { setForm({...form, pedido_id: e.target.value}); preencherPedido(e.target.value) }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
              <option value="">Entrega avulsa (sem pedido)</option>
              {pedidosPendentes.map(p => (
                <option key={p.id} value={p.id}>
                  #{p.numero_pedido} — {p.clientes?.nome_loja || p.clientes?.nome} — {formatBRL(p.valor_total)}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome do cliente">
              <Input value={form.cliente_nome} onChange={e => setForm({...form, cliente_nome: e.target.value})} placeholder="Nome ou empresa"/>
            </Field>
            <Field label="Telefone do cliente">
              <Input value={form.cliente_tel} onChange={e => setForm({...form, cliente_tel: e.target.value})} placeholder="(61) 9xxxx-xxxx"/>
            </Field>
          </div>

          <Field label="Endereço de entrega" required>
            <Textarea rows={2} value={form.endereco_completo} onChange={e => setForm({...form, endereco_completo: e.target.value})}
              placeholder="Rua, número, bairro, referência..."/>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Entregador">
              <select value={form.entregador_id} onChange={e => setForm({...form, entregador_id: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                <option value="">A definir</option>
                {entregadores.map(en => (
                  <option key={en.id} value={en.id}>{en.nome} {en.veiculo_tipo ? `(${en.veiculo_tipo})` : ''}</option>
                ))}
              </select>
            </Field>
            <Field label="Tempo estimado (min)">
              <Input type="number" min={5} value={form.tempo_estimado_min}
                onChange={e => setForm({...form, tempo_estimado_min: e.target.value})}/>
            </Field>
          </div>

          <Field label="Observações">
            <Textarea rows={2} value={form.observacoes} onChange={e => setForm({...form, observacoes: e.target.value})}
              placeholder="Complemento, ponto de referência, instruções..."/>
          </Field>

          <div className="flex gap-3">
            <SecondaryButton onClick={() => setModalOpen(false)} className="flex-1">Cancelar</SecondaryButton>
            <PrimaryButton onClick={salvar} disabled={salvando || !form.endereco_completo} className="flex-1">
              {salvando ? 'Salvando...' : editando ? 'Salvar' : 'Criar entrega'}
            </PrimaryButton>
          </div>
        </div>
      </Modal>

      {/* Modal detalhe */}
      <Modal isOpen={modalDetalhe} onClose={() => setModalDetalhe(false)} title="Detalhes da Entrega">
        {entregaSel && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
              {entregaSel.numero_pedido && <p>Pedido: <strong>#{entregaSel.numero_pedido}</strong></p>}
              <p>Status: <span className={`px-2 py-0.5 rounded-full font-semibold ${STATUS_COR[entregaSel.status]}`}>{STATUS_LABEL[entregaSel.status]}</span></p>
              {entregaSel.entregador_nome && <p>Entregador: <strong>{entregaSel.entregador_nome}</strong></p>}
              {entregaSel.valor_total && <p>Valor: <strong className="text-bendito-verde">{formatBRL(entregaSel.valor_total)}</strong></p>}
              {entregaSel.hora_saida && <p>Saída: <strong>{new Date(entregaSel.hora_saida).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</strong></p>}
              {entregaSel.hora_entrega && <p>Entrega: <strong>{new Date(entregaSel.hora_entrega).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</strong></p>}
            </div>

            <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
              <p className="flex items-center gap-2"><User size={14} className="text-gray-400"/> <strong>{entregaSel.cliente_nome || '—'}</strong></p>
              {entregaSel.cliente_tel && (
                <a href={`tel:${entregaSel.cliente_tel}`} className="flex items-center gap-2 text-blue-500 hover:underline">
                  <Phone size={14}/> {entregaSel.cliente_tel}
                </a>
              )}
              <p className="flex items-start gap-2 text-gray-600"><MapPin size={14} className="text-gray-400 mt-0.5 shrink-0"/> {entregaSel.endereco_completo}</p>
            </div>

            {/* Link Google Maps */}
            {entregaSel.endereco_completo && (
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(entregaSel.endereco_completo)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 px-4 py-2.5 rounded-xl text-sm font-semibold transition">
                🗺️ Abrir no Google Maps <ChevronRight size={14}/>
              </a>
            )}

            {entregaSel.observacoes && (
              <p className="text-xs bg-yellow-50 border border-yellow-200 p-2 rounded">📝 {entregaSel.observacoes}</p>
            )}

            {entregaSel.avaliacao && (
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">Avaliação do cliente</p>
                <p className="text-2xl">{'⭐'.repeat(entregaSel.avaliacao)}</p>
              </div>
            )}

            {entregaSel.motivo_problema && (
              <p className="text-xs bg-red-50 border border-red-200 p-2 rounded text-red-700">
                ⚠️ Problema: {entregaSel.motivo_problema}
              </p>
            )}

            {/* Ações */}
            {entregaSel.status === 'pendente' && entregaSel.entregador_id && (
              <PrimaryButton onClick={() => { marcarSaiu(entregaSel.id); setModalDetalhe(false) }} className="w-full flex items-center justify-center gap-2">
                <Truck size={16}/> Despachar entregador
              </PrimaryButton>
            )}
            {entregaSel.status === 'saiu' && (
              <PrimaryButton onClick={() => setModalConfirmar(true)} className="w-full flex items-center justify-center gap-2">
                <CheckCircle size={16}/> Confirmar entrega
              </PrimaryButton>
            )}
          </div>
        )}
      </Modal>

      {/* Modal confirmar entrega */}
      <Modal isOpen={modalConfirmar} onClose={() => setModalConfirmar(false)} title="Confirmar Entrega">
        {entregaSel && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p className="font-semibold">{entregaSel.cliente_nome}</p>
              <p className="text-gray-500 text-xs mt-0.5">{entregaSel.endereco_completo}</p>
            </div>

            {/* Avaliação */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Avaliação da entrega</label>
              <div className="flex gap-2">
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => setAvaliacao(n)}
                    className={`text-2xl transition ${n <= avaliacao ? 'opacity-100' : 'opacity-30'}`}>⭐</button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <PrimaryButton onClick={() => confirmarEntrega('entregue')} disabled={confirmando}
                className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400">
                <CheckCircle size={16}/> {confirmando ? 'Salvando...' : 'Entregue ✅'}
              </PrimaryButton>
              <SecondaryButton onClick={() => {
                const m = window.prompt('Descreva o problema:')
                if (m) { setMotivoProblema(m); confirmarEntrega('problema') }
              }} disabled={confirmando}
                className="flex-1 text-red-600 flex items-center justify-center gap-2">
                <XCircle size={16}/> Problema
              </SecondaryButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
