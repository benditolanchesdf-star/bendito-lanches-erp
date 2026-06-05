'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader, Loading, EmptyState, Field, Input, PrimaryButton, SecondaryButton } from '@/components/ui'
import Modal from '@/components/Modal'
import { FileText, Edit, CheckCircle, XCircle, RefreshCw, AlertTriangle, Search } from 'lucide-react'

// Tabelas de referência NCM mais comuns para lanches
const NCM_SUGESTOES = [
  { ncm: '21069090', desc: 'Preparações alimentícias diversas' },
  { ncm: '19059090', desc: 'Outros produtos de padaria/pastelaria' },
  { ncm: '16010010', desc: 'Salsichas, linguiças e similares' },
  { ncm: '04069000', desc: 'Queijos diversos' },
  { ncm: '02012000', desc: 'Carnes bovinas' },
  { ncm: '21012000', desc: 'Extratos de chá ou mate' },
  { ncm: '22021000', desc: 'Águas, refrigerantes' },
  { ncm: '19021900', desc: 'Massas alimentícias' },
]

const ORIGENS = [
  { value: '0', label: '0 — Nacional' },
  { value: '1', label: '1 — Estrangeira (importação direta)' },
  { value: '2', label: '2 — Estrangeira (adquirida no mercado interno)' },
  { value: '3', label: '3 — Nacional com + 40% de conteúdo importado' },
  { value: '4', label: '4 — Nacional com processo produtivo básico' },
  { value: '5', label: '5 — Nacional com até 40% de conteúdo importado' },
]

const CSOSN_OPCOES = [
  { value: '102', label: '102 — Tributada sem permissão de crédito' },
  { value: '103', label: '103 — Isenção do ICMS — faixa de receita bruta' },
  { value: '300', label: '300 — Imune' },
  { value: '400', label: '400 — Não tributada pelo Simples Nacional' },
  { value: '500', label: '500 — ICMS cobrado anteriormente (ST ou monofásico)' },
  { value: '900', label: '900 — Outros' },
]

const CST_ICMS_OPCOES = [
  { value: '000', label: '000 — Tributada integralmente' },
  { value: '010', label: '010 — Tributada e com cobrança de ICMS por ST' },
  { value: '020', label: '020 — Com redução de BC' },
  { value: '040', label: '040 — Isenta' },
  { value: '041', label: '041 — Não tributada' },
  { value: '050', label: '050 — Suspensão' },
  { value: '060', label: '060 — ICMS cobrado anteriormente por ST' },
  { value: '070', label: '070 — Com redução de BC e cobrança de ICMS por ST' },
  { value: '090', label: '090 — Outras' },
]

const UNIDADES_FISCAIS = ['UN', 'KG', 'G', 'L', 'ML', 'PCT', 'CX', 'DZ', 'PAR', 'M', 'M2', 'M3']

