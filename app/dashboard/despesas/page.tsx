'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FILIAL_ID, formatBRL, formatData } from '@/lib/constants'
import { PageHeader, Loading, EmptyState, Field, Input, Textarea, PrimaryButton, SecondaryButton } from '@/components/ui'
import Modal from '@/components/Modal'
import { Plus, Edit, Trash2, TrendingDown, Filter } from 'lucide-react'

const TIPOS = [
  { value: 'fixa',       label: 'Fixa' },
  { value: 'variavel',   label: 'Variável' },
  { value: 'extra',      label: 'Extra' },
  { value: 'rescisao',   label: 'Rescisão' },
  { value: 'multa',      label: 'Multa' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'outros',     label: 'Outros' },
]
const STATUS_COR: Record<string, string> = {
  pendente:  'bg-yellow-100 text-yellow-700',
  pago:      'bg-green-100 text-green-700',
  cancelado: 'bg-red-100 text-red-700',
}

export default function DespesasPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [despesas, setDespesas] = useState<any[]>([])
  const [filiais, setFiliais] = useState<any[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [filialFiltro, setFilialFiltro] = useState('todas')
  const [mesFiltro, setMesFiltro] = useState(new Date().toISOString().slice(0, 7))
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({
    filial_id: FILIAL_ID, tipo: 'fixa', categoria: '', descricao: '',
    valor: '', data_competencia: new Date().toISOString().split('T')[0],
    data_pagamento: '', status: 'pendente', observacoes: '',
  })

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('papel').eq('id', user!.id).maybeSingle()
    const admin = profile?.papel === 'admin' || profile?.papel === 'matriz'
    setIsAdmin(admin)

    let query = supabase.from('despesas')
      .select('*, filiais(nome)')
      .order('data_competencia', { ascending: false })

    if (mesFiltro) {
      query = query.gte('data_competencia', `${mesFiltro}-01`)
        .lte('data_competencia', `${mesFiltro}-31`)
    }
    if (filialFiltro !== 'todas') query = query.eq('filial_id', filialFiltro)

    const [{ data: desps }, { data: fils }] = await Promise.all([
      query,
      supabase.from('filiais').select('id, nome').eq('ativo', true),
    ])
    setDespesas(desps || [])
    setFiliais(fils || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [filialFiltro, mesFiltro])

  function abrirNovo() {
    setEditando(null)
    setForm({
      filial_id: FILIAL_ID, tipo: 'fixa', categoria: '', descricao: '',
      valor: '', data_competencia: new Date().toISOString().split('T')[0],
      data_pagamento: '', status: 'pendente', observacoes: '',
    })
    setModalOpen(true)
  }

  function abrirEdicao(d: any) {
    setEditando(d)
    setForm({
      filial_id: d.filial_id, tipo: d.tipo, categoria: d.categoria || '',
      descricao: d.descricao, valor: String(d.valor),
      data_competencia: d.data_competencia,
      data_pagamento: d.data_pagamento || '',
      status: d.status, observacoes: d.observacoes || '',
    })
    setModalOpen(true)
  }

  async function salvar() {
    if (!form.descricao || !form.valor) return
    setSalvando(true)
    const payload = {
      ...form, valor: Number(form.valor),
      data_pagamento: form.data_pagamento || null,
    }
    if (editando) {
      await supabase.from('despesas').update(payload).eq('id', editando.id)
    } else {
      await supabase.from('despesas').insert(payload)
    }
    setSalvando(false); setModalOpen(false); load()
  }

  async function excluir(d: any) {
    if (!confirm(`Excluir despesa "${d.descricao}"?`)) return
    await supabase.from('despesas').delete().eq('id', d.id)
    load()
  }

  async function marcarPago(d: any) {
    await supabase.from('despesas').update({
      status: 'pago', data_pagamento: new Date().toISOString().split('T')[0],
    }).eq('id', d.id)
    load()
  }

  const totalMes = despesas.reduce((s, d) => s + Number(d.valor || 0), 0)
  const totalPago = despesas.filter(d => d.status === 'pago').reduce((s, d) => s + Number(d.valor || 0), 0)
  const totalPendente = despesas.filter(d => d.status === 'pendente').reduce((s, d) => s + Number(d.valor || 0), 0)

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <PageHeader title="Despesas" subtitle="Controle de gastos fixos, variáveis e extras de todas as unidades"
        action={<PrimaryButton onClick={abrirNovo} className="flex items-center gap-2"><Plus size={16}/> Nova despesa</PrimaryButton>} />

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-md p-4 flex flex-wrap gap-3 items-center">
        <Filter size={16} className="text-gray-400"/>
        <input type="month" value={mesFiltro} onChange={e => setMesFiltro(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado" />
        {isAdmin && (
          <select value={filialFiltro} onChange={e => setFilialFiltro(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
            <option value="todas">Todas as unidades</option>
            {filiais.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total do mês',  valor: totalMes,      cor: 'text-gray-700' },
          { label: 'Pago',          valor: totalPago,      cor: 'text-green-600' },
          { label: 'Pendente',      valor: totalPendente,  cor: 'text-red-600' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl shadow-md p-4 text-center">
            <p className="text-xs text-gray-500">{c.label}</p>
            <p className={`text-xl font-bold mt-1 ${c.cor}`}>{formatBRL(c.valor)}</p>
          </div>
        ))}
      </div>

      {despesas.length === 0 ? <EmptyState message="Nenhuma despesa lançada neste período." /> : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['Descrição','Unidade','Tipo','Competência','Valor','Status','Ações'].map(h =>
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                )}</tr>
              </thead>
              <tbody className="divide-y">
                {despesas.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-bendito-verde-escuro">
                      {d.descricao}
                      {d.categoria && <span className="text-xs text-gray-400 ml-1">· {d.categoria}</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{d.filiais?.nome}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                        {TIPOS.find(t => t.value === d.tipo)?.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatData(d.data_competencia)}</td>
                    <td className="px-4 py-3 font-bold text-red-600">{formatBRL(d.valor)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COR[d.status]}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {d.status === 'pendente' && (
                          <button onClick={() => marcarPago(d)} title="Marcar como pago"
                            className="p-1.5 text-gray-400 hover:text-green-600 rounded text-xs font-semibold">✓</button>
                        )}
                        <button onClick={() => abrirEdicao(d)} className="p-1.5 text-gray-400 hover:text-bendito-verde rounded"><Edit size={14}/></button>
                        <button onClick={() => excluir(d)} className="p-1.5 text-gray-400 hover:text-red-500 rounded"><Trash2 size={14}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editando ? 'Editar despesa' : 'Nova despesa'}>
        <div className="space-y-4">
          {isAdmin && (
            <Field label="Unidade">
              <select value={form.filial_id} onChange={e => setForm({...form, filial_id: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                {filiais.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Categoria (opcional)">
              <Input value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})} placeholder="Ex: Aluguel, Folha..." />
            </Field>
          </div>
          <Field label="Descrição" required>
            <Input value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} placeholder="Descreva a despesa" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor (R$)" required>
              <Input type="number" step="0.01" value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} placeholder="0,00" />
            </Field>
            <Field label="Competência">
              <Input type="date" value={form.data_competencia} onChange={e => setForm({...form, data_competencia: e.target.value})} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </Field>
            <Field label="Data pagamento">
              <Input type="date" value={form.data_pagamento} onChange={e => setForm({...form, data_pagamento: e.target.value})} />
            </Field>
          </div>
          <Field label="Observações">
            <Textarea rows={2} value={form.observacoes} onChange={e => setForm({...form, observacoes: e.target.value})} />
          </Field>
          <div className="flex gap-3">
            <SecondaryButton onClick={() => setModalOpen(false)} className="flex-1">Cancelar</SecondaryButton>
            <PrimaryButton onClick={salvar} disabled={salvando || !form.descricao || !form.valor} className="flex-1">
              {salvando ? 'Salvando...' : editando ? 'Salvar' : 'Lançar despesa'}
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
