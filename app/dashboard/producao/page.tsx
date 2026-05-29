'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FILIAL_ID, formatData, STATUS_PRODUCAO } from '@/lib/constants'
import Modal from '@/components/Modal'
import { Field, Input, Select, Textarea, PrimaryButton, SecondaryButton, PageHeader, Loading, EmptyState, StatusBadge } from '@/components/ui'
import { Plus, Trash2, Factory } from 'lucide-react'

export default function ProducaoPage() {
  const supabase = createClient()
  const [ordens, setOrdens] = useState<any[]>([])
  const [produtos, setProdutos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState<any>({})
  const [itens, setItens] = useState<{ produto_id: string; nome: string; quantidade_planejada: number }[]>([])
  const [prodSel, setProdSel] = useState('')
  const [qtdSel, setQtdSel] = useState(1)

  async function load() {
    setLoading(true)
    const [ord, prod] = await Promise.all([
      supabase.from('ordens_producao').select('*, ordem_producao_itens(id, quantidade_planejada, quantidade_produzida, produtos(nome))').order('data_producao', { ascending: false }),
      supabase.from('produtos').select('id, nome').eq('ativo', true).order('nome'),
    ])
    setOrdens(ord.data || [])
    setProdutos(prod.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function abrirNovo() {
    setForm({ data_producao: new Date().toISOString().split('T')[0], turno: 'manha', observacoes: '' })
    setItens([]); setProdSel(''); setQtdSel(1)
    setModalOpen(true)
  }

  function addItem() {
    if (!prodSel) return
    const p = produtos.find((x) => x.id === prodSel)
    if (!p) return
    setItens((prev) => [...prev.filter((i) => i.produto_id !== prodSel), { produto_id: prodSel, nome: p.nome, quantidade_planejada: Number(qtdSel) || 1 }])
    setProdSel(''); setQtdSel(1)
  }

  async function salvar() {
    if (itens.length === 0) { alert('Adicione ao menos um produto à ordem.'); return }
    setSalvando(true)
    const { data: ordem, error } = await supabase.from('ordens_producao').insert({
      filial_id: FILIAL_ID,
      data_producao: form.data_producao,
      turno: form.turno || null,
      status: 'planejada',
      observacoes: form.observacoes || null,
    }).select('id').single()

    if (error || !ordem) { setSalvando(false); alert('Erro: ' + error?.message); return }

    const itensPayload = itens.map((i) => ({
      filial_id: FILIAL_ID, ordem_id: ordem.id, produto_id: i.produto_id, quantidade_planejada: i.quantidade_planejada,
    }))
    const { error: errItens } = await supabase.from('ordem_producao_itens').insert(itensPayload)
    setSalvando(false)
    if (errItens) { alert('Ordem criada, erro nos itens: ' + errItens.message); return }
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

          <div className="border border-gray-200 rounded-lg p-3">
            <p className="text-sm font-medium text-gray-700 mb-2">Itens da ordem</p>
            <div className="flex gap-2 mb-3">
              <Select value={prodSel} onChange={(e) => setProdSel(e.target.value)} className="flex-1">
                <option value="">Selecione um produto...</option>
                {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </Select>
              <Input type="number" min={1} value={qtdSel} onChange={(e) => setQtdSel(Number(e.target.value))} className="w-20" />
              <SecondaryButton onClick={addItem}>Add</SecondaryButton>
            </div>
            {itens.length === 0 ? <p className="text-xs text-gray-400">Nenhum item adicionado.</p> : (
              <div className="space-y-1">
                {itens.map((i) => (
                  <div key={i.produto_id} className="flex justify-between items-center text-sm bg-bendito-creme rounded px-2 py-1">
                    <span>{i.nome}</span>
                    <div className="flex items-center gap-2">
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
