'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { STATUS_FIN_CLIENTE, formatBRL, formatData } from '@/lib/constants'
import { Field, Input, Textarea, PrimaryButton, PageHeader, Loading, StatusBadge } from '@/components/ui'
import { Store, Phone, MapPin, AlertTriangle, CheckCircle, MessageCircle } from 'lucide-react'

export default function DadosLojaPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [cliente, setCliente] = useState<any>(null)
  const [vendedor, setVendedor] = useState<any>(null)
  const [sucesso, setSucesso] = useState(false)

  const [form, setForm] = useState({
    nome_loja: '',
    telefone: '',
    email: '',
    logradouro: '',
    numero: '',
    bairro: '',
    cidade: '',
    cep: '',
    observacao_entrega: '',
  })

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('cliente_id').eq('id', user!.id).maybeSingle()
    if (!profile?.cliente_id) { setLoading(false); return }

    const { data: c } = await supabase
      .from('clientes')
      .select('*, vendedores(nome, telefone)')
      .eq('id', profile.cliente_id)
      .single()

    setCliente(c)
    setVendedor(c?.vendedores || null)
    setForm({
      nome_loja: c?.nome_loja || '',
      telefone: c?.telefone || '',
      email: c?.email || '',
      logradouro: c?.logradouro || '',
      numero: c?.numero || '',
      bairro: c?.bairro || '',
      cidade: c?.cidade || 'Brasília',
      cep: c?.cep || '',
      observacao_entrega: c?.observacao_entrega || '',
    })
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const f = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  async function salvar() {
    setSalvando(true)
    const { error } = await supabase.from('clientes').update({
      nome_loja: form.nome_loja || null,
      telefone: form.telefone,
      email: form.email || null,
      logradouro: form.logradouro || null,
      numero: form.numero || null,
      bairro: form.bairro || null,
      cidade: form.cidade || null,
      cep: form.cep || null,
      observacao_entrega: form.observacao_entrega || null,
    }).eq('id', cliente.id)

    setSalvando(false)
    if (error) { alert('Erro ao salvar: ' + error.message); return }
    setSucesso(true)
    setTimeout(() => setSucesso(false), 3000)
    load()
  }

  if (loading) return <Loading />
  if (!cliente) return <div className="bg-white rounded-xl p-8 text-center text-gray-500">Dados do cliente não encontrados.</div>

  const statusFin = STATUS_FIN_CLIENTE.find((s) => s.value === cliente.status_financeiro)

  return (
    <div className="space-y-6">
      <PageHeader title="Dados da Loja" subtitle="Mantenha suas informações de entrega atualizadas" />

      {/* Status financeiro e alertas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-md p-5 flex items-center gap-3">
          <Store size={28} className="text-bendito-dourado flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-500">Nome da loja</p>
            <p className="font-bold text-bendito-verde-escuro">{cliente.nome_loja || cliente.nome}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-5 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-xs text-gray-500 mb-1">Status financeiro</p>
            {statusFin && <StatusBadge label={statusFin.label} cor={statusFin.cor} />}
            {cliente.valor_em_aberto > 0 && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <AlertTriangle size={12} /> Em aberto: {formatBRL(cliente.valor_em_aberto)}
              </p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-5 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-xs text-gray-500">Pedido mínimo</p>
            <p className="font-bold text-bendito-verde-escuro">
              {Number(cliente.pedido_minimo) > 0 ? formatBRL(cliente.pedido_minimo) : 'Sem mínimo'}
            </p>
            {cliente.ultimo_pedido_at && (
              <p className="text-xs text-gray-400 mt-0.5">Último pedido: {formatData(cliente.ultimo_pedido_at)}</p>
            )}
          </div>
        </div>
      </div>

      {/* Contato do vendedor */}
      {vendedor && (
        <div className="bg-bendito-verde/5 border border-bendito-verde/20 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-bendito-verde flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {vendedor.nome?.charAt(0) || 'V'}
            </div>
            <div>
              <p className="text-sm font-semibold text-bendito-verde-escuro">Seu vendedor responsável</p>
              <p className="text-sm text-gray-600">{vendedor.nome}</p>
            </div>
          </div>
          {vendedor.telefone && (
            <a
              href={`https://wa.me/55${vendedor.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${vendedor.nome}, sou ${cliente.nome_loja || cliente.nome}.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold px-4 py-2 rounded-lg transition text-sm"
            >
              <MessageCircle size={16} /> WhatsApp
            </a>
          )}
        </div>
      )}

      {/* Formulário de dados */}
      <div className="bg-white rounded-xl shadow-md p-6 space-y-5">
        <h2 className="font-bold text-bendito-verde-escuro flex items-center gap-2">
          <Store size={18} /> Dados cadastrais
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nome da loja">
            <Input value={form.nome_loja} onChange={f('nome_loja')} placeholder="Nome fantasia da sua loja" />
          </Field>
          <Field label="Telefone / WhatsApp">
            <Input value={form.telefone} onChange={f('telefone')} placeholder="(61) 9xxxx-xxxx" />
          </Field>
          <Field label="E-mail">
            <Input type="email" value={form.email} onChange={f('email')} placeholder="email@loja.com.br" />
          </Field>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6 space-y-5">
        <h2 className="font-bold text-bendito-verde-escuro flex items-center gap-2">
          <MapPin size={18} /> Endereço de entrega
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Logradouro" >
            <Input value={form.logradouro} onChange={f('logradouro')} placeholder="Rua, Av, QD..." className="md:col-span-2" />
          </Field>
          <Field label="Número">
            <Input value={form.numero} onChange={f('numero')} placeholder="123" />
          </Field>
          <Field label="CEP">
            <Input value={form.cep} onChange={f('cep')} placeholder="70000-000" />
          </Field>
          <Field label="Bairro">
            <Input value={form.bairro} onChange={f('bairro')} placeholder="Bairro" />
          </Field>
          <Field label="Cidade">
            <Input value={form.cidade} onChange={f('cidade')} placeholder="Brasília" />
          </Field>
        </div>

        <Field label="Observação de entrega">
          <Textarea
            rows={2}
            value={form.observacao_entrega}
            onChange={f('observacao_entrega')}
            placeholder="Ex: Entregar no depósito nos fundos, tocar o interfone 3x, não deixar com porteiro..."
          />
        </Field>
      </div>

      <div className="flex items-center gap-4">
        <PrimaryButton onClick={salvar} disabled={salvando} className="flex items-center gap-2">
          {salvando ? 'Salvando...' : 'Salvar dados'}
        </PrimaryButton>
        {sucesso && (
          <span className="flex items-center gap-1 text-green-600 text-sm font-semibold">
            <CheckCircle size={16} /> Dados salvos com sucesso!
          </span>
        )}
      </div>
    </div>
  )
}
