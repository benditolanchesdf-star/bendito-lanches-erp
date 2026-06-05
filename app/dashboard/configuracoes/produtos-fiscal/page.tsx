'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { ProdutoFiscalSchema, type ProdutoFiscalInput } from '@/schemas'
import { PageHeader, Loading, EmptyState } from '@/components/ui'
import Modal from '@/components/Modal'
import { Edit, CheckCircle, AlertTriangle, Search, RefreshCw } from 'lucide-react'

const NCM_SUGESTOES = [
  { ncm: '21069090', desc: 'Preparações alimentícias diversas' },
  { ncm: '19059090', desc: 'Outros produtos de padaria/pastelaria' },
  { ncm: '16010010', desc: 'Salsichas e similares' },
  { ncm: '04069000', desc: 'Queijos diversos' },
  { ncm: '02012000', desc: 'Carnes bovinas' },
  { ncm: '22021000', desc: 'Águas, refrigerantes' },
  { ncm: '19021900', desc: 'Massas alimentícias' },
]

const UNIDADES_FISCAIS = ['UN', 'KG', 'G', 'L', 'ML', 'PCT', 'CX', 'DZ']
const ORIGENS = [
  { value: '0', label: '0 — Nacional' },
  { value: '1', label: '1 — Estrangeira (importação direta)' },
  { value: '2', label: '2 — Estrangeira (mercado interno)' },
]
const CSOSN_OPCOES = [
  { value: '102', label: '102 — Tributada sem crédito' },
  { value: '400', label: '400 — Não tributada pelo SN' },
  { value: '500', label: '500 — ICMS cobrado anteriormente' },
  { value: '900', label: '900 — Outros' },
]

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertTriangle size={10}/>{msg}</p>
}

