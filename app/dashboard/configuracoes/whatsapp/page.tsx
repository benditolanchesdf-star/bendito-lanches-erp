'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FILIAL_ID } from '@/lib/constants'
import Modal from '@/components/Modal'
import { Field, Input, Select, PrimaryButton, SecondaryButton, PageHeader, Loading, EmptyState } from '@/components/ui'
import { Plus, Edit, Trash2, MessageSquare, AlertTriangle, CheckCircle2, Send } from 'lucide-react'

interface Destino {
  id: string
  nome: string
  numero: string
  filial_id: string | null
  recebe_pedido_novo: boolean
  ativo: boolean
}

export default function WhatsAppDestinosPage() {
  const supabase = createClient()
  const [destinos, setDestinos] = useState<Destino[]>([])
  const [filiais, setFiliais] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<Destino | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState<any>({})
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function load() {
    setLoading(true)
    const [d, f] = await Promise.all([
      supabase.from('whatsapp_destinos').select('*').order('created_at', { ascending: false }),
      supabase.from('filiais').select('id, nome').eq('ativo', true).order('nome'),
    ])
    setDestinos(d.data || [])
    setFiliais(f.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!feedback) return
    const t = setTimeout(() => setFeedback(null), 5000)
    return () => clearTimeout(t)
  }, [feedback])

  function abrirNovo() {
    setEditando(null)
    setForm({ nome: '', numero: '', filial_id: '', recebe_pedido_novo: true, ativo: true })
    setModalOpen(true)
  }
  function abrirEdicao(d: Destino) {
    setEditando(d)
    setForm({ ...d, filial_id: d.filial_id || '' })
    setModalOpen(true)
  }

  async function salvar() {
    // Sanitiza número: só dígitos
    const numeroLimpo = (form.numero || '').replace(/\D/g, '')
    if (numeroLimpo.length < 10) {
      setFeedback({ type: 'error', text: 'Número inválido. Use formato 5561999999999 (com DDI e DDD).' })
      return
    }
    setSalvando(true)
    const payload = {
      nome: form.nome,
      numero: numeroLimpo,
      filial_id: form.filial_id || null,
      recebe_pedido_novo: !!form.recebe_pedido_novo,
      ativo: !!form.ativo,
    }
    if (editando) {
      const { error } = await supabase.from('whatsapp_destinos').update(payload).eq('id', editando.id).select()
      if (error) { setFeedback({ type: 'error', text: error.message }); setSalvando(false); return }
    } else {
      const { error } = await supabase.from('whatsapp_destinos').insert(payload).select()
      if (error) { setFeedback({ type: 'error', text: error.message }); setSalvando(false); return }
    }
    setFeedback({ type: 'success', text: 'Salvo.' })
    setModalOpen(false); setSalvando(false); load()
  }

  async function excluir(d: Destino) {
    if (!confirm(`Excluir "${d.nome}"?`)) return
    const { error, data } = await supabase.from('whatsapp_destinos').delete().eq('id', d.id).select()
    if (error || !data?.length) {
      setFeedback({ type: 'error', text: error?.message || 'Nada foi excluído (permissão?)' })
      return
    }
    setFeedback({ type: 'success', text: 'Destino excluído.' })
    load()
  }

  // Dispara processamento da fila pendente manualmente
  async function processarFila() {
    setFeedback(null)
    try {
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/enviar-whatsapp-pedido`
      const r = await fetch(url, { method: 'POST' })
      const data = await r.json()
      if (!r.ok) throw new Error(JSON.stringify(data))
      setFeedback({ type: 'success', text: `Fila processada: ${data.processados ?? 0} notificações.` })
    } catch (e: any) {
      setFeedback({ type: 'error', text: 'Erro: ' + e.message })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="WhatsApp — Destinos"
        subtitle="Números cadastrados para receber notificações de pedidos"
        action={
          <div className="flex gap-2">
            <SecondaryButton onClick={processarFila} className="flex items-center gap-2"><Send size={16} /> Processar fila</SecondaryButton>
            <PrimaryButton onClick={abrirNovo} className="flex items-center gap-2"><Plus size={20} /> Novo destino</PrimaryButton>
          </div>
        }
      />

      {feedback && (
        <div className={`rounded-xl p-4 border ${feedback.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          <div className="flex items-start gap-2">
            {feedback.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
            <p className="text-sm">{feedback.text}</p>
          </div>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
        <p className="font-semibold mb-1">⚙️ Configuração da Z-API</p>
        <p>Para o envio funcionar, configure os secrets da Edge Function no painel Supabase:</p>
        <ul className="list-disc ml-5 mt-1">
          <li><code>ZAPI_INSTANCE_ID</code> — ID da instância</li>
          <li><code>ZAPI_TOKEN</code> — Token da instância</li>
          <li><code>ZAPI_CLIENT_TOKEN</code> — Client-Token (opcional, se exigido pela conta)</li>
        </ul>
      </div>

      {loading ? <Loading /> : destinos.length === 0 ? (
        <EmptyState message="Nenhum destino cadastrado. Adicione um número para começar a receber notificações." />
      ) : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3 font-semibold text-gray-700">Nome</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Número</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Filial</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Pedido novo</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Ativo</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {destinos.map((d) => {
                const filial = filiais.find((f) => f.id === d.filial_id)
                return (
                  <tr key={d.id}>
                    <td className="px-4 py-3"><MessageSquare size={14} className="inline mr-2 text-green-600" />{d.nome}</td>
                    <td className="px-4 py-3 font-mono text-xs">{d.numero}</td>
                    <td className="px-4 py-3">{filial?.nome || <span className="text-gray-400">Todas</span>}</td>
                    <td className="px-4 py-3">{d.recebe_pedido_novo ? '✅' : '—'}</td>
                    <td className="px-4 py-3">{d.ativo ? '✅' : <span className="text-red-500">❌</span>}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => abrirEdicao(d)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded mr-1"><Edit size={15} /></button>
                      <button onClick={() => excluir(d)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={15} /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editando ? 'Editar destino' : 'Novo destino'}>
        <div className="space-y-4">
          <Field label="Nome do destinatário" required>
            <Input value={form.nome || ''} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Gerente Matriz" />
          </Field>
          <Field label="Número WhatsApp (com DDI e DDD, só dígitos)" required>
            <Input value={form.numero || ''} onChange={(e) => setForm({ ...form, numero: e.target.value })} placeholder="5561999999999" />
          </Field>
          <Field label="Filial">
            <Select value={form.filial_id || ''} onChange={(e) => setForm({ ...form, filial_id: e.target.value })}>
              <option value="">Todas as filiais (global)</option>
              {filiais.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!form.recebe_pedido_novo} onChange={(e) => setForm({ ...form, recebe_pedido_novo: e.target.checked })} />
              Receber pedidos novos
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
              Ativo
            </label>
          </div>
          <div className="flex gap-3 pt-2">
            <SecondaryButton onClick={() => setModalOpen(false)} className="flex-1">Cancelar</SecondaryButton>
            <PrimaryButton onClick={salvar} disabled={salvando || !form.nome || !form.numero} className="flex-1">{salvando ? 'Salvando...' : 'Salvar'}</PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
