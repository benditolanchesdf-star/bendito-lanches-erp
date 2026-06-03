'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader, Loading, EmptyState, Field, Input, PrimaryButton, SecondaryButton } from '@/components/ui'
import Modal from '@/components/Modal'
import { Plus, Edit, Building2, MapPin, Phone } from 'lucide-react'

export default function FiliaisPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [filiais, setFiliais] = useState<any[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({ nome:'', endereco:'', telefone:'', cnpj:'' })

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('filiais').select('*').order('nome')
    setFiliais(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function abrirNovo() {
    setEditando(null)
    setForm({ nome:'', endereco:'', telefone:'', cnpj:'' })
    setModalOpen(true)
  }

  function abrirEdicao(f: any) {
    setEditando(f)
    setForm({ nome: f.nome||'', endereco: f.endereco||'', telefone: f.telefone||'', cnpj: f.cnpj||'' })
    setModalOpen(true)
  }

  async function salvar() {
    if (!form.nome.trim()) return
    setSalvando(true)
    if (editando) {
      await supabase.from('filiais').update(form).eq('id', editando.id)
    } else {
      await supabase.from('filiais').insert({ ...form, ativo: true })
    }
    setSalvando(false); setModalOpen(false); load()
  }

  async function toggleAtivo(f: any) {
    if (f.id === '11111111-1111-1111-1111-111111111111') {
      alert('A Matriz não pode ser desativada.')
      return
    }
    await supabase.from('filiais').update({ ativo: !f.ativo }).eq('id', f.id)
    load()
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <PageHeader title="Filiais" subtitle="Gerencie as unidades da rede Bendito Lanches"
        action={<PrimaryButton onClick={abrirNovo} className="flex items-center gap-2"><Plus size={16}/> Nova filial</PrimaryButton>} />

      {filiais.length === 0 ? <EmptyState message="Nenhuma filial cadastrada." /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filiais.map(f => (
            <div key={f.id} className={`bg-white rounded-xl shadow-md p-5 border-l-4 ${f.id === '11111111-1111-1111-1111-111111111111' ? 'border-bendito-dourado' : 'border-bendito-verde'}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Building2 size={20} className={f.id === '11111111-1111-1111-1111-111111111111' ? 'text-bendito-dourado' : 'text-bendito-verde'} />
                  <div>
                    <h3 className="font-bold text-bendito-verde-escuro">{f.nome}</h3>
                    {f.id === '11111111-1111-1111-1111-111111111111' && (
                      <span className="text-xs bg-bendito-dourado text-bendito-verde-escuro px-2 py-0.5 rounded-full font-semibold">Matriz</span>
                    )}
                  </div>
                </div>
                <button onClick={() => toggleAtivo(f)}
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${f.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {f.ativo ? 'Ativa' : 'Inativa'}
                </button>
              </div>

              <div className="space-y-1 text-sm text-gray-600">
                {f.cnpj && <p className="text-xs text-gray-400">CNPJ: {f.cnpj}</p>}
                {f.endereco && (
                  <p className="flex items-center gap-1 text-xs">
                    <MapPin size={11} className="text-gray-400"/> {f.endereco}
                  </p>
                )}
                {f.telefone && (
                  <p className="flex items-center gap-1 text-xs">
                    <Phone size={11} className="text-gray-400"/> {f.telefone}
                  </p>
                )}
              </div>

              <button onClick={() => abrirEdicao(f)}
                className="mt-3 flex items-center gap-1 text-xs text-bendito-verde font-semibold hover:underline">
                <Edit size={12}/> Editar dados
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editando ? 'Editar filial' : 'Nova filial'}>
        <div className="space-y-4">
          <Field label="Nome da filial" required>
            <Input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Ex: Filial Taguatinga" />
          </Field>
          <Field label="CNPJ">
            <Input value={form.cnpj} onChange={e => setForm({...form, cnpj: e.target.value})} placeholder="00.000.000/0000-00" />
          </Field>
          <Field label="Endereço">
            <Input value={form.endereco} onChange={e => setForm({...form, endereco: e.target.value})} placeholder="Rua, número, bairro, cidade" />
          </Field>
          <Field label="Telefone">
            <Input value={form.telefone} onChange={e => setForm({...form, telefone: e.target.value})} placeholder="(61) 9xxxx-xxxx" />
          </Field>
          <div className="flex gap-3">
            <SecondaryButton onClick={() => setModalOpen(false)} className="flex-1">Cancelar</SecondaryButton>
            <PrimaryButton onClick={salvar} disabled={salvando || !form.nome} className="flex-1">
              {salvando ? 'Salvando...' : editando ? 'Salvar' : 'Criar filial'}
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