export default function ProdutosFiscalPage() {
  const supabase = createClient()
  const [loading, setLoading]     = useState(true)
  const [produtos, setProdutos]   = useState<any[]>([])
  const [busca, setBusca]         = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [modalOpen, setModalOpen] = useState(false)
  const [produtoSel, setProdutoSel] = useState<any>(null)
  const [salvando, setSalvando]   = useState(false)
  const [regimeTrib, setRegimeTrib] = useState('simples')

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProdutoFiscalInput>({
    resolver: zodResolver(ProdutoFiscalSchema),
    defaultValues: {
      origem:          '0',
      aliquota_icms:   0,
      aliquota_pis:    0.65,
      aliquota_cofins: 3,
      cst_pis:         '07',
      cst_cofins:      '07',
      unidade_fiscal:  'UN',
    },
  })

  const ncmWatch = watch('ncm')

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
    reset({
      codigo_barras:    p.codigo_barras   || '',
      ncm:              p.ncm             || '',
      cfop:             p.cfop            || '5102',
      csosn:            p.csosn           || '400',
      cst_icms:         p.cst_icms        || '',
      cest:             p.cest            || '',
      origem:           p.origem          || '0',
      aliquota_icms:    Number(p.aliquota_icms)   || 0,
      aliquota_pis:     Number(p.aliquota_pis)    || 0.65,
      aliquota_cofins:  Number(p.aliquota_cofins) || 3,
      cst_pis:          p.cst_pis         || '07',
      cst_cofins:       p.cst_cofins      || '07',
      descricao_fiscal: p.descricao_fiscal || '',
      unidade_fiscal:   p.unidade_fiscal  || 'UN',
      peso_liquido_kg:  p.peso_liquido_kg ? Number(p.peso_liquido_kg) : undefined,
      peso_bruto_kg:    p.peso_bruto_kg   ? Number(p.peso_bruto_kg)   : undefined,
    })
    setModalOpen(true)
  }

  async function onSubmit(data: ProdutoFiscalInput) {
    if (!produtoSel) return
    setSalvando(true)
    await supabase.from('produtos').update({
      ...data,
      descricao_fiscal: data.descricao_fiscal || produtoSel.nome,
      updated_at: new Date().toISOString(),
    }).eq('id', produtoSel.id)
    setSalvando(false)
    setModalOpen(false)
    load()
  }

  const temDadosFiscais = (p: any) => !!(p.ncm && p.cfop && (p.csosn || p.cst_icms))

  const prodFiltrados = produtos.filter(p => {
    const matchBusca   = p.nome.toLowerCase().includes(busca.toLowerCase())
    const matchStatus  = filtroStatus === 'todos'
      || (filtroStatus === 'ok' && temDadosFiscais(p))
      || (filtroStatus === 'pendente' && !temDadosFiscais(p))
    return matchBusca && matchStatus
  })

  const totalOk   = produtos.filter(temDadosFiscais).length
  const totalPend = produtos.filter(p => !temDadosFiscais(p)).length
  const pct       = produtos.length > 0 ? Math.round((totalOk / produtos.length) * 100) : 0

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <PageHeader title="Cadastro Fiscal de Produtos"
        subtitle="Configure NCM, CFOP, CSOSN e alíquotas para emissão de NFC-e"/>

      {/* Progresso */}
      <div className="bg-white rounded-xl shadow-md p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-gray-700">Progresso do cadastro fiscal</p>
          <span className="text-sm font-bold text-bendito-verde">{totalOk}/{produtos.length} produtos</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div className="bg-green-500 h-3 rounded-full transition-all" style={{ width: `${pct}%` }}/>
        </div>
        <div className="flex justify-between mt-2 text-xs">
          <span className="text-green-600 flex items-center gap-1"><CheckCircle size={12}/> {totalOk} completos</span>
          <span className="font-bold text-bendito-verde">{pct}%</span>
          <span className="text-orange-600 flex items-center gap-1"><AlertTriangle size={12}/> {totalPend} pendentes</span>
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
              className={`px-3 py-2 rounded-lg text-xs font-semibold border transition
                ${filtroStatus === f.key ? 'bg-bendito-verde text-white border-bendito-verde' : 'bg-white border-gray-300 text-gray-600 hover:border-bendito-verde'}`}>
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
                <tr>{['Produto','NCM','CFOP', regimeTrib === 'simples' ? 'CSOSN' : 'CST','PIS','COFINS','Status','Ação'].map(h =>
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                )}</tr>
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
                      <td className="px-4 py-3 font-mono text-xs font-semibold">{p.ncm || <span className="text-orange-400">Falta</span>}</td>
                      <td className="px-4 py-3 font-mono text-xs">{p.cfop || <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 font-mono text-xs font-semibold">
                        {regimeTrib === 'simples'
                          ? (p.csosn || <span className="text-orange-400">Falta</span>)
                          : (p.cst_icms || <span className="text-orange-400">Falta</span>)
                        }
                      </td>
                      <td className="px-4 py-3 text-xs text-center">{p.aliquota_pis ? `${p.aliquota_pis}%` : '—'}</td>
                      <td className="px-4 py-3 text-xs text-center">{p.aliquota_cofins ? `${p.aliquota_cofins}%` : '—'}</td>
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

      {/* Modal com validação Zod */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}
        title={`Dados Fiscais — ${produtoSel?.nome}`}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[78vh] overflow-y-auto pr-1">

          {!temDadosFiscais(produtoSel || {}) && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-center gap-2 text-xs text-orange-700">
              <AlertTriangle size={14}/> Preencha NCM e {regimeTrib === 'simples' ? 'CSOSN' : 'CST ICMS'} obrigatoriamente.
            </div>
          )}

          {/* Identificação */}
          <div className="border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase">Identificação</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Cód. de barras (EAN)</label>
                <input {...register('codigo_barras')}
                  placeholder="7891234567890"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado"/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Unidade tributável</label>
                <select {...register('unidade_fiscal')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                  {UNIDADES_FISCAIS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Descrição fiscal (para NF-e)</label>
              <input {...register('descricao_fiscal')}
                placeholder={produtoSel?.nome}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado"/>
            </div>
          </div>

          {/* NCM / CFOP */}
          <div className="border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase">NCM / CFOP</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">NCM (8 dígitos) <span className="text-red-500">*</span></label>
                <input {...register('ncm')} placeholder="21069090" maxLength={8}
                  className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado font-mono ${errors.ncm ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}/>
                <FieldError msg={errors.ncm?.message}/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">CFOP <span className="text-red-500">*</span></label>
                <input {...register('cfop')} placeholder="5102" maxLength={4}
                  className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado font-mono ${errors.cfop ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}/>
                <FieldError msg={errors.cfop?.message}/>
              </div>
            </div>
            {/* Sugestões NCM */}
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Sugestões para lanches:</p>
              <div className="flex flex-wrap gap-1.5">
                {NCM_SUGESTOES.map(s => (
                  <button key={s.ncm} type="button"
                    onClick={() => setValue('ncm', s.ncm, { shouldValidate: true })}
                    className={`text-xs px-2 py-1 rounded border transition
                      ${ncmWatch === s.ncm ? 'bg-bendito-verde text-white border-bendito-verde' : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-600'}`}>
                    {s.ncm} — {s.desc}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ICMS */}
          <div className="border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase">ICMS</p>
            {regimeTrib === 'simples' ? (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">CSOSN <span className="text-red-500">*</span></label>
                <select {...register('csosn')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                  {CSOSN_OPCOES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">CST ICMS</label>
                  <input {...register('cst_icms')} placeholder="000"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado"/>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Alíquota ICMS %</label>
                  <input type="number" step="0.01" {...register('aliquota_icms', { valueAsNumber: true })}
                    className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado ${errors.aliquota_icms ? 'border-red-400' : 'border-gray-300'}`}/>
                  <FieldError msg={errors.aliquota_icms?.message}/>
                </div>
              </div>
            )}
          </div>

          {/* PIS / COFINS */}
          <div className="border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase">PIS / COFINS</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">CST PIS</label>
                <select {...register('cst_pis')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                  <option value="07">07 — Isento</option>
                  <option value="01">01 — Alíquota básica</option>
                  <option value="49">49 — Outras saídas</option>
                  <option value="99">99 — Outras operações</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Alíquota PIS %</label>
                <input type="number" step="0.01" {...register('aliquota_pis', { valueAsNumber: true })}
                  className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado ${errors.aliquota_pis ? 'border-red-400' : 'border-gray-300'}`}/>
                <FieldError msg={errors.aliquota_pis?.message}/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">CST COFINS</label>
                <select {...register('cst_cofins')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                  <option value="07">07 — Isento</option>
                  <option value="01">01 — Alíquota básica</option>
                  <option value="49">49 — Outras saídas</option>
                  <option value="99">99 — Outras operações</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Alíquota COFINS %</label>
                <input type="number" step="0.01" {...register('aliquota_cofins', { valueAsNumber: true })}
                  className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado ${errors.aliquota_cofins ? 'border-red-400' : 'border-gray-300'}`}/>
                <FieldError msg={errors.aliquota_cofins?.message}/>
              </div>
            </div>
            {regimeTrib === 'simples' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-xs text-blue-600">
                💡 Simples Nacional: PIS/COFINS geralmente CST 07 (isento). Confirme com seu contador.
              </div>
            )}
          </div>

          {/* Resumo de erros */}
          {Object.keys(errors).length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-600">
              <p className="font-semibold mb-1 flex items-center gap-1">
                <AlertTriangle size={12}/> Corrija os erros:
              </p>
              <ul className="list-disc list-inside space-y-0.5">
                {Object.entries(errors).map(([k, v]) => (
                  <li key={k}>{(v as any)?.message}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-2.5 rounded-lg text-sm font-semibold transition">
              Cancelar
            </button>
            <button type="submit" disabled={salvando}
              className="flex-1 bg-bendito-verde hover:bg-bendito-verde-escuro text-white py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50">
              {salvando ? 'Salvando...' : '💾 Salvar dados fiscais'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
