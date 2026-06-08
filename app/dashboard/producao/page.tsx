'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FILIAL_ID, formatData, STATUS_PRODUCAO } from '@/lib/constants'
import Modal from '@/components/Modal'
import { Field, Input, Select, Textarea, PrimaryButton, SecondaryButton, PageHeader, Loading, EmptyState, StatusBadge } from '@/components/ui'
import { Plus, Trash2, Factory, Truck, User, Building2 } from 'lucide-react'

type OrigemTipo = 'pedido_cliente' | 'transferencia_filial' | 'estoque_proprio'

export default function ProducaoPage() {
  const supabase = createClient()
  const [ordens, setOrdens] = useState<any[]>([])
  const [produtos, setProdutos] = useState<any[]>([])
  const [pedidosAbertos, setPedidosAbertos] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [filiais, setFiliais] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState<any>({})
  const [itens, setItens] = useState<{ produto_id: string; nome: string; quantidade_planejada: number }[]>([])
  const [prodSel, setProdSel] = useState('')
  const [qtdSel, setQtdSel] = useState(1)

  async function load() {
    setLoading(true)
    const [ord, prod, ped, cli, fil] = await Promise.all([
      supabase.from('ordens_producao').select(`
        *,
        ordem_producao_itens(id, quantidade_planejada, quantidade_produzida, produtos(nome)),
        pedido:pedidos(numero_pedido, cliente:clientes(nome)),
        cliente:clientes(nome),
        filial_destino:filiais!ordens_producao_filial_destino_id_fkey(nome)
      `).order('data_producao', { ascending: false }),
      supabase.from('produtos').select('id, nome').eq('ativo', true).order('nome'),
      // pedidos ainda não atendidos por produção
      supabase.from('pedidos').select('id, numero_pedido, clientes(nome)').in('status', ['pendente', 'em_analise', 'confirmado']).order('numero_pedido', { ascending: false }).limit(50),
      supabase.from('clientes').select('id, nome').eq('ativo', true).order('nome'),
      supabase.from('filiais').select('id, nome').eq('ativo', true).order('nome'),
    ])
    setOrdens(ord.data || [])
    setProdutos(prod.data || [])
    setPedidosAbertos(ped.data || [])
    setClientes(cli.data || [])
    // Filtra filiais para não mostrar a matriz como "destino" (origem da ordem)
    setFiliais((fil.data || []).filter((f: any) => f.id !== FILIAL_ID))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function abrirNovo() {
    setForm({
      data_producao: new Date().toISOString().split('T')[0],
      turno: 'manha',
      origem_tipo: 'estoque_proprio' as OrigemTipo,
      pedido_id: '',
      cliente_id: '',
      filial_destino_id: '',
      observacoes: '',
    })
    setItens([]); setProdSel(''); setQtdSel(1)
    setModalOpen(true)
  }

  function addItem() {
    if (!prodSel) return
    const p = produtos.find((x) => x.id === prodSel)
    if (!p) return
    setItens((prev) => [
      ...prev.filter((i) => i.produto_id !== prodSel),
      { produto_id: prodSel, nome: p.nome, quantidade_planejada: Number(qtdSel) || 1 },
    ])
    setProdSel(''); setQtdSel(1)
  }

  // Quando seleciona um pedido, pré-preenche o cliente e os itens
  async function selecionarPedido(pedidoId: string) {
    setForm({ ...form, pedido_id: pedidoId })
    if (!pedidoId) return
    const { data: itensPedido } = await supabase
      .from('pedido_itens')
      .select('produto_id, quantidade, produtos(nome)')
      .eq('pedido_id', pedidoId)
    if (itensPedido) {
      // Só puxa itens que têm produto cadastrado (ignora venda diversa)
      const novosItens = itensPedido
        .filter((it: any) => it.produto_id && it.produtos)
        .map((it: any) => ({
          produto_id: it.produto_id,
          nome: it.produtos.nome,
          quantidade_planejada: it.quantidade,
        }))
      setItens(novosItens)
    }
    // Também pega o cliente do pedido
    const ped = pedidosAbertos.find((p) => p.id === pedidoId)
    if (ped) {
      const { data: pedFull } = await supabase
        .from('pedidos').select('cliente_id').eq('id', pedidoId).single()
      if (pedFull?.cliente_id) {
        setForm((f: any) => ({ ...f, pedido_id: pedidoId, cliente_id: pedFull.cliente_id }))
      }
    }
  }

  async function salvar() {
    if (itens.length === 0) { alert('Adicione ao menos um produto à ordem.'); return }

    // Validar coerência do tipo de origem
    if (form.origem_tipo === 'pedido_cliente' && !form.pedido_id) {
      alert('Selecione o pedido do cliente.'); return
    }
    if (form.origem_tipo === 'transferencia_filial' && !form.filial_destino_id) {
      alert('Selecione a filial destino.'); return
    }

    setSalvando(true)
    const { data: ordem, error } = await supabase.from('ordens_producao').insert({
      filial_id: FILIAL_ID,
      data_producao: form.data_producao,
      turno: form.turno || null,
      status: 'planejada',
      observacoes: form.observacoes || null,
      origem_tipo: form.origem_tipo,
      pedido_id: form.origem_tipo === 'pedido_cliente' ? form.pedido_id : null,
      cliente_id: form.origem_tipo === 'pedido_cliente' ? (form.cliente_id || null) : null,
      filial_destino_id: form.origem_tipo === 'transferencia_filial' ? form.filial_destino_id : null,
    }).select('id').single()

    if (error || !ordem) {
      setSalvando(false)
      alert('Erro ao criar ordem: ' + (error?.message || 'desconhecido'))
      return
    }

    const itensPayload = itens.map((i) => ({
      filial_id: FILIAL_ID, ordem_id: ordem.id, produto_id: i.produto_id, quantidade_planejada: i.quantidade_planejada,
    }))
    const { error: errItens } = await supabase.from('ordem_producao_itens').insert(itensPayload)
    setSalvando(false)
    if (errItens) { alert('Ordem criada, mas erro nos itens: ' + errItens.message); return }
    setModalOpen(false); load()
  }

  async function mudarStatus(id: string, status: string) {
    const { error } = await supabase.from('ordens_producao').update({ status }).eq('id', id)
    if (error) { alert('Erro: ' + error.message); return }
    load()
  }

  async function excluir(o: any) {
    if (!confirm(`Excluir a ordem #${o.numero_ordem}?`)) return
    await supabase.from('ordem_producao_itens').delete().eq('ordem_id', o.id)
    const { error } = await supabase.from('ordens_producao').delete().eq('id', o.id)
    if (error) { alert('Erro: ' + error.message); return }
    load()
  }

  // Renderiza um pequeno chip indicando a origem da ordem
  function ChipOrigem({ o }: { o: any }) {
    if (o.origem_tipo === 'pedido_cliente' && o.pedido) {
      return (
        <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
          <User size={11} /> Pedido #{o.pedido.numero_pedido} · {o.pedido.cliente?.nome || o.cliente?.nome || '—'}
        </span>
      )
    }
    if (o.origem_tipo === 'transferencia_filial' && o.filial_destino) {
      return (
        <span className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded">
          <Truck size={11} /> → {o.filial_destino.nome}
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
        <Building2 size={11} /> Estoque próprio
      </span>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Produção" subtitle="Ordens de produção"
        action={<PrimaryButton onClick={abrirNovo} className="flex items-center gap-2"><Plus size={20} /> Nova Ordem</PrimaryButton>} />

      {loading ? <Loading /> : ordens.length === 0 ? <EmptyState message="Nenhuma ordem de produção." /> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {ordens.map((o) => {
            const st = STATUS_PRODUCAO.find((s) => s.value === o.status)
            return (
              <div key={o.id} className="bg-white rounded-xl shadow-md p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Factory className="text-bendito-dourado-escuro" size={20} />
                    <div>
                      <h3 className="font-bold text-bendito-verde-escuro">Ordem #{o.numero_ordem}</h3>
                      <p className="text-xs text-gray-500">{formatData(o.data_producao)} · {o.turno || 'sem turno'}</p>
                    </div>
                  </div>
                  {st && <StatusBadge label={st.label} cor={st.cor} />}
                </div>
                <div className="mb-2">
                  <ChipOrigem o={o} />
                </div>
                <div className="space-y-1 mb-3">
                  {(o.ordem_producao_itens || []).map((it: any) => (
                    <div key={it.id} className="flex justify-between text-sm border-b last:border-0 py-1">
                      <span>{it.produtos?.nome}</span>
                      <span className="text-gray-600">{it.quantidade_produzida}/{it.quantidade_planejada}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <select value={o.status} onChange={(e) => mudarStatus(o.id, e.target.value)} className="flex-1 text-xs border border-gray-300 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-bendito-dourado">
                    {STATUS_PRODUCAO.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <button onClick={() => excluir(o)} className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg"><Trash2 size={15} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Nova Ordem de Produção">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Data" required><Input type="date" value={form.data_producao || ''} onChange={(e) => setForm({ ...form, data_producao: e.target.value })} /></Field>
            <Field label="Turno"><Select value={form.turno || 'manha'} onChange={(e) => setForm({ ...form, turno: e.target.value })}><option value="manha">Manhã</option><option value="tarde">Tarde</option><option value="noite">Noite</option></Select></Field>
          </div>

          {/* APONTAMENTO 4 — Vínculo da ordem */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-3">
            <Field label="Para quê é esta produção?" required>
              <Select value={form.origem_tipo} onChange={(e) => setForm({ ...form, origem_tipo: e.target.value as OrigemTipo, pedido_id: '', cliente_id: '', filial_destino_id: '' })}>
                <option value="estoque_proprio">📦 Estoque próprio (matriz)</option>
                <option value="pedido_cliente">👤 Pedido de cliente</option>
                <option value="transferencia_filial">🚚 Transferência para filial</option>
              </Select>
            </Field>

            {form.origem_tipo === 'pedido_cliente' && (
              <Field label="Pedido vinculado" required>
                <Select value={form.pedido_id} onChange={(e) => selecionarPedido(e.target.value)}>
                  <option value="">Selecione um pedido em aberto...</option>
                  {pedidosAbertos.map((p) => (
                    <option key={p.id} value={p.id}>
                      #{p.numero_pedido} — {p.clientes?.nome || 'sem cliente'}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-gray-600 mt-1">Ao selecionar o pedido, os itens dele são puxados automaticamente abaixo.</p>
              </Field>
            )}

            {form.origem_tipo === 'transferencia_filial' && (
              <Field label="Filial destino" required>
                <Select value={form.filial_destino_id} onChange={(e) => setForm({ ...form, filial_destino_id: e.target.value })}>
                  <option value="">Selecione a filial destino...</option>
                  {filiais.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </Select>
              </Field>
            )}
          </div>

          {/* APONTAMENTO 2 — Itens com produto largo e quantidade compacta */}
          <div className="border border-gray-200 rounded-lg p-3">
            <p className="text-sm font-medium text-gray-700 mb-2">Itens da ordem</p>
            <div className="flex gap-2 mb-3 items-end">
              <div className="flex-1 min-w-0">
                <Select value={prodSel} onChange={(e) => setProdSel(e.target.value)} className="w-full">
                  <option value="">Selecione um produto...</option>
                  {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </Select>
              </div>
              <div className="w-20 flex-shrink-0">
                <Input type="number" min={1} value={qtdSel} onChange={(e) => setQtdSel(Number(e.target.value))} className="text-center" />
              </div>
              <SecondaryButton onClick={addItem} className="flex-shrink-0">Add</SecondaryButton>
            </div>
            {itens.length === 0 ? <p className="text-xs text-gray-400">Nenhum item adicionado.</p> : (
              <div className="space-y-1">
                {itens.map((i) => (
                  <div key={i.produto_id} className="flex justify-between items-center text-sm bg-bendito-creme rounded px-2 py-1">
                    <span className="truncate flex-1 mr-2">{i.nome}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="font-semibold">{i.quantidade_planejada} un</span>
                      <button onClick={() => setItens((prev) => prev.filter((x) => x.produto_id !== i.produto_id))} className="text-red-500"><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Field label="Observações"><Textarea rows={2} value={form.observacoes || ''} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></Field>
          <div className="flex gap-3 pt-2">
            <SecondaryButton onClick={() => setModalOpen(false)} className="flex-1">Cancelar</SecondaryButton>
            <PrimaryButton onClick={salvar} disabled={salvando || itens.length === 0} className="flex-1">{salvando ? 'Salvando...' : 'Criar Ordem'}</PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