export default function ProdutosFiscalPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [produtos, setProdutos] = useState<any[]>([])
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [modalOpen, setModalOpen] = useState(false)
  const [produtoSel, setProdutoSel] = useState<any>(null)
  const [salvando, setSalvando] = useState(false)
  const [regimeTrib, setRegimeTrib] = useState('simples')
  const [form, setForm] = useState<any>({
    codigo_barras: '', ncm: '', cfop: '5102',
    cst_icms: '', csosn: '400', cest: '',
    origem: '0', aliquota_icms: 0,
    aliquota_pis: 0.65, aliquota_cofins: 3,
    cst_pis: '07', cst_cofins: '07',
    descricao_fiscal: '', unidade_fiscal: 'UN',
    peso_liquido_kg: '', peso_bruto_kg: '',
  })

  async function load() {
    setLoading(true)
    const [{ data: prods }, { data: cfg }] = await Promise.all([
      supabase.from('produtos').select('*').eq('ativo', true).order('nome'),
      supabase.from('config_fiscal').select('regime_tributario').limit(1).maybeSingle(),
    ])
    setProdutos(prods || [])
    if (cfg?.regime_tributario) setRegimeTrib(cfg.regime_tributario)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function abrirEdicao(p: any) {
    setProdutoSel(p)
    setForm({
      codigo_barras:   p.codigo_barras   || '',
      ncm:             p.ncm             || '',
      cfop:            p.cfop            || '5102',
      cst_icms:        p.cst_icms        || '',
      csosn:           p.csosn           || '400',
      cest:            p.cest            || '',
      origem:          p.origem          || '0',
      aliquota_icms:   p.aliquota_icms   || 0,
      aliquota_pis:    p.aliquota_pis    || 0.65,
      aliquota_cofins: p.aliquota_cofins || 3,
      cst_pis:         p.cst_pis         || '07',
      cst_cofins:      p.cst_cofins      || '07',
      descricao_fiscal: p.descricao_fiscal || '',
      unidade_fiscal:  p.unidade_fiscal  || 'UN',
      peso_liquido_kg: p.peso_liquido_kg || '',
      peso_bruto_kg:   p.peso_bruto_kg   || '',
    })
    setModalOpen(true)
  }

  async function salvar() {
    if (!produtoSel) return
    setSalvando(true)
    await supabase.from('produtos').update({
      ...form,
      aliquota_icms:   Number(form.aliquota_icms) || 0,
      aliquota_pis:    Number(form.aliquota_pis) || 0,
      aliquota_cofins: Number(form.aliquota_cofins) || 0,
      peso_liquido_kg: form.peso_liquido_kg ? Number(form.peso_liquido_kg) : null,
      peso_bruto_kg:   form.peso_bruto_kg   ? Number(form.peso_bruto_kg)   : null,
      descricao_fiscal: form.descricao_fiscal || produtoSel.nome,
      updated_at: new Date().toISOString(),
    }).eq('id', produtoSel.id)
    setSalvando(false); setModalOpen(false); load()
  }

  // Aplicar mesmo NCM/CSOSN para todos os produtos selecionados
  async function aplicarParaTodos() {
    if (!confirm(`Aplicar NCM ${form.ncm} e CSOSN ${form.csosn} para o produto "${produtoSel?.nome}"?`)) return
    await salvar()
  }

  function temDadosFiscais(p: any): boolean {
    return !!(p.ncm && p.cfop && (p.csosn || p.cst_icms))
  }

  const prodFiltrados = produtos.filter(p => {
    const matchBusca = p.nome.toLowerCase().includes(busca.toLowerCase())
    const matchStatus = filtroStatus === 'todos'
      || (filtroStatus === 'ok' && temDadosFiscais(p))
      || (filtroStatus === 'pendente' && !temDadosFiscais(p))
    return matchBusca && matchStatus
  })

  const totalOk      = produtos.filter(temDadosFiscais).length
  const totalPend    = produtos.filter(p => !temDadosFiscais(p)).length
  const pctConcluido = produtos.length > 0 ? Math.round((totalOk / produtos.length) * 100) : 0

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <PageHeader title="Cadastro Fiscal de Produtos"
        subtitle="Configure NCM, CFOP, CSOSN e alíquotas para emissão de NFC-e"
      />

      {/* Progresso geral */}
      <div className="bg-white rounded-xl shadow-md p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-gray-700">Progresso do cadastro fiscal</p>
          <span className="text-sm font-bold text-bendito-verde">{totalOk}/{produtos.length} produtos</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div className="bg-green-500 h-3 rounded-full transition-all" style={{ width: `${pctConcluido}%` }}/>
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1 text-green-600"><CheckCircle size={12}/> {totalOk} completos</span>
          <span className="font-bold text-bendito-verde">{pctConcluido}%</span>
          <span className="flex items-center gap-1 text-orange-600"><AlertTriangle size={12}/> {totalPend} pendentes</span>
        </div>
      </div>

      {/* Aviso regime */}
      <div className={`rounded-xl p-4 border flex items-start gap-3 ${regimeTrib === 'simples' ? 'bg-blue-50 border-blue-200' : 'bg-yellow-50 border-yellow-200'}`}>
        <FileText size={18} className={regimeTrib === 'simples' ? 'text-blue-600 shrink-0' : 'text-yellow-600 shrink-0'}/>
        <div>
          <p className={`text-sm font-semibold ${regimeTrib === 'simples' ? 'text-blue-700' : 'text-yellow-700'}`}>
            Regime: {regimeTrib === 'simples' ? 'Simples Nacional' : regimeTrib === 'lucro_presumido' ? 'Lucro Presumido' : 'Lucro Real'}
          </p>
          <p className={`text-xs mt-0.5 ${regimeTrib === 'simples' ? 'text-blue-500' : 'text-yellow-600'}`}>
            {regimeTrib === 'simples'
              ? 'Use CSOSN (Código de Situação da Operação do Simples Nacional) nos produtos. Recomendado 400 para a maioria.'
              : 'Use CST ICMS (Código de Situação Tributária) nos produtos.'}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-md p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar produto..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-bendito-dourado"/>
        </div>
        <div className="flex gap-2">
          {[
            { key: 'todos',    label: `Todos (${produtos.length})` },
            { key: 'pendente', label: `⚠️ Pendentes (${totalPend})` },
            { key: 'ok',       label: `✅ Completos (${totalOk})` },
          ].map(f => (
            <button key={f.key} onClick={() => setFiltroStatus(f.key)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold border transition ${filtroStatus === f.key ? 'bg-bendito-verde text-white border-bendito-verde' : 'bg-white border-gray-300 text-gray-600 hover:border-bendito-verde'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <button onClick={load} className="ml-auto text-gray-400 hover:text-bendito-verde"><RefreshCw size={15}/></button>
      </div>

      {/* Tabela */}
      {prodFiltrados.length === 0 ? <EmptyState message="Nenhum produto encontrado." /> : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Produto','Cód. Barras','NCM','CFOP', regimeTrib === 'simples' ? 'CSOSN' : 'CST ICMS','Origem','PIS','COFINS','Status','Ação'].map(h =>
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {prodFiltrados.map(p => {
                  const ok = temDadosFiscais(p)
                  return (
                    <tr key={p.id} className={`hover:bg-gray-50 ${!ok ? 'bg-orange-50/30' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-bendito-verde-escuro">{p.nome}</p>
                        <p className="text-xs text-gray-400">{p.unidade_medida}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{p.codigo_barras || <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 font-mono text-xs font-semibold">{p.ncm || <span className="text-orange-400">Falta</span>}</td>
                      <td className="px-4 py-3 font-mono text-xs">{p.cfop || <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 font-mono text-xs font-semibold">
                        {regimeTrib === 'simples' ? (p.csosn || <span className="text-orange-400">Falta</span>) : (p.cst_icms || <span className="text-orange-400">Falta</span>)}
                      </td>
                      <td className="px-4 py-3 text-xs">{p.origem || '0'}</td>
                      <td className="px-4 py-3 text-xs text-center">{p.aliquota_pis ? `${p.aliquota_pis}%` : <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-xs text-center">{p.aliquota_cofins ? `${p.aliquota_cofins}%` : <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3">
                        {ok
                          ? <span className="flex items-center gap-1 text-xs text-green-600 font-semibold"><CheckCircle size={13}/> OK</span>
                          : <span className="flex items-center gap-1 text-xs text-orange-500 font-semibold"><AlertTriangle size={13}/> Pendente</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => abrirEdicao(p)}
                          className="flex items-center gap-1 bg-bendito-verde hover:bg-bendito-verde-escuro text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition">
                          <Edit size={12}/> Configurar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal edição fiscal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}
        title={`Dados Fiscais — ${produtoSel?.nome}`}>
        <div className="space-y-4 max-h-[78vh] overflow-y-auto pr-1">

          {/* Alerta sem dados */}
          {!temDadosFiscais(produtoSel || {}) && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-center gap-2 text-xs text-orange-700">
              <AlertTriangle size={14}/> Este produto ainda não tem dados fiscais completos. Preencha NCM e {regimeTrib === 'simples' ? 'CSOSN' : 'CST ICMS'} obrigatoriamente.
            </div>
          )}

          {/* Seção 1: Identificação */}
          <div className="border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase">Identificação fiscal</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Código de barras (EAN/GTIN)">
                <Input value={form.codigo_barras} onChange={e => setForm({...form, codigo_barras: e.target.value})}
                  placeholder="Ex: 7891234567890"/>
              </Field>
              <Field label="Unidade Tributável">
                <select value={form.unidade_fiscal} onChange={e => setForm({...form, unidade_fiscal: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                  {UNIDADES_FISCAIS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Descrição fiscal (para NF-e — se diferente do nome)">
              <Input value={form.descricao_fiscal}
                onChange={e => setForm({...form, descricao_fiscal: e.target.value})}
                placeholder={produtoSel?.nome || 'Nome do produto na nota fiscal'}/>
            </Field>
          </div>

          {/* Seção 2: NCM e CFOP */}
          <div className="border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase">NCM / CFOP</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="NCM (8 dígitos) *">
                <Input value={form.ncm} onChange={e => setForm({...form, ncm: e.target.value.replace(/\D/g,'').slice(0,8)})}
                  placeholder="Ex: 21069090" maxLength={8}/>
              </Field>
              <Field label="CFOP *">
                <Input value={form.cfop} onChange={e => setForm({...form, cfop: e.target.value.replace(/\D/g,'').slice(0,4)})}
                  placeholder="Ex: 5102" maxLength={4}/>
              </Field>
            </div>
            {/* Sugestões NCM */}
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Sugestões de NCM para lanches:</p>
              <div className="flex flex-wrap gap-1.5">
                {NCM_SUGESTOES.map(s => (
                  <button key={s.ncm} onClick={() => setForm({...form, ncm: s.ncm})}
                    className={`text-xs px-2 py-1 rounded border transition ${form.ncm === s.ncm ? 'bg-bendito-verde text-white border-bendito-verde' : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-600'}`}>
                    {s.ncm} — {s.desc}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="CEST (se aplicável)">
                <Input value={form.cest} onChange={e => setForm({...form, cest: e.target.value})}
                  placeholder="Ex: 1700100"/>
              </Field>
              <Field label="Origem">
                <select value={form.origem} onChange={e => setForm({...form, origem: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                  {ORIGENS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
            </div>
          </div>

          {/* Seção 3: ICMS */}
          <div className="border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase">ICMS</p>
            {regimeTrib === 'simples' ? (
              <Field label="CSOSN — Simples Nacional *">
                <select value={form.csosn} onChange={e => setForm({...form, csosn: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                  {CSOSN_OPCOES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Field label="CST ICMS *">
                  <select value={form.cst_icms} onChange={e => setForm({...form, cst_icms: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                    {CST_ICMS_OPCOES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
                <Field label="Alíquota ICMS %">
                  <Input type="number" step="0.01" value={form.aliquota_icms}
                    onChange={e => setForm({...form, aliquota_icms: e.target.value})} placeholder="0"/>
                </Field>
              </div>
            )}
          </div>

          {/* Seção 4: PIS/COFINS */}
          <div className="border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase">PIS / COFINS</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="CST PIS">
                <select value={form.cst_pis} onChange={e => setForm({...form, cst_pis: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                  <option value="01">01 — Operação tributável alíquota básica</option>
                  <option value="02">02 — Operação tributável alíquota diferenciada</option>
                  <option value="07">07 — Operação isenta</option>
                  <option value="08">08 — Operação sem incidência</option>
                  <option value="49">49 — Outras operações de saída</option>
                  <option value="99">99 — Outras operações</option>
                </select>
              </Field>
              <Field label="Alíquota PIS %">
                <Input type="number" step="0.01" value={form.aliquota_pis}
                  onChange={e => setForm({...form, aliquota_pis: e.target.value})} placeholder="0.65"/>
              </Field>
              <Field label="CST COFINS">
                <select value={form.cst_cofins} onChange={e => setForm({...form, cst_cofins: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                  <option value="01">01 — Operação tributável alíquota básica</option>
                  <option value="02">02 — Operação tributável alíquota diferenciada</option>
                  <option value="07">07 — Operação isenta</option>
                  <option value="08">08 — Operação sem incidência</option>
                  <option value="49">49 — Outras operações de saída</option>
                  <option value="99">99 — Outras operações</option>
                </select>
              </Field>
              <Field label="Alíquota COFINS %">
                <Input type="number" step="0.01" value={form.aliquota_cofins}
                  onChange={e => setForm({...form, aliquota_cofins: e.target.value})} placeholder="3"/>
              </Field>
            </div>
            {regimeTrib === 'simples' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-xs text-blue-600">
                💡 Simples Nacional: PIS/COFINS geralmente CST 07 (isento) ou 49. Confirme com seu contador.
              </div>
            )}
          </div>

          {/* Seção 5: Peso */}
          <div className="border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase">Peso (opcional)</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Peso líquido (kg)">
                <Input type="number" step="0.0001" value={form.peso_liquido_kg}
                  onChange={e => setForm({...form, peso_liquido_kg: e.target.value})} placeholder="0.300"/>
              </Field>
              <Field label="Peso bruto (kg)">
                <Input type="number" step="0.0001" value={form.peso_bruto_kg}
                  onChange={e => setForm({...form, peso_bruto_kg: e.target.value})} placeholder="0.350"/>
              </Field>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <SecondaryButton onClick={() => setModalOpen(false)} className="flex-1">Cancelar</SecondaryButton>
            <PrimaryButton onClick={salvar} disabled={salvando || !form.ncm || !form.cfop} className="flex-1">
              {salvando ? 'Salvando...' : '💾 Salvar dados fiscais'}
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
