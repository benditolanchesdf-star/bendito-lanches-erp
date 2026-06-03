'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatBRL } from '@/lib/constants'
import { PageHeader, Loading, EmptyState, Field, Input, PrimaryButton, SecondaryButton } from '@/components/ui'
import Modal from '@/components/Modal'
import { Edit, Building2, Package, RefreshCw } from 'lucide-react'

export default function ProdutosFiliaisPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [filiais, setFiliais] = useState<any[]>([])
  const [filialSel, setFilialSel] = useState('')
  const [produtos, setProdutos] = useState<any[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [produtoSel, setProdutoSel] = useState<any>(null)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({
    preco_varejo: '', preco_atacado: '',
    estoque_atual: '', estoque_minimo: '', estoque_maximo: '',
    ativo_na_filial: true,
  })

  async function load() {
    setLoading(true)
    const { data: fils } = await supabase.from('filiais').select('id, nome').eq('ativo', true).order('nome')
    setFiliais(fils || [])
    if (!filialSel && fils && fils.length > 0) {
      setFilialSel(fils[0].id)
    }
    setLoading(false)
  }

  async function carregarProdutos(fid: string) {
    setLoading(true)
    const { data } = await supabase
      .from('vw_produtos_filial')
      .select('*')
      .eq('filial_id', fid)
      .order('nome')
    setProdutos(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])
  useEffect(() => { if (filialSel) carregarProdutos(filialSel) }, [filialSel])

  function abrirEdicao(p: any) {
    setProdutoSel(p)
    setForm({
      preco_varejo:    p.preco_personalizado ? String(p.preco_varejo) : '',
      preco_atacado:   p.preco_atacado ? String(p.preco_atacado) : '',
      estoque_atual:   String(p.estoque_atual || 0),
      estoque_minimo:  String(p.estoque_minimo || 0),
      estoque_maximo:  String(p.estoque_maximo || 0),
      ativo_na_filial: p.ativo_na_filial,
    })
    setModalOpen(true)
  }

  async function salvar() {
    if (!produtoSel) return
    setSalvando(true)
    await supabase.from('produto_filial').upsert({
      produto_id:     produtoSel.produto_id,
      filial_id:      filialSel,
      preco_varejo:   form.preco_varejo   ? Number(form.preco_varejo)   : null,
      preco_atacado:  form.preco_atacado  ? Number(form.preco_atacado)  : null,
      estoque_atual:  Number(form.estoque_atual)  || 0,
      estoque_minimo: Number(form.estoque_minimo) || 0,
      estoque_maximo: Number(form.estoque_maximo) || 0,
      ativo:          form.ativo_na_filial,
      updated_at:     new Date().toISOString(),
    }, { onConflict: 'produto_id,filial_id' })
    setSalvando(false)
    setModalOpen(false)
    carregarProdutos(filialSel)
  }

  const filialAtual = filiais.find(f => f.id === filialSel)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produtos por Filial"
        subtitle="Configure preços e estoques individuais para cada unidade"
      />

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
        💡 Os produtos são cadastrados uma vez na <strong>Matriz</strong> e aparecem automaticamente em todas as filiais.
        Configure o <strong>preço personalizado</strong> e o <strong>estoque</strong> de cada produto por unidade.
        Se não houver preço personalizado, a filial usa o preço da Matriz.
      </div>

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
        <button onClick={() => carregarProdutos(filialSel)}
          className="ml-auto flex items-center gap-1 text-xs text-gray-500 hover:text-bendito-verde">
          <RefreshCw size={13}/> Atualizar
        </button>
      </div>

      {loading ? <Loading /> : produtos.length === 0 ? (
        <EmptyState message="Nenhum produto disponível." />
      ) : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50 flex items-center gap-2">
            <Package size={16} className="text-bendito-verde"/>
            <span className="font-semibold text-bendito-verde-escuro">{filialAtual?.nome}</span>
            <span className="text-xs text-gray-500 ml-1">— {produtos.length} produto(s)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Produto','Preço Varejo','Preço Atacado','Estoque Atual','Mínimo','Status','Ações'].map(h =>
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {produtos.map(p => (
                  <tr key={p.produto_id} className={`hover:bg-gray-50 ${!p.ativo_na_filial ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-bendito-verde-escuro">{p.nome}</p>
                      <p className="text-xs text-gray-400">{p.categoria_nome || 'Sem categoria'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-bendito-verde">{formatBRL(p.preco_varejo)}</p>
                      {p.preco_personalizado && (
                        <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-semibold">personalizado</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.preco_atacado ? formatBRL(p.preco_atacado) : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${Number(p.estoque_atual) <= Number(p.estoque_minimo) ? 'text-red-600' : 'text-green-600'}`}>
                        {p.estoque_atual} {p.unidade_medida}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{p.estoque_minimo}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${p.ativo_na_filial ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {p.ativo_na_filial ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => abrirEdicao(p)}
                        className="p-1.5 text-gray-400 hover:text-bendito-verde rounded" title="Configurar">
                        <Edit size={15}/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}
        title={`Configurar — ${produtoSel?.nome}`}>
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
            Unidade: <strong>{filialAtual?.nome}</strong>
            <br/>Deixe o preço em branco para usar o preço padrão da Matriz ({formatBRL(produtoSel?.preco_varejo)}).
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Preço Varejo (R$)">
              <Input type="number" step="0.01" value={form.preco_varejo}
                onChange={e => setForm({...form, preco_varejo: e.target.value})}
                placeholder={`Padrão: ${formatBRL(produtoSel?.preco_varejo)}`} />
            </Field>
            <Field label="Preço Atacado (R$)">
              <Input type="number" step="0.01" value={form.preco_atacado}
                onChange={e => setForm({...form, preco_atacado: e.target.value})}
                placeholder="Opcional" />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Estoque Atual">
              <Input type="number" step="0.01" value={form.estoque_atual}
                onChange={e => setForm({...form, estoque_atual: e.target.value})} />
            </Field>
            <Field label="Estoque Mínimo">
              <Input type="number" step="0.01" value={form.estoque_minimo}
                onChange={e => setForm({...form, estoque_minimo: e.target.value})} />
            </Field>
            <Field label="Estoque Máximo">
              <Input type="number" step="0.01" value={form.estoque_maximo}
                onChange={e => setForm({...form, estoque_maximo: e.target.value})} />
            </Field>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setForm({...form, ativo_na_filial: !form.ativo_na_filial})}
              className={`w-11 h-6 rounded-full transition-colors relative ${form.ativo_na_filial ? 'bg-green-500' : 'bg-gray-300'}`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.ativo_na_filial ? 'translate-x-5' : 'translate-x-0.5'}`}/>
            </button>
            <span className="text-sm text-gray-700">
              {form.ativo_na_filial ? 'Produto ativo nesta unidade' : 'Produto inativo nesta unidade'}
            </span>
          </div>

          <div className="flex gap-3">
            <SecondaryButton onClick={() => setModalOpen(false)} className="flex-1">Cancelar</SecondaryButton>
            <PrimaryButton onClick={salvar} disabled={salvando} className="flex-1">
              {salvando ? 'Salvando...' : 'Salvar configuração'}
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
