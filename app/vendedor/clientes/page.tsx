'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FILIAL_ID, formatBRL, TIPO_CLIENTE, ALERTAS_CLIENTE, STATUS_FIN_CLIENTE } from '@/lib/constants'
import Modal from '@/components/Modal'
import { Field, Input, Select, Textarea, PrimaryButton, SecondaryButton, PageHeader, Loading, EmptyState } from '@/components/ui'
import { Plus, Edit, Search, Phone, MessageCircle, ShoppingCart } from 'lucide-react'

export default function VendedorClientesPage() {
  const supabase = createClient()
  const [clientes, setClientes] = useState<any[]>([])
  const [vendedorId, setVendedorId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState<any>({})

  async function load() {
    setLoading(true)
    // Pega o vendedor_id do próprio usuário (para preencher ao criar)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('vendedor_id').eq('id', user!.id).maybeSingle()
    setVendedorId(profile?.vendedor_id || null)

    // RLS já filtra para os clientes do vendedor
    const { data } = await supabase.from('clientes').select('*').order('nome')
    setClientes(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function abrirNovo() {
    setEditando(null)
    setForm({
      nome: '', nome_loja: '', cpf_cnpj: '', telefone: '', email: '',
      tipo: 'atacado', cidade: 'Brasília', uf: 'DF',
      logradouro: '', numero: '', bairro: '', cep: '',
      pedido_minimo: 0, limite_credito: 0, observacao_entrega: '',
    })
    setModalOpen(true)
  }
  function abrirEdicao(c: any) { setEditando(c); setForm({ ...c }); setModalOpen(true) }

  async function salvar() {
    setSalvando(true)
    const payload: any = {
      filial_id: FILIAL_ID,
      vendedor_responsavel_id: vendedorId,  // garante vínculo
      nome: form.nome,
      nome_loja: form.nome_loja || null,
      cpf_cnpj: form.cpf_cnpj || null,
      telefone: form.telefone,
      email: form.email || null,
      tipo: form.tipo,
      cidade: form.cidade || null,
      uf: form.uf || null,
      logradouro: form.logradouro || null,
      numero: form.numero || null,
      bairro: form.bairro || null,
      cep: form.cep || null,
      pedido_minimo: Number(form.pedido_minimo) || 0,
      limite_credito: Number(form.limite_credito) || 0,
      observacao_entrega: form.observacao_entrega || null,
    }
    let error
    if (editando) ({ error } = await supabase.from('clientes').update(payload).eq('id', editando.id))
    else ({ error } = await supabase.from('clientes').insert(payload))
    setSalvando(false)
    if (error) { alert('Erro: ' + error.message); return }
    setModalOpen(false); load()
  }

  const filtrados = clientes.filter((c) =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (c.nome_loja || '').toLowerCase().includes(busca.toLowerCase()) ||
    (c.telefone || '').includes(busca)
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Meus Clientes" subtitle="Clientes vinculados à sua carteira"
        action={<PrimaryButton onClick={abrirNovo} className="flex items-center gap-2"><Plus size={20} /> Novo Cliente</PrimaryButton>} />

      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, loja ou telefone..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-bendito-dourado" />
        </div>
      </div>

      {loading ? <Loading /> : filtrados.length === 0 ? <EmptyState message="Você ainda não tem clientes. Clique em Novo Cliente." /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtrados.map((c) => {
            const fin = STATUS_FIN_CLIENTE.find((s) => s.value === c.status_financeiro)
            return (
              <div key={c.id} className="bg-white rounded-xl shadow-md p-5">
                <div className="flex justify-between items-start mb-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-bendito-verde-escuro truncate">{c.nome_loja || c.nome}</h3>
                    {c.nome_loja && <p className="text-xs text-gray-500 truncate">{c.nome}</p>}
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-1"><Phone size={11} /> {c.telefone}</p>
                    <div className="flex gap-2 mt-3">
                      {c.telefone && (
                        <a
                          href={`https://wa.me/55${c.telefone.replace(/\D/g, '')}?text=${encodeURIComponent('Olá ' + (c.nome_loja || c.nome) + ', tudo bem? Passando para verificar se precisa de alguma coisa da Bendito Lanches.')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MessageCircle size={13} /> WhatsApp
                        </a>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); window.location.href = '/vendedor/pedidos/novo?cliente=' + c.id }}
                        className="flex items-center gap-1.5 bg-bendito-dourado hover:bg-bendito-dourado-escuro text-bendito-verde-escuro text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                      >
                        <ShoppingCart size={13} /> Novo pedido
                      </button>
                    </div>
                  </div>
                  {fin && <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${fin.cor}`}>{fin.label}</span>}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  <div className="bg-bendito-creme rounded p-2">
                    <p className="text-xs text-gray-500">Pedido mín.</p>
                    <p className="font-bold text-bendito-verde-escuro">{formatBRL(c.pedido_minimo)}</p>
                  </div>
                  <div className="bg-bendito-creme rounded p-2">
                    <p className="text-xs text-gray-500">Em aberto</p>
                    <p className={`font-bold ${Number(c.valor_em_aberto) > 0 ? 'text-red-600' : 'text-bendito-verde-escuro'}`}>
                      {formatBRL(c.valor_em_aberto)}
                    </p>
                  </div>
                </div>
                <button onClick={() => abrirEdicao(c)} className="w-full flex items-center justify-center gap-1 bg-bendito-dourado/20 hover:bg-bendito-dourado/40 text-bendito-verde-escuro font-semibold py-2 rounded-lg text-sm">
                  <Edit size={14} /> Editar
                </button>
              </div>
            )
          })}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editando ? 'Editar Cliente' : 'Novo Cliente'} maxWidth="max-w-2xl">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Razão social/Nome" required><Input value={form.nome || ''} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></Field>
            <Field label="Nome da loja"><Input value={form.nome_loja || ''} onChange={(e) => setForm({ ...form, nome_loja: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="CPF/CNPJ"><Input value={form.cpf_cnpj || ''} onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value })} /></Field>
            <Field label="Telefone" required><Input value={form.telefone || ''} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="E-mail"><Input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Tipo"><Select value={form.tipo || 'atacado'} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>{TIPO_CLIENTE.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select></Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="CEP"><Input value={form.cep || ''} onChange={(e) => setForm({ ...form, cep: e.target.value })} /></Field>
            <div className="col-span-2"><Field label="Logradouro"><Input value={form.logradouro || ''} onChange={(e) => setForm({ ...form, logradouro: e.target.value })} /></Field></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Número"><Input value={form.numero || ''} onChange={(e) => setForm({ ...form, numero: e.target.value })} /></Field>
            <Field label="Bairro"><Input value={form.bairro || ''} onChange={(e) => setForm({ ...form, bairro: e.target.value })} /></Field>
            <Field label="Cidade/UF"><Input value={`${form.cidade || ''}/${form.uf || ''}`} readOnly className="bg-gray-50" /></Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Pedido mínimo (R$)"><Input type="number" step="0.01" value={form.pedido_minimo ?? 0} onChange={(e) => setForm({ ...form, pedido_minimo: e.target.value })} /></Field>
            <Field label="Limite de crédito (R$)"><Input type="number" step="0.01" value={form.limite_credito ?? 0} onChange={(e) => setForm({ ...form, limite_credito: e.target.value })} /></Field>
          </div>
          <Field label="Observação de entrega"><Textarea rows={2} value={form.observacao_entrega || ''} onChange={(e) => setForm({ ...form, observacao_entrega: e.target.value })} /></Field>
          <div className="flex gap-3 pt-2">
            <SecondaryButton onClick={() => setModalOpen(false)} className="flex-1">Cancelar</SecondaryButton>
            <PrimaryButton onClick={salvar} disabled={salvando || !form.nome || !form.telefone} className="flex-1">{salvando ? 'Salvando...' : 'Salvar'}</PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
