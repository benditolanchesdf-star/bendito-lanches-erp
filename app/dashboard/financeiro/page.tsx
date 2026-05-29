'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FILIAL_ID, formatBRL, formatData, STATUS_FINANCEIRO, FORMAS_PAGAMENTO } from '@/lib/constants'
import Modal from '@/components/Modal'
import { Field, Input, Select, Textarea, PrimaryButton, SecondaryButton, PageHeader, Loading, EmptyState, StatusBadge } from '@/components/ui'
import { Plus, Edit, Trash2, TrendingUp, TrendingDown, Wallet } from 'lucide-react'

export default function FinanceiroPage() {
  const supabase = createClient()
  const [transacoes, setTransacoes] = useState<any[]>([])
  const [planoContas, setPlanoContas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'receita' | 'despesa'>('todos')
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState<any>({})

  async function load() {
    setLoading(true)
    const [trans, pc] = await Promise.all([
      supabase.from('transacoes_financeiras').select('*, plano_contas(nome, tipo)').order('data_vencimento', { ascending: false }).limit(200),
      supabase.from('plano_contas').select('id, nome, tipo').eq('ativo', true).order('nome'),
    ])
    setTransacoes(trans.data || [])
    setPlanoContas(pc.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function abrirNovo() {
    setEditando(null)
    setForm({ tipo: 'receita', descricao: '', valor: 0, plano_conta_id: '', data_vencimento: new Date().toISOString().split('T')[0], status: 'pendente', forma_pagamento: 'dinheiro', observacoes: '' })
    setModalOpen(true)
  }
  function abrirEdicao(t: any) { setEditando(t); setForm({ ...t }); setModalOpen(true) }

  async function salvar() {
    setSalvando(true)
    const payload = {
      filial_id: FILIAL_ID,
      tipo: form.tipo,
      descricao: form.descricao,
      valor: Number(form.valor) || 0,
      plano_conta_id: form.plano_conta_id || null,
      data_vencimento: form.data_vencimento,
      data_pagamento: form.status === 'pago' ? (form.data_pagamento || new Date().toISOString().split('T')[0]) : null,
      status: form.status,
      forma_pagamento: form.forma_pagamento || null,
      observacoes: form.observacoes || null,
    }
    let error
    if (editando) ({ error } = await supabase.from('transacoes_financeiras').update(payload).eq('id', editando.id))
    else ({ error } = await supabase.from('transacoes_financeiras').insert(payload))
    setSalvando(false)
    if (error) { alert('Erro ao salvar: ' + error.message); return }
    setModalOpen(false); load()
  }

  async function marcarPago(t: any) {
    const { error } = await supabase.from('transacoes_financeiras').update({ status: 'pago', data_pagamento: new Date().toISOString().split('T')[0] }).eq('id', t.id)
    if (error) { alert('Erro: ' + error.message); return }
    load()
  }

  async function excluir(t: any) {
    if (!confirm(`Excluir "${t.descricao}"?`)) return
    const { error } = await supabase.from('transacoes_financeiras').delete().eq('id', t.id)
    if (error) { alert('Erro: ' + error.message); return }
    load()
  }

  const filtradas = transacoes.filter((t) => filtroTipo === 'todos' || t.tipo === filtroTipo)
  const totalReceitas = transacoes.filter((t) => t.tipo === 'receita' && t.status === 'pago').reduce((s, t) => s + Number(t.valor || 0), 0)
  const totalDespesas = transacoes.filter((t) => t.tipo === 'despesa' && t.status === 'pago').reduce((s, t) => s + Number(t.valor || 0), 0)
  const saldo = totalReceitas - totalDespesas
  const aReceber = transacoes.filter((t) => t.tipo === 'receita' && t.status === 'pendente').reduce((s, t) => s + Number(t.valor || 0), 0)

  return (
    <div className="space-y-6">
      <PageHeader title="Financeiro" subtitle="Receitas, despesas e fluxo de caixa"
        action={<PrimaryButton onClick={abrirNovo} className="flex items-center gap-2"><Plus size={20} /> Novo Lançamento</PrimaryButton>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-md p-5">
          <div className="flex items-center gap-2 mb-2"><TrendingUp className="text-green-500" size={20} /><span className="text-xs text-gray-600">Receitas Pagas</span></div>
          <p className="text-xl lg:text-2xl font-bold text-green-600">{formatBRL(totalReceitas)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-5">
          <div className="flex items-center gap-2 mb-2"><TrendingDown className="text-red-500" size={20} /><span className="text-xs text-gray-600">Despesas Pagas</span></div>
          <p className="text-xl lg:text-2xl font-bold text-red-600">{formatBRL(totalDespesas)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-5">
          <div className="flex items-center gap-2 mb-2"><Wallet className="text-bendito-verde" size={20} /><span className="text-xs text-gray-600">Saldo</span></div>
          <p className={`text-xl lg:text-2xl font-bold ${saldo >= 0 ? 'text-bendito-verde' : 'text-red-600'}`}>{formatBRL(saldo)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-5">
          <div className="flex items-center gap-2 mb-2"><TrendingUp className="text-bendito-dourado-escuro" size={20} /><span className="text-xs text-gray-600">A Receber</span></div>
          <p className="text-xl lg:text-2xl font-bold text-bendito-dourado-escuro">{formatBRL(aReceber)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-4 flex gap-2">
        {[
          { v: 'todos', l: 'Todos' },
          { v: 'receita', l: 'Receitas' },
          { v: 'despesa', l: 'Despesas' },
        ].map((b) => (
          <button key={b.v} onClick={() => setFiltroTipo(b.v as any)} className={`px-4 py-2 rounded-lg text-sm font-semibold ${filtroTipo === b.v ? 'bg-bendito-verde text-white' : 'bg-gray-100 text-gray-700'}`}>{b.l}</button>
        ))}
      </div>

      {loading ? <Loading /> : filtradas.length === 0 ? <EmptyState message="Nenhum lançamento encontrado." /> : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-bendito-verde-escuro text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-sm">Descrição</th>
                  <th className="px-4 py-3 text-left text-sm">Conta</th>
                  <th className="px-4 py-3 text-left text-sm">Valor</th>
                  <th className="px-4 py-3 text-left text-sm">Vencimento</th>
                  <th className="px-4 py-3 text-left text-sm">Status</th>
                  <th className="px-4 py-3 text-left text-sm">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtradas.map((t) => {
                  const st = STATUS_FINANCEIRO.find((s) => s.value === t.status)
                  return (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium">{t.descricao}</div>
                        <div className="text-xs text-gray-500 capitalize">{t.tipo}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">{t.plano_contas?.nome || '-'}</td>
                      <td className={`px-4 py-3 text-sm font-semibold ${t.tipo === 'receita' ? 'text-green-600' : 'text-red-600'}`}>
                        {t.tipo === 'receita' ? '+' : '-'} {formatBRL(t.valor)}
                      </td>
                      <td className="px-4 py-3 text-sm">{formatData(t.data_vencimento)}</td>
                      <td className="px-4 py-3">{st && <StatusBadge label={st.label} cor={st.cor} />}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {t.status !== 'pago' && <button onClick={() => marcarPago(t)} className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-2 py-1 rounded">Pagar</button>}
                          <button onClick={() => abrirEdicao(t)} className="p-1.5 bg-bendito-dourado/20 hover:bg-bendito-dourado/40 text-bendito-verde-escuro rounded"><Edit size={14} /></button>
                          <button onClick={() => excluir(t)} className="p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editando ? 'Editar Lançamento' : 'Novo Lançamento'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tipo" required><Select value={form.tipo || 'receita'} onChange={(e) => setForm({ ...form, tipo: e.target.value, plano_conta_id: '' })}><option value="receita">Receita</option><option value="despesa">Despesa</option></Select></Field>
            <Field label="Status"><Select value={form.status || 'pendente'} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUS_FINANCEIRO.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select></Field>
          </div>
          <Field label="Descrição" required><Input value={form.descricao || ''} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Valor" required><Input type="number" step="0.01" value={form.valor ?? 0} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></Field>
            <Field label="Vencimento" required><Input type="date" value={form.data_vencimento || ''} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} /></Field>
          </div>
          <Field label="Plano de Contas">
            <Select value={form.plano_conta_id || ''} onChange={(e) => setForm({ ...form, plano_conta_id: e.target.value })}>
              <option value="">Sem conta</option>
              {planoContas.filter((pc) => pc.tipo === form.tipo).map((pc) => <option key={pc.id} value={pc.id}>{pc.nome}</option>)}
            </Select>
          </Field>
          <Field label="Forma de Pagamento"><Select value={form.forma_pagamento || 'dinheiro'} onChange={(e) => setForm({ ...form, forma_pagamento: e.target.value })}>{FORMAS_PAGAMENTO.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</Select></Field>
          <Field label="Observações"><Textarea rows={2} value={form.observacoes || ''} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></Field>
          <div className="flex gap-3 pt-2">
            <SecondaryButton onClick={() => setModalOpen(false)} className="flex-1">Cancelar</SecondaryButton>
            <PrimaryButton onClick={salvar} disabled={salvando || !form.descricao || !form.valor} className="flex-1">{salvando ? 'Salvando...' : 'Salvar'}</PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
