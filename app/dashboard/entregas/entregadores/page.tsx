'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader, Loading, EmptyState, Field, Input, PrimaryButton, SecondaryButton } from '@/components/ui'
import Modal from '@/components/Modal'
import { Plus, Edit, Truck, Check, X, Star } from 'lucide-react'

export default function EntregadoresPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [entregadores, setEntregadores] = useState<any[]>([])
  const [filiais, setFiliais] = useState<any[]>([])
  const [stats, setStats] = useState<Record<string, any>>({})
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState<any>({
    nome: '', telefone: '', cpf: '', cnh: '',
    veiculo_tipo: 'moto', veiculo_placa: '',
    area_atuacao: '', filial_id: '',
  })

  async function load() {
    setLoading(true)
    const [{ data: ents }, { data: fils }, { data: entregas }] = await Promise.all([
      supabase.from('entregadores').select('*, filiais(nome)').order('nome'),
      supabase.from('filiais').select('id, nome').eq('ativo', true),
      supabase.from('entregas').select('entregador_id, status, avaliacao'),
    ])
    setEntregadores(ents || [])
    setFiliais(fils || [])

    // Calcular stats por entregador
    const statsMap: Record<string, any> = {}
    for (const e of entregas || []) {
      if (!e.entregador_id) continue
      if (!statsMap[e.entregador_id]) statsMap[e.entregador_id] = { total: 0, entregues: 0, soma_av: 0, qtd_av: 0 }
      statsMap[e.entregador_id].total++
      if (e.status === 'entregue') statsMap[e.entregador_id].entregues++
      if (e.avaliacao) { statsMap[e.entregador_id].soma_av += e.avaliacao; statsMap[e.entregador_id].qtd_av++ }
    }
    setStats(statsMap)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function abrirNovo() {
    setEditando(null)
    setForm({ nome:'', telefone:'', cpf:'', cnh:'', veiculo_tipo:'moto', veiculo_placa:'', area_atuacao:'', filial_id: filiais[0]?.id||'' })
    setModalOpen(true)
  }

  function abrirEdicao(e: any) {
    setEditando(e)
    setForm({ nome:e.nome, telefone:e.telefone||'', cpf:e.cpf||'', cnh:e.cnh||'', veiculo_tipo:e.veiculo_tipo||'moto', veiculo_placa:e.veiculo_placa||'', area_atuacao:e.area_atuacao||'', filial_id:e.filial_id||'' })
    setModalOpen(true)
  }

  async function salvar() {
    if (!form.nome || !form.filial_id) return
    setSalvando(true)
    if (editando) {
      await supabase.from('entregadores').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editando.id)
    } else {
      await supabase.from('entregadores').insert({ ...form, ativo: true })
    }
    setSalvando(false); setModalOpen(false); load()
  }

  async function toggleAtivo(e: any) {
    await supabase.from('entregadores').update({ ativo: !e.ativo }).eq('id', e.id)
    load()
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <PageHeader title="Entregadores" subtitle="Cadastro e desempenho da equipe de entrega"
        action={
          <PrimaryButton onClick={abrirNovo} className="flex items-center gap-2">
            <Plus size={16}/> Novo entregador
          </PrimaryButton>
        }
      />

      {entregadores.length === 0 ? <EmptyState message="Nenhum entregador cadastrado." /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {entregadores.map(e => {
            const s = stats[e.id] || {}
            const mediaAv = s.qtd_av > 0 ? (s.soma_av / s.qtd_av).toFixed(1) : '—'
            const taxaEntrega = s.total > 0 ? Math.round((s.entregues / s.total) * 100) : 0
            return (
              <div key={e.id} className={`bg-white rounded-xl shadow-md p-5 border-l-4 ${e.ativo ? 'border-bendito-verde' : 'border-gray-300 opacity-60'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-bendito-verde-escuro text-lg">{e.nome}</p>
                    <p className="text-xs text-gray-500">{e.filiais?.nome}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => abrirEdicao(e)} className="p-1.5 text-gray-400 hover:text-bendito-verde rounded"><Edit size={14}/></button>
                    <button onClick={() => toggleAtivo(e)} className={`p-1.5 rounded ${e.ativo ? 'text-gray-400 hover:text-red-500' : 'text-gray-400 hover:text-green-600'}`}>
                      {e.ativo ? <X size={14}/> : <Check size={14}/>}
                    </button>
                  </div>
                </div>

                <div className="space-y-1 text-sm text-gray-600">
                  <p className="flex items-center gap-2">
                    <Truck size={14} className="text-bendito-verde"/>
                    {e.veiculo_tipo} {e.veiculo_placa ? `· ${e.veiculo_placa}` : ''}
                  </p>
                  {e.telefone && <p className="text-xs text-gray-400">📱 {e.telefone}</p>}
                  {e.area_atuacao && <p className="text-xs text-gray-400">📍 {e.area_atuacao}</p>}
                </div>

                <div className="mt-3 pt-3 border-t grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-gray-500">Entregas</p>
                    <p className="font-bold text-bendito-verde">{s.total || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Taxa</p>
                    <p className="font-bold text-blue-600">{taxaEntrega}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Avaliação</p>
                    <p className="font-bold text-yellow-500 flex items-center justify-center gap-0.5">
                      <Star size={12} fill="currentColor"/> {mediaAv}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editando ? 'Editar entregador' : 'Novo entregador'}>
        <div className="space-y-4">
          <Field label="Nome completo" required>
            <Input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Nome do entregador"/>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Telefone">
              <Input value={form.telefone} onChange={e => setForm({...form, telefone: e.target.value})} placeholder="(61) 9xxxx-xxxx"/>
            </Field>
            <Field label="CPF">
              <Input value={form.cpf} onChange={e => setForm({...form, cpf: e.target.value})} placeholder="000.000.000-00"/>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo de veículo">
              <select value={form.veiculo_tipo} onChange={e => setForm({...form, veiculo_tipo: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                {['moto','carro','bicicleta','van','a pé'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
            <Field label="Placa">
              <Input value={form.veiculo_placa} onChange={e => setForm({...form, veiculo_placa: e.target.value})} placeholder="ABC-1234"/>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="CNH">
              <Input value={form.cnh} onChange={e => setForm({...form, cnh: e.target.value})} placeholder="Número da CNH"/>
            </Field>
            <Field label="Unidade">
              <select value={form.filial_id} onChange={e => setForm({...form, filial_id: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                <option value="">Selecione...</option>
                {filiais.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Área de atuação">
            <Input value={form.area_atuacao} onChange={e => setForm({...form, area_atuacao: e.target.value})} placeholder="Ex: Asa Norte, Lago Sul, Taguatinga..."/>
          </Field>
          <div className="flex gap-3">
            <SecondaryButton onClick={() => setModalOpen(false)} className="flex-1">Cancelar</SecondaryButton>
            <PrimaryButton onClick={salvar} disabled={salvando || !form.nome || !form.filial_id} className="flex-1">
              {salvando ? 'Salvando...' : editando ? 'Salvar' : 'Cadastrar'}
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
