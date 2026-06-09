'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FILIAL_ID, formatBRL } from '@/lib/constants'
import Modal from '@/components/Modal'
import {
  Field, Input, Select, Textarea, PrimaryButton, SecondaryButton,
  PageHeader, Loading, EmptyState,
} from '@/components/ui'
import {
  Plus, Edit, Trash2, Search, Beaker, ChefHat, Receipt, Settings, BarChart3,
  AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Lock,
} from 'lucide-react'

type Aba = 'insumos' | 'ficha' | 'custos_fixos' | 'parametros' | 'resultado'

const UNIDADES = ['un', 'g', 'kg', 'ml', 'l', 'porção', 'fatia', 'pacote']
const CATEGORIAS_CUSTO_FIXO = [
  'aluguel', 'salarios', 'energia', 'agua', 'internet', 'gas',
  'sistemas', 'contabilidade', 'manutencao', 'outros',
]

export default function PrecificacaoPage() {
  const [aba, setAba] = useState<Aba>('resultado')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Precificação"
        subtitle="Insumos, ficha técnica, despesas e preço sugerido"
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <div className="flex min-w-max">
          {([
            { key: 'resultado',    label: 'Resultado',     icon: BarChart3 },
            { key: 'insumos',      label: 'Insumos',       icon: Beaker },
            { key: 'ficha',        label: 'Ficha técnica', icon: ChefHat },
            { key: 'custos_fixos', label: 'Custos fixos',  icon: Receipt },
            { key: 'parametros',   label: 'Parâmetros',    icon: Settings },
          ] as { key: Aba; label: string; icon: any }[]).map(t => {
            const Icon = t.icon
            const active = aba === t.key
            return (
              <button
                key={t.key}
                onClick={() => setAba(t.key)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition whitespace-nowrap
                  ${active
                    ? 'border-bendito-dourado text-bendito-verde-escuro bg-bendito-creme/50'
                    : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}
              >
                <Icon size={16} /> {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {aba === 'resultado'    && <TabResultado />}
      {aba === 'insumos'      && <TabInsumos />}
      {aba === 'ficha'        && <TabFichaTecnica />}
      {aba === 'custos_fixos' && <TabCustosFixos />}
      {aba === 'parametros'   && <TabParametros />}
    </div>
  )
}

/* ════════ KPI Card ════════ */
function Card({ title, value, icon: Icon, tone = 'neutral' }:
  { title: string; value: string; icon: any; tone?: 'ok' | 'warn' | 'neutral' }) {
  const toneCls = tone === 'warn' ? 'text-orange-700 bg-orange-50 border-orange-200'
                : tone === 'ok'   ? 'text-green-700 bg-green-50 border-green-200'
                : 'text-bendito-verde-escuro bg-white border-gray-200'
  return (
    <div className={`rounded-xl border p-4 ${toneCls}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase font-semibold opacity-75">{title}</p>
        <Icon size={18} />
      </div>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  )
}

function FonteBadge({ fonte }: { fonte: string }) {
  const cfg: Record<string, { label: string; cls: string; icon: any }> = {
    calculado:       { label: 'Calculado',  cls: 'bg-green-100 text-green-800',   icon: CheckCircle2 },
    override_manual: { label: 'Manual',     cls: 'bg-blue-100 text-blue-800',     icon: Lock },
    sem_ficha:       { label: 'Sem ficha',  cls: 'bg-gray-100 text-gray-600',     icon: AlertTriangle },
  }
  const c = cfg[fonte] || cfg.sem_ficha
  const Icon = c.icon
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${c.cls}`}>
      <Icon size={11} /> {c.label}
    </span>
  )
}

/* ════════════════════════════ ABA RESULTADO ════════════════════════════ */
function TabResultado() {
  const supabase = createClient()
  const [linhas, setLinhas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [params, setParams] = useState<any>(null)

  async function load() {
    setLoading(true)
    const [r, p] = await Promise.all([
      supabase.from('vw_custo_produto').select('*').order('produto_nome'),
      supabase.from('parametros_precificacao').select('*').eq('filial_id', FILIAL_ID).maybeSingle(),
    ])
    setLinhas(r.data || [])
    setParams(p.data)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtradas = linhas.filter((l) =>
    !filtro || l.produto_nome?.toLowerCase().includes(filtro.toLowerCase())
  )

  const total = filtradas.length
  const semFicha = filtradas.filter(l => l.fonte_custo === 'sem_ficha').length
  const abaixoSugerido = filtradas.filter(l =>
    Number(l.preco_atual || 0) > 0 && Number(l.diferenca_atual_vs_sugerido || 0) < 0
  ).length

  if (loading) return <Loading />

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card title="Produtos analisados" value={String(total)} icon={BarChart3} />
        <Card title="Sem ficha técnica" value={String(semFicha)} icon={AlertTriangle}
              tone={semFicha > 0 ? 'warn' : 'ok'} />
        <Card title="Abaixo do sugerido" value={String(abaixoSugerido)} icon={TrendingDown}
              tone={abaixoSugerido > 0 ? 'warn' : 'ok'} />
        <Card title="Margem alvo"
              value={params ? `${Number(params.margem_padrao_pct).toFixed(0)}%` : '—'}
              icon={TrendingUp} />
      </div>

      {!params && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 flex items-start gap-2">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>
            Sem parâmetros cadastrados para esta filial. Acesse <b>Parâmetros</b> para definir
            unidades planejadas/mês, margem e despesas variáveis.
          </span>
        </div>
      )}

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={filtro} onChange={e => setFiltro(e.target.value)}
          placeholder="Buscar produto..."
          className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-bendito-dourado text-sm"
        />
      </div>

      <div className="bg-white rounded-xl shadow-md overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-gray-50">
            <tr>
              {['Produto', 'Insumos', 'Rateio', 'Custo', 'Atual', 'Sugerido', 'Diferença', 'Margem real', 'Fonte'].map(h => (
                <th key={h} className="text-left px-3 py-2.5 font-semibold text-gray-700 text-xs uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtradas.length === 0 ? (
              <tr><td colSpan={9} className="text-center text-gray-400 py-8">Nenhum produto encontrado.</td></tr>
            ) : filtradas.map(l => {
              const dif = Number(l.diferenca_atual_vs_sugerido || 0)
              const corDif = dif >= 0 ? 'text-green-600' : 'text-red-600'
              return (
                <tr key={l.produto_id} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 font-medium text-gray-900">{l.produto_nome}</td>
                  <td className="px-3 py-2.5 text-gray-700">{formatBRL(l.custo_insumos)}</td>
                  <td className="px-3 py-2.5 text-gray-700">{l.rateio_fixo != null ? formatBRL(l.rateio_fixo) : '—'}</td>
                  <td className="px-3 py-2.5 font-semibold text-gray-900">{formatBRL(l.custo_efetivo)}</td>
                  <td className="px-3 py-2.5 text-gray-700">{formatBRL(l.preco_atual)}</td>
                  <td className="px-3 py-2.5 font-semibold text-bendito-dourado-escuro">{formatBRL(l.preco_sugerido)}</td>
                  <td className={`px-3 py-2.5 font-semibold ${corDif}`}>{dif >= 0 ? '+' : ''}{formatBRL(dif)}</td>
                  <td className="px-3 py-2.5 text-gray-700">{Number(l.margem_real_pct).toFixed(1)}%</td>
                  <td className="px-3 py-2.5"><FonteBadge fonte={l.fonte_custo} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ════════════════════════════ ABA INSUMOS ════════════════════════════ */
function TabInsumos() {
  const supabase = createClient()
  const [insumos, setInsumos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [form, setForm] = useState<any>({})
  const [salvando, setSalvando] = useState(false)
  const [filtro, setFiltro] = useState('')
  const [erro, setErro] = useState('')

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('insumos').select('*').eq('ativo', true).order('nome')
    setInsumos(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function abrirNovo() {
    setEditando(null)
    setForm({ nome: '', unidade_medida: 'kg', custo_unitario: '', quantidade_estoque: 0, estoque_minimo: 0, ativo: true })
    setErro(''); setModalOpen(true)
  }
  function abrirEdicao(i: any) {
    setEditando(i); setForm({ ...i }); setErro(''); setModalOpen(true)
  }

  async function salvar() {
    setErro('')
    if (!form.nome?.trim()) { setErro('Informe o nome.'); return }
    if (!form.unidade_medida) { setErro('Informe a unidade.'); return }
    if (Number(form.custo_unitario) <= 0) { setErro('Custo unitário deve ser maior que zero.'); return }
    setSalvando(true)
    const payload = {
      nome: form.nome.trim(),
      codigo: form.codigo || null,
      unidade_medida: form.unidade_medida,
      custo_unitario: Number(form.custo_unitario),
      quantidade_estoque: Number(form.quantidade_estoque) || 0,
      estoque_minimo: Number(form.estoque_minimo) || 0,
      fornecedor: form.fornecedor || null,
      descricao: form.descricao || null,
      filial_id: FILIAL_ID,
      ativo: true,
    }
    if (editando) {
      const { error } = await supabase.from('insumos').update(payload).eq('id', editando.id).select()
      if (error) { setErro(error.message); setSalvando(false); return }
    } else {
      const { error } = await supabase.from('insumos').insert(payload).select()
      if (error) { setErro(error.message); setSalvando(false); return }
    }
    setSalvando(false); setModalOpen(false); load()
  }

  async function excluir(i: any) {
    if (!confirm(`Desativar o insumo "${i.nome}"?`)) return
    const { error, data } = await supabase.from('insumos').update({ ativo: false }).eq('id', i.id).select()
    if (error || !data?.length) { alert(error?.message || 'Nada foi alterado.'); return }
    load()
  }

  const filtrados = insumos.filter(i => !filtro || i.nome.toLowerCase().includes(filtro.toLowerCase()))

  if (loading) return <Loading />

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={filtro} onChange={e => setFiltro(e.target.value)}
            placeholder="Buscar insumo..."
            className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-bendito-dourado text-sm"
          />
        </div>
        <PrimaryButton onClick={abrirNovo} className="flex items-center gap-2 whitespace-nowrap">
          <Plus size={18} /> Novo insumo
        </PrimaryButton>
      </div>

      {filtrados.length === 0 ? <EmptyState message="Nenhum insumo cadastrado." /> : (
        <div className="bg-white rounded-xl shadow-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Nome', 'Unidade', 'Custo unitário', 'Estoque', 'Mínimo', 'Fornecedor', ''].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 font-semibold text-gray-700 text-xs uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtrados.map(i => (
                <tr key={i.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 font-medium text-gray-900">{i.nome}</td>
                  <td className="px-3 py-2.5 text-gray-700">{i.unidade_medida}</td>
                  <td className="px-3 py-2.5 font-semibold text-bendito-dourado-escuro">{formatBRL(i.custo_unitario)}</td>
                  <td className="px-3 py-2.5 text-gray-700">{i.quantidade_estoque ?? 0}</td>
                  <td className="px-3 py-2.5 text-gray-500">{i.estoque_minimo ?? 0}</td>
                  <td className="px-3 py-2.5 text-gray-500">{i.fornecedor || '—'}</td>
                  <td className="px-3 py-2.5 text-right">
                    <button onClick={() => abrirEdicao(i)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded mr-1"><Edit size={15} /></button>
                    <button onClick={() => excluir(i)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editando ? 'Editar insumo' : 'Novo insumo'}>
        <div className="space-y-3">
          <Field label="Nome" required>
            <Input value={form.nome || ''} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Farinha de trigo" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Unidade" required>
              <Select value={form.unidade_medida || 'kg'} onChange={e => setForm({ ...form, unidade_medida: e.target.value })}>
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
              </Select>
            </Field>
            <Field label="Custo unitário (R$)" required>
              <Input type="number" step="0.0001" value={form.custo_unitario || ''}
                onChange={e => setForm({ ...form, custo_unitario: e.target.value })} placeholder="0,00" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Estoque atual">
              <Input type="number" step="0.01" value={form.quantidade_estoque || 0}
                onChange={e => setForm({ ...form, quantidade_estoque: e.target.value })} />
            </Field>
            <Field label="Estoque mínimo">
              <Input type="number" step="0.01" value={form.estoque_minimo || 0}
                onChange={e => setForm({ ...form, estoque_minimo: e.target.value })} />
            </Field>
          </div>
          <Field label="Fornecedor">
            <Input value={form.fornecedor || ''} onChange={e => setForm({ ...form, fornecedor: e.target.value })} />
          </Field>
          {erro && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{erro}</p>}
          <div className="flex gap-3 pt-2">
            <SecondaryButton onClick={() => setModalOpen(false)} className="flex-1">Cancelar</SecondaryButton>
            <PrimaryButton onClick={salvar} disabled={salvando} className="flex-1">{salvando ? 'Salvando...' : 'Salvar'}</PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}

/* ════════════════════════════ ABA FICHA TÉCNICA ════════════════════════════ */
function TabFichaTecnica() {
  const supabase = createClient()
  const [produtos, setProdutos] = useState<any[]>([])
  const [insumos, setInsumos] = useState<any[]>([])
  const [fichas, setFichas] = useState<any[]>([])
  const [itens, setItens] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [produtoSel, setProdutoSel] = useState<string>('')
  const [fichaSel, setFichaSel] = useState<any>(null)
  const [insumoEsc, setInsumoEsc] = useState('')
  const [qtdEsc, setQtdEsc] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [rendimento, setRendimento] = useState(1)
  const [unidadeRend, setUnidadeRend] = useState('unidade')
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState('')

  async function load() {
    setLoading(true)
    const [p, i, f] = await Promise.all([
      supabase.from('produtos').select('id, nome, preco_varejo, custo_producao').eq('ativo', true).order('nome'),
      supabase.from('insumos').select('*').eq('ativo', true).order('nome'),
      supabase.from('fichas_tecnicas').select('id, produto_id, rendimento, unidade_rendimento, ativa, observacoes'),
    ])
    setProdutos(p.data || [])
    setInsumos(i.data || [])
    setFichas(f.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function selecionarProduto(produtoId: string) {
    setProdutoSel(produtoId); setErro('')
    if (!produtoId) { setFichaSel(null); setItens([]); return }
    const ficha = fichas.find(f => f.produto_id === produtoId)
    if (ficha) {
      setFichaSel(ficha)
      setRendimento(Number(ficha.rendimento) || 1)
      setUnidadeRend(ficha.unidade_rendimento || 'unidade')
      const { data: its } = await supabase
        .from('ficha_tecnica_itens')
        .select('id, insumo_id, quantidade, unidade, insumos(nome, custo_unitario, unidade_medida)')
        .eq('ficha_id', ficha.id)
      setItens(its || [])
    } else {
      setFichaSel(null); setItens([]); setRendimento(1); setUnidadeRend('unidade')
    }
  }

  async function criarFicha() {
    if (!produtoSel) return
    setSalvando(true); setErro('')
    const { data, error } = await supabase.from('fichas_tecnicas').insert({
      produto_id: produtoSel,
      rendimento: Number(rendimento) || 1,
      unidade_rendimento: unidadeRend,
      ativa: true,
      filial_id: FILIAL_ID,
    }).select().single()
    if (error) { setErro(error.message); setSalvando(false); return }
    setFichaSel(data); setFichas([...fichas, data])
    setSalvando(false)
  }

  async function atualizarRendimento() {
    if (!fichaSel) return
    setSalvando(true); setErro('')
    const { error } = await supabase.from('fichas_tecnicas')
      .update({ rendimento: Number(rendimento) || 1, unidade_rendimento: unidadeRend })
      .eq('id', fichaSel.id)
    if (error) { setErro(error.message); setSalvando(false); return }
    setFichas(fichas.map(f => f.id === fichaSel.id ? { ...f, rendimento, unidade_rendimento: unidadeRend } : f))
    setSalvando(false)
  }

  async function adicionarItem() {
    if (!fichaSel || !insumoEsc || !Number(qtdEsc)) { setErro('Selecione insumo e quantidade.'); return }
    const insumo = insumos.find(i => i.id === insumoEsc)
    if (!insumo) return
    setErro('')
    const { error } = await supabase.from('ficha_tecnica_itens').insert({
      ficha_id: fichaSel.id,
      insumo_id: insumo.id,
      quantidade: Number(qtdEsc),
      unidade: insumo.unidade_medida,
      custo_unitario: insumo.custo_unitario,
    }).select()
    if (error) { setErro(error.message); return }
    setInsumoEsc(''); setQtdEsc('')
    selecionarProduto(produtoSel)
  }

  async function removerItem(itemId: string) {
    if (!confirm('Remover este insumo da ficha?')) return
    const { error } = await supabase.from('ficha_tecnica_itens').delete().eq('id', itemId)
    if (error) { setErro(error.message); return }
    selecionarProduto(produtoSel)
  }

  const custoReceita = useMemo(
    () => itens.reduce((s, it) => s + Number(it.quantidade) * Number(it.insumos?.custo_unitario || 0), 0),
    [itens]
  )
  const custoPorUnidade = rendimento > 0 ? custoReceita / rendimento : 0

  const produtosFiltrados = produtos.filter(p =>
    !filtro || p.nome.toLowerCase().includes(filtro.toLowerCase())
  )

  if (loading) return <Loading />

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="bg-white rounded-xl shadow-md p-3 lg:col-span-1">
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={filtro} onChange={e => setFiltro(e.target.value)}
            placeholder="Buscar produto..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-bendito-dourado text-sm"
          />
        </div>
        <div className="max-h-[60vh] overflow-y-auto space-y-1">
          {produtosFiltrados.map(p => {
            const ficha = fichas.find(f => f.produto_id === p.id)
            const isSel = produtoSel === p.id
            return (
              <button key={p.id} onClick={() => selecionarProduto(p.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between
                  ${isSel ? 'bg-bendito-dourado text-bendito-verde-escuro font-semibold'
                          : 'hover:bg-gray-100 text-gray-800'}`}>
                <span className="truncate">{p.nome}</span>
                {ficha
                  ? <span className="text-[10px] bg-green-200 text-green-900 px-1.5 py-0.5 rounded">✓ ficha</span>
                  : <span className="text-[10px] bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded">sem</span>
                }
              </button>
            )
          })}
          {produtosFiltrados.length === 0 && <p className="text-center text-gray-400 py-4 text-sm">Sem produtos.</p>}
        </div>
      </div>

      <div className="lg:col-span-2 space-y-4">
        {!produtoSel ? (
          <div className="bg-white rounded-xl shadow-md p-8 text-center text-gray-400">
            ← Selecione um produto para criar ou editar a ficha técnica.
          </div>
        ) : !fichaSel ? (
          <div className="bg-white rounded-xl shadow-md p-6 space-y-4">
            <p className="text-sm text-gray-700">
              Este produto ainda não tem ficha técnica. Defina o rendimento da receita e crie:
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Rendimento da receita" required>
                <Input type="number" step="0.01" min={0.01} value={rendimento}
                  onChange={e => setRendimento(Number(e.target.value))} />
              </Field>
              <Field label="Unidade do rendimento">
                <Select value={unidadeRend} onChange={e => setUnidadeRend(e.target.value)}>
                  {['unidade', 'porção', 'fatia', 'kg', 'l', 'pacote'].map(u => <option key={u} value={u}>{u}</option>)}
                </Select>
              </Field>
            </div>
            <p className="text-xs text-gray-500">
              Exemplo: se a receita produz 10 pizzas, o rendimento é 10. O custo total dos insumos será dividido por 10 para calcular o custo por unidade.
            </p>
            {erro && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{erro}</p>}
            <PrimaryButton onClick={criarFicha} disabled={salvando}>{salvando ? 'Criando...' : 'Criar ficha técnica'}</PrimaryButton>
          </div>
        ) : (
          <>
            <div className="bg-gradient-to-br from-bendito-verde-escuro to-bendito-verde rounded-xl shadow-md p-5 text-white">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs uppercase opacity-75">Custo da receita</p>
                  <p className="text-2xl font-bold">{formatBRL(custoReceita)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase opacity-75">Rendimento</p>
                  <p className="text-2xl font-bold">{rendimento} <span className="text-sm opacity-75">{unidadeRend}</span></p>
                </div>
                <div>
                  <p className="text-xs uppercase opacity-75">Custo / unidade</p>
                  <p className="text-2xl font-bold text-bendito-dourado">{formatBRL(custoPorUnidade)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">Rendimento da receita</p>
              <div className="flex gap-2 items-end">
                <div className="w-32">
                  <Input type="number" step="0.01" min={0.01} value={rendimento}
                    onChange={e => setRendimento(Number(e.target.value))} />
                </div>
                <div className="w-36">
                  <Select value={unidadeRend} onChange={e => setUnidadeRend(e.target.value)}>
                    {['unidade', 'porção', 'fatia', 'kg', 'l', 'pacote'].map(u => <option key={u} value={u}>{u}</option>)}
                  </Select>
                </div>
                <SecondaryButton onClick={atualizarRendimento} disabled={salvando}>Atualizar</SecondaryButton>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">Insumos da receita</p>
              <div className="flex gap-2 items-end mb-3">
                <div className="flex-1">
                  <Select value={insumoEsc} onChange={e => setInsumoEsc(e.target.value)}>
                    <option value="">Selecione um insumo...</option>
                    {insumos.filter(i => !itens.some(it => it.insumo_id === i.id)).map(i => (
                      <option key={i.id} value={i.id}>{i.nome} ({i.unidade_medida}) — {formatBRL(i.custo_unitario)}/{i.unidade_medida}</option>
                    ))}
                  </Select>
                </div>
                <div className="w-24">
                  <Input type="number" step="0.001" value={qtdEsc}
                    onChange={e => setQtdEsc(e.target.value)} placeholder="qtd" />
                </div>
                <SecondaryButton onClick={adicionarItem} disabled={!insumoEsc || !Number(qtdEsc)}>Add</SecondaryButton>
              </div>
              {itens.length === 0 ? (
                <p className="text-xs text-gray-400 py-3">Nenhum insumo adicionado.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Insumo', 'Quantidade', 'Custo unit.', 'Subtotal', ''].map(h => (
                        <th key={h} className="text-left px-2 py-2 text-xs uppercase font-semibold text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {itens.map(it => {
                      const sub = Number(it.quantidade) * Number(it.insumos?.custo_unitario || 0)
                      return (
                        <tr key={it.id}>
                          <td className="px-2 py-2 text-gray-900">{it.insumos?.nome}</td>
                          <td className="px-2 py-2 text-gray-700">{Number(it.quantidade)} {it.unidade}</td>
                          <td className="px-2 py-2 text-gray-700">{formatBRL(it.insumos?.custo_unitario)}</td>
                          <td className="px-2 py-2 font-semibold text-bendito-dourado-escuro">{formatBRL(sub)}</td>
                          <td className="px-2 py-2 text-right">
                            <button onClick={() => removerItem(it.id)} className="p-1 text-red-600 hover:bg-red-50 rounded">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
            {erro && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{erro}</p>}
          </>
        )}
      </div>
    </div>
  )
}

/* ════════════════════════════ ABA CUSTOS FIXOS ════════════════════════════ */
function TabCustosFixos() {
  const supabase = createClient()
  const [custos, setCustos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [form, setForm] = useState<any>({})
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('custos_fixos').select('*')
      .eq('filial_id', FILIAL_ID).order('categoria').order('nome')
    setCustos(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function abrirNovo() {
    setEditando(null)
    setForm({ nome: '', valor: '', categoria: 'aluguel', ativo: true })
    setErro(''); setModalOpen(true)
  }
  function abrirEdicao(c: any) {
    setEditando(c); setForm({ ...c }); setErro(''); setModalOpen(true)
  }

  async function salvar() {
    setErro('')
    if (!form.nome?.trim()) { setErro('Informe o nome.'); return }
    if (!form.categoria) { setErro('Selecione a categoria.'); return }
    if (Number(form.valor) <= 0) { setErro('Valor deve ser maior que zero.'); return }
    setSalvando(true)
    const payload = {
      filial_id: FILIAL_ID,
      nome: form.nome.trim(),
      valor: Number(form.valor),
      categoria: form.categoria,
      ativo: form.ativo ?? true,
    }
    if (editando) {
      const { error } = await supabase.from('custos_fixos').update(payload).eq('id', editando.id).select()
      if (error) { setErro(error.message); setSalvando(false); return }
    } else {
      const { error } = await supabase.from('custos_fixos').insert(payload).select()
      if (error) { setErro(error.message); setSalvando(false); return }
    }
    setSalvando(false); setModalOpen(false); load()
  }

  async function toggleAtivo(c: any) {
    const { error } = await supabase.from('custos_fixos').update({ ativo: !c.ativo }).eq('id', c.id).select()
    if (error) { alert(error.message); return }
    load()
  }

  async function excluir(c: any) {
    if (!confirm(`Excluir "${c.nome}"?`)) return
    const { error, data } = await supabase.from('custos_fixos').delete().eq('id', c.id).select()
    if (error || !data?.length) { alert(error?.message || 'Nada foi excluído.'); return }
    load()
  }

  const total = custos.filter(c => c.ativo).reduce((s, c) => s + Number(c.valor), 0)

  if (loading) return <Loading />

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card title="Total ativo / mês" value={formatBRL(total)} icon={Receipt} tone="neutral" />
        <Card title="Itens ativos" value={String(custos.filter(c => c.ativo).length)} icon={CheckCircle2} tone="ok" />
        <Card title="Itens inativos" value={String(custos.filter(c => !c.ativo).length)} icon={AlertTriangle} tone="neutral" />
      </div>

      <div className="flex justify-end">
        <PrimaryButton onClick={abrirNovo} className="flex items-center gap-2">
          <Plus size={18} /> Nova despesa fixa
        </PrimaryButton>
      </div>

      {custos.length === 0 ? <EmptyState message="Nenhuma despesa fixa cadastrada." /> : (
        <div className="bg-white rounded-xl shadow-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Categoria', 'Nome', 'Valor mensal', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 font-semibold text-gray-700 text-xs uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {custos.map(c => (
                <tr key={c.id} className={c.ativo ? '' : 'opacity-50'}>
                  <td className="px-3 py-2.5">
                    <span className="text-xs bg-bendito-creme text-bendito-verde-escuro px-2 py-0.5 rounded font-semibold uppercase">
                      {c.categoria}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-medium text-gray-900">{c.nome}</td>
                  <td className="px-3 py-2.5 font-semibold text-bendito-dourado-escuro">{formatBRL(c.valor)}</td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => toggleAtivo(c)}
                      className={`text-xs px-2 py-1 rounded-full font-semibold
                        ${c.ativo ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                      {c.ativo ? 'ativo' : 'inativo'}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button onClick={() => abrirEdicao(c)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded mr-1"><Edit size={15} /></button>
                    <button onClick={() => excluir(c)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editando ? 'Editar despesa fixa' : 'Nova despesa fixa'}>
        <div className="space-y-3">
          <Field label="Categoria" required>
            <Select value={form.categoria || 'aluguel'} onChange={e => setForm({ ...form, categoria: e.target.value })}>
              {CATEGORIAS_CUSTO_FIXO.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Nome" required>
            <Input value={form.nome || ''} onChange={e => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex: Aluguel Matriz, Energia Filial 01" />
          </Field>
          <Field label="Valor mensal (R$)" required>
            <Input type="number" step="0.01" value={form.valor || ''}
              onChange={e => setForm({ ...form, valor: e.target.value })} placeholder="0,00" />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.ativo ?? true} onChange={e => setForm({ ...form, ativo: e.target.checked })} />
            Ativo (entra no rateio do mês)
          </label>
          {erro && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{erro}</p>}
          <div className="flex gap-3 pt-2">
            <SecondaryButton onClick={() => setModalOpen(false)} className="flex-1">Cancelar</SecondaryButton>
            <PrimaryButton onClick={salvar} disabled={salvando} className="flex-1">{salvando ? 'Salvando...' : 'Salvar'}</PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}

/* ════════════════════════════ ABA PARÂMETROS ════════════════════════════ */
function TabParametros() {
  const supabase = createClient()
  const [params, setParams] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [feedback, setFeedback] = useState('')

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('parametros_precificacao').select('*')
      .eq('filial_id', FILIAL_ID).maybeSingle()
    setParams(data || {
      unidades_planejadas_mes: 1000,
      margem_padrao_pct: 50,
      despesas_variaveis_pct: 0,
    })
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function salvar() {
    setErro(''); setFeedback('')
    if (Number(params.unidades_planejadas_mes) <= 0) { setErro('Unidades planejadas deve ser maior que zero.'); return }
    if (Number(params.margem_padrao_pct) < 0) { setErro('Margem não pode ser negativa.'); return }
    if (Number(params.despesas_variaveis_pct) < 0 || Number(params.despesas_variaveis_pct) >= 100) {
      setErro('Despesas variáveis devem estar entre 0 e 99.99%.'); return
    }
    setSalvando(true)
    const payload = {
      filial_id: FILIAL_ID,
      unidades_planejadas_mes: Number(params.unidades_planejadas_mes),
      margem_padrao_pct: Number(params.margem_padrao_pct),
      despesas_variaveis_pct: Number(params.despesas_variaveis_pct),
      observacoes: params.observacoes || null,
    }
    const { error } = await supabase
      .from('parametros_precificacao')
      .upsert(payload, { onConflict: 'filial_id' })
      .select()
    if (error) { setErro(error.message); setSalvando(false); return }
    setFeedback('Parâmetros salvos.'); setSalvando(false)
    setTimeout(() => setFeedback(''), 3000)
  }

  if (loading) return <Loading />

  return (
    <div className="max-w-2xl space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900">
        <p className="font-semibold mb-1">💡 Como funcionam os parâmetros</p>
        <ul className="list-disc ml-5 space-y-0.5">
          <li><b>Unidades planejadas</b>: base do rateio das despesas fixas (ex: 3000 unidades/mês).</li>
          <li><b>Despesas variáveis %</b>: cartão, embalagem, comissão — sobre o preço de venda.</li>
          <li><b>Margem padrão %</b>: lucro alvo, sobre o custo.</li>
          <li>Fórmula: <code className="text-xs bg-white px-1 rounded">preço = custo × (1 + var% + margem%)</code></li>
        </ul>
      </div>

      <div className="bg-white rounded-xl shadow-md p-5 space-y-4">
        <Field label="Unidades planejadas / mês" required>
          <Input type="number" min={1} value={params.unidades_planejadas_mes ?? ''}
            onChange={e => setParams({ ...params, unidades_planejadas_mes: e.target.value })} />
          <p className="text-xs text-gray-500 mt-1">Quantas unidades de todos os produtos juntos você espera vender por mês.</p>
        </Field>
        <Field label="Despesas variáveis (% sobre venda)" required>
          <Input type="number" step="0.1" min={0} max={99.99} value={params.despesas_variaveis_pct ?? ''}
            onChange={e => setParams({ ...params, despesas_variaveis_pct: e.target.value })} />
          <p className="text-xs text-gray-500 mt-1">Cartão (3-5%) + embalagem (2-4%) + outras taxas. Média típica: 10-15%.</p>
        </Field>
        <Field label="Margem padrão (%)" required>
          <Input type="number" step="0.1" min={0} value={params.margem_padrao_pct ?? ''}
            onChange={e => setParams({ ...params, margem_padrao_pct: e.target.value })} />
          <p className="text-xs text-gray-500 mt-1">Lucro alvo aplicado sobre o custo. Restaurantes geralmente trabalham entre 30% e 70%.</p>
        </Field>
        <Field label="Observações">
          <Textarea rows={2} value={params.observacoes || ''}
            onChange={e => setParams({ ...params, observacoes: e.target.value })} />
        </Field>

        {erro && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{erro}</p>}
        {feedback && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-2">{feedback}</p>}

        <PrimaryButton onClick={salvar} disabled={salvando} className="flex items-center gap-2">
          {salvando ? 'Salvando...' : 'Salvar parâmetros'}
        </PrimaryButton>
      </div>
    </div>
  )
}
