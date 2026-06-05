'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatBRL } from '@/lib/constants'
import { PageHeader, Loading, EmptyState, Field, Input, PrimaryButton, SecondaryButton } from '@/components/ui'
import Modal from '@/components/Modal'
import {
  Plus, Edit, Trash2, RefreshCw, Filter, AlertTriangle,
  CheckCircle, Package, Clock, Building2, Search, X,
} from 'lucide-react'

const NIVEL_COR: Record<string, string> = {
  vencido: 'bg-red-100 text-red-700 border-red-200',
  critico: 'bg-orange-100 text-orange-700 border-orange-200',
  atencao: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  ok:      'bg-green-100 text-green-700 border-green-200',
}
const NIVEL_LABEL: Record<string, string> = {
  vencido: '🔴 Vencido',
  critico: '🟠 Crítico',
  atencao: '🟡 Atenção',
  ok:      '🟢 OK',
}

export default function LotesPage() {
  const supabase = createClient()
  const [loading, setLoading]     = useState(true)
  const [lotes, setLotes]         = useState<any[]>([])
  const [alertas, setAlertas]     = useState<any[]>([])
  const [produtos, setProdutos]   = useState<any[]>([])
  const [fornecedores, setFornecedores] = useState<any[]>([])
  const [filiais, setFiliais]     = useState<any[]>([])
  const [isAdmin, setIsAdmin]     = useState(false)
  const [filialSel, setFilialSel] = useState('todas')
  const [filtroNivel, setFiltroNivel] = useState('todos')
  const [busca, setBusca]         = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMov, setModalMov]   = useState(false)
  const [editando, setEditando]   = useState<any>(null)
  const [loteMov, setLoteMov]     = useState<any>(null)
  const [salvando, setSalvando]   = useState(false)
  const [form, setForm] = useState<any>({
    filial_id: '', produto_id: '', numero_lote: '',
    data_fabricacao: '', data_validade: '',
    quantidade_entrada: '', custo_unitario: '',
    fornecedor_id: '', nota_fiscal: '', observacoes: '',
  })
  const [formMov, setFormMov] = useState({
    tipo: 'descarte', quantidade: '', motivo: '',
  })

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile }  = await supabase.from('profiles').select('papel, filial_id').eq('id', user!.id).maybeSingle()
    const admin = ['admin','matriz'].includes(profile?.papel || '')
    setIsAdmin(admin)
    if (!admin && filialSel === 'todas') setFilialSel(profile?.filial_id || '')

    let qLotes = supabase.from('lotes')
      .select('*, produtos(nome, unidade_medida, imagem_url), filiais(nome), fornecedores(nome)')
      .order('data_validade')
    if (filialSel !== 'todas') qLotes = qLotes.eq('filial_id', filialSel)

    let qAlertas = supabase.from('vw_alertas_validade').select('*').neq('nivel_alerta', 'ok')
    if (filialSel !== 'todas') qAlertas = qAlertas.eq('filial_id', filialSel)

    const [lotesRes, alertasRes, prodsRes, fornsRes, filsRes] = await Promise.all([
      qLotes,
      qAlertas,
      supabase.from('produtos').select('id, nome, unidade_medida').eq('ativo', true).order('nome'),
      supabase.from('fornecedores').select('id, nome').eq('ativo', true).order('nome'),
      supabase.from('filiais').select('id, nome').eq('ativo', true),
    ])

    setLotes(lotesRes.data || [])
    setAlertas(alertasRes.data || [])
    setProdutos(prodsRes.data || [])
    setFornecedores(fornsRes.data || [])
    setFiliais(filsRes.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [filialSel])

  function abrirNovo() {
    setEditando(null)
    setForm({
      filial_id: filialSel === 'todas' ? (filiais[0]?.id || '') : filialSel,
      produto_id: '', numero_lote: new Date().getTime().toString().slice(-6),
      data_fabricacao: '', data_validade: '',
      quantidade_entrada: '', custo_unitario: '',
      fornecedor_id: '', nota_fiscal: '', observacoes: '',
    })
    setModalOpen(true)
  }

  function abrirEdicao(l: any) {
    setEditando(l)
    setForm({
      filial_id:        l.filial_id,
      produto_id:       l.produto_id,
      numero_lote:      l.numero_lote,
      data_fabricacao:  l.data_fabricacao || '',
      data_validade:    l.data_validade,
      quantidade_entrada: String(l.quantidade_entrada),
      custo_unitario:   l.custo_unitario ? String(l.custo_unitario) : '',
      fornecedor_id:    l.fornecedor_id || '',
      nota_fiscal:      l.nota_fiscal || '',
      observacoes:      l.observacoes || '',
    })
    setModalOpen(true)
  }

  async function salvar() {
    if (!form.produto_id || !form.numero_lote || !form.data_validade) return
    setSalvando(true)
    const payload = {
      ...form,
      quantidade_entrada: Number(form.quantidade_entrada) || 0,
      quantidade_atual:   editando ? editando.quantidade_atual : Number(form.quantidade_entrada) || 0,
      custo_unitario:     form.custo_unitario ? Number(form.custo_unitario) : null,
      fornecedor_id:      form.fornecedor_id || null,
      data_fabricacao:    form.data_fabricacao || null,
      updated_at:         new Date().toISOString(),
    }
    if (editando) {
      await supabase.from('lotes').update(payload).eq('id', editando.id)
    } else {
      const { data: novo } = await supabase.from('lotes').insert(payload).select('id').single()
      if (novo) {
        await supabase.from('lote_movimentacoes').insert({
          lote_id: novo.id, filial_id: form.filial_id,
          tipo: 'entrada', quantidade: Number(form.quantidade_entrada) || 0,
          motivo: 'Entrada de lote',
        })
      }
    }
    setSalvando(false); setModalOpen(false); load()
  }

  async function salvarMovimentacao() {
    if (!loteMov || !formMov.quantidade || !formMov.motivo) return
    setSalvando(true)
    const qtd = Number(formMov.quantidade)
    const novaQtd = formMov.tipo === 'descarte' || formMov.tipo === 'saida'
      ? Math.max(0, loteMov.quantidade_atual - qtd)
      : loteMov.quantidade_atual + qtd

    await supabase.from('lote_movimentacoes').insert({
      lote_id: loteMov.id, filial_id: loteMov.filial_id,
      tipo: formMov.tipo, quantidade: qtd, motivo: formMov.motivo,
    })
    await supabase.from('lotes').update({
      quantidade_atual: novaQtd,
      status: novaQtd <= 0 ? (formMov.tipo === 'descarte' ? 'descartado' : 'esgotado') : 'ativo',
      updated_at: new Date().toISOString(),
    }).eq('id', loteMov.id)

    setSalvando(false); setModalMov(false)
    setFormMov({ tipo: 'descarte', quantidade: '', motivo: '' })
    load()
  }

  async function marcarVencido(id: string) {
    await supabase.from('lotes').update({ status: 'vencido', updated_at: new Date().toISOString() }).eq('id', id)
    load()
  }

  const lotesFiltrados = lotes.filter(l => {
    const matchBusca = !busca ||
      l.produtos?.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      l.numero_lote?.toLowerCase().includes(busca.toLowerCase())
    const dias = Math.floor((new Date(l.data_validade).getTime() - Date.now()) / 86400000)
    const nivel = dias < 0 ? 'vencido' : dias <= 7 ? 'critico' : dias <= 30 ? 'atencao' : 'ok'
    const matchNivel = filtroNivel === 'todos' || nivel === filtroNivel
    return matchBusca && matchNivel
  })

  const vencidos = alertas.filter(a => a.nivel_alerta === 'vencido').length
  const criticos = alertas.filter(a => a.nivel_alerta === 'critico').length
  const atencao  = alertas.filter(a => a.nivel_alerta === 'atencao').length

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <PageHeader title="Controle de Lotes e Validades"
        subtitle="Gerencie lotes, validades e aplique a regra FEFO"
        action={
          <PrimaryButton onClick={abrirNovo} className="flex items-center gap-2">
            <Plus size={16}/> Novo lote
          </PrimaryButton>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total de lotes',  valor: lotes.length,  cor: 'text-gray-700',   bg: 'bg-white' },
          { label: '🔴 Vencidos',     valor: vencidos,       cor: 'text-red-600',    bg: 'bg-red-50' },
          { label: '🟠 Críticos (≤7d)', valor: criticos,    cor: 'text-orange-600', bg: 'bg-orange-50' },
          { label: '🟡 Atenção (≤30d)', valor: atencao,     cor: 'text-yellow-600', bg: 'bg-yellow-50' },
        ].map(c => (
          <div key={c.label} className={`${c.bg} rounded-xl shadow-md p-4 text-center border border-gray-100`}>
            <p className="text-xs text-gray-500">{c.label}</p>
            <p className={`text-2xl font-bold mt-1 ${c.cor}`}>{c.valor}</p>
          </div>
        ))}
      </div>

      {/* Alertas urgentes */}
      {(vencidos > 0 || criticos > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="font-bold text-red-700 flex items-center gap-2 mb-3">
            <AlertTriangle size={18}/> Requer ação imediata
          </p>
          <div className="space-y-2">
            {alertas.filter(a => ['vencido','critico'].includes(a.nivel_alerta)).map(a => (
              <div key={a.id} className="flex items-center justify-between bg-white rounded-lg p-3 text-sm border border-red-100">
                <div>
                  <p className="font-semibold text-gray-800">{a.produto_nome}</p>
                  <p className="text-xs text-gray-500">
                    Lote {a.numero_lote} · {a.filial_nome} · {a.quantidade_atual} un
                  </p>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${NIVEL_COR[a.nivel_alerta]}`}>
                    {a.nivel_alerta === 'vencido'
                      ? `Venceu há ${Math.abs(a.dias_para_vencer)} dia(s)`
                      : `Vence em ${a.dias_para_vencer} dia(s)`
                    }
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-md p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar produto ou lote..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-bendito-dourado"/>
          {busca && <button onClick={() => setBusca('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X size={13} className="text-gray-400"/></button>}
        </div>
        <select value={filtroNivel} onChange={e => setFiltroNivel(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
          <option value="todos">Todos os níveis</option>
          <option value="vencido">🔴 Vencidos</option>
          <option value="critico">🟠 Críticos</option>
          <option value="atencao">🟡 Atenção</option>
          <option value="ok">🟢 OK</option>
        </select>
        {isAdmin && (
          <select value={filialSel} onChange={e => setFilialSel(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
            <option value="todas">Todas as unidades</option>
            {filiais.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        )}
        <button onClick={load} className="ml-auto text-gray-400 hover:text-bendito-verde"><RefreshCw size={15}/></button>
      </div>

      {/* Lista de lotes */}
      {lotesFiltrados.length === 0 ? (
        <EmptyState message="Nenhum lote encontrado."/>
      ) : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['Produto','Lote','Unidade','Fabricação','Validade','Qtd Atual','Status','Fornecedor','Ações'].map(h =>
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                )}</tr>
              </thead>
              <tbody className="divide-y">
                {lotesFiltrados.map(l => {
                  const dias  = Math.floor((new Date(l.data_validade).getTime() - Date.now()) / 86400000)
                  const nivel = dias < 0 ? 'vencido' : dias <= 7 ? 'critico' : dias <= 30 ? 'atencao' : 'ok'
                  return (
                    <tr key={l.id} className={`hover:bg-gray-50 ${nivel === 'vencido' ? 'bg-red-50/20' : nivel === 'critico' ? 'bg-orange-50/20' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {l.produtos?.imagem_url && (
                            <img src={l.produtos.imagem_url} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0"/>
                          )}
                          <span className="font-semibold text-bendito-verde-escuro">{l.produtos?.nome}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-semibold">{l.numero_lote}</td>
                      <td className="px-4 py-3 text-gray-500">{l.filiais?.nome}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {l.data_fabricacao ? new Date(l.data_fabricacao + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className={`font-semibold ${nivel === 'vencido' ? 'text-red-600' : nivel === 'critico' ? 'text-orange-600' : 'text-gray-700'}`}>
                            {new Date(l.data_validade + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </p>
                          <p className="text-xs text-gray-400">
                            {dias < 0 ? `Venceu há ${Math.abs(dias)} dia(s)` : `${dias} dia(s)`}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-bold text-center">
                        {l.quantidade_atual}
                        <span className="text-xs text-gray-400 font-normal ml-1">{l.produtos?.unidade_medida || 'un'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${NIVEL_COR[nivel]}`}>
                          {NIVEL_LABEL[nivel]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{l.fornecedores?.nome || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => abrirEdicao(l)}
                            className="p-1.5 text-gray-400 hover:text-bendito-verde rounded" title="Editar">
                            <Edit size={13}/>
                          </button>
                          <button onClick={() => { setLoteMov(l); setModalMov(true) }}
                            className="p-1.5 text-gray-400 hover:text-orange-500 rounded" title="Registrar movimentação">
                            <Package size={13}/>
                          </button>
                          {nivel !== 'vencido' && l.status === 'ativo' && dias < 0 && (
                            <button onClick={() => marcarVencido(l.id)}
                              className="p-1.5 text-red-400 hover:text-red-600 rounded" title="Marcar como vencido">
                              <AlertTriangle size={13}/>
                            </button>
                          )}
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

      {/* Modal novo/editar lote */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}
        title={editando ? `Editar Lote — ${editando.numero_lote}` : 'Novo Lote'}>
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {isAdmin && (
            <Field label="Unidade">
              <select value={form.filial_id} onChange={e => setForm({...form, filial_id: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                {filiais.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </Field>
          )}
          <Field label="Produto" required>
            <select value={form.produto_id} onChange={e => setForm({...form, produto_id: e.target.value})}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
              <option value="">Selecione o produto...</option>
              {produtos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Número do lote" required>
              <Input value={form.numero_lote} onChange={e => setForm({...form, numero_lote: e.target.value})}
                placeholder="Ex: LOT-2024-001"/>
            </Field>
            <Field label="Nota fiscal">
              <Input value={form.nota_fiscal} onChange={e => setForm({...form, nota_fiscal: e.target.value})}
                placeholder="Número da NF"/>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data de fabricação">
              <Input type="date" value={form.data_fabricacao} onChange={e => setForm({...form, data_fabricacao: e.target.value})}/>
            </Field>
            <Field label="Data de validade" required>
              <Input type="date" value={form.data_validade} onChange={e => setForm({...form, data_validade: e.target.value})}/>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantidade de entrada" required>
              <Input type="number" step="0.01" min="0" value={form.quantidade_entrada}
                onChange={e => setForm({...form, quantidade_entrada: e.target.value})} placeholder="0"/>
            </Field>
            <Field label="Custo unitário (R$)">
              <Input type="number" step="0.01" min="0" value={form.custo_unitario}
                onChange={e => setForm({...form, custo_unitario: e.target.value})} placeholder="0,00"/>
            </Field>
          </div>
          <Field label="Fornecedor">
            <select value={form.fornecedor_id} onChange={e => setForm({...form, fornecedor_id: e.target.value})}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
              <option value="">Sem fornecedor</option>
              {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </Field>
          <Field label="Observações">
            <textarea rows={2} value={form.observacoes} onChange={e => setForm({...form, observacoes: e.target.value})}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado resize-none"/>
          </Field>
          <div className="flex gap-3">
            <SecondaryButton onClick={() => setModalOpen(false)} className="flex-1">Cancelar</SecondaryButton>
            <PrimaryButton onClick={salvar} disabled={salvando || !form.produto_id || !form.data_validade} className="flex-1">
              {salvando ? 'Salvando...' : editando ? 'Salvar' : 'Registrar lote'}
            </PrimaryButton>
          </div>
        </div>
      </Modal>

      {/* Modal movimentação (descarte/ajuste/saída) */}
      <Modal isOpen={modalMov} onClose={() => setModalMov(false)} title="Registrar Movimentação">
        {loteMov && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-3 text-sm">
              <p className="font-semibold text-gray-800">{loteMov.produtos?.nome}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Lote {loteMov.numero_lote} · Qtd atual: <strong>{loteMov.quantidade_atual} {loteMov.produtos?.unidade_medida || 'un'}</strong>
              </p>
            </div>
            <Field label="Tipo de movimentação">
              <select value={formMov.tipo} onChange={e => setFormMov({...formMov, tipo: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                <option value="saida">📤 Saída (consumo)</option>
                <option value="descarte">🗑️ Descarte (perda/vencimento)</option>
                <option value="ajuste">⚖️ Ajuste de inventário</option>
                <option value="transferencia">🔄 Transferência</option>
              </select>
            </Field>
            <Field label="Quantidade">
              <Input type="number" step="0.01" min="0.01"
                max={formMov.tipo !== 'ajuste' ? String(loteMov.quantidade_atual) : undefined}
                value={formMov.quantidade} onChange={e => setFormMov({...formMov, quantidade: e.target.value})}
                placeholder="0"/>
            </Field>
            <Field label="Motivo / Observação">
              <Input value={formMov.motivo} onChange={e => setFormMov({...formMov, motivo: e.target.value})}
                placeholder="Ex: Produto vencido, consumo na produção..."/>
            </Field>
            {formMov.tipo === 'descarte' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-600">
                ⚠️ O descarte reduzirá o estoque e será registrado no histórico de movimentações.
              </div>
            )}
            <div className="flex gap-3">
              <SecondaryButton onClick={() => setModalMov(false)} className="flex-1">Cancelar</SecondaryButton>
              <PrimaryButton onClick={salvarMovimentacao}
                disabled={salvando || !formMov.quantidade || !formMov.motivo} className="flex-1">
                {salvando ? 'Salvando...' : 'Confirmar'}
              </PrimaryButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
