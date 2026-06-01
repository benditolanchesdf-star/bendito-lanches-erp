'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatBRL, formatData, STATUS_PEDIDO } from '@/lib/constants'
import { PageHeader, Loading } from '@/components/ui'
import { ShoppingCart, Repeat, Clock, Package, Star, Store, MessageCircle } from 'lucide-react'

export default function ClienteHome() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [cliente, setCliente] = useState<any>(null)
  const [vendedor, setVendedor] = useState<any>(null)
  const [ultimoPedido, setUltimoPedido] = useState<any>(null)
  const [historico, setHistorico] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('cliente_id').eq('id', user!.id).maybeSingle()
      if (profile?.cliente_id) {
        const [cli, hist] = await Promise.all([
          supabase.from('clientes').select('*, vendedores(nome, telefone)').eq('id', profile.cliente_id).single(),
          supabase.from('pedidos').select('id, numero_pedido, status, valor_total, data_entrega, created_at').order('created_at', { ascending: false }).limit(5),
        ])
        setCliente(cli.data)
        setVendedor(cli.data?.vendedores || null)
        setHistorico(hist.data || [])
        setUltimoPedido(hist.data?.[0] || null)
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <Loading />

  const nomeLoja = cliente?.nome_loja || cliente?.nome || 'Cliente'

  return (
    <div className="space-y-6">
      <PageHeader title={`Olá, ${nomeLoja}`} subtitle="O que você gostaria de fazer hoje?" />

      {/* Ações principais */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Link href="/cliente/pedido-novo"
          className="bg-bendito-verde text-white rounded-xl shadow-md p-5 hover:shadow-xl transition col-span-2 md:col-span-1">
          <ShoppingCart size={28} className="text-bendito-dourado mb-2" />
          <h3 className="font-bold text-lg">Novo Pedido</h3>
          <p className="text-sm text-bendito-creme mt-0.5">Monte um pedido do zero</p>
        </Link>

        <Link href={ultimoPedido ? `/cliente/pedido-novo?repetir=${ultimoPedido.id}` : '/cliente/pedido-novo'}
          className={`rounded-xl shadow-md p-5 transition ${ultimoPedido ? 'bg-bendito-dourado hover:shadow-xl' : 'bg-gray-200 cursor-not-allowed'}`}>
          <Repeat size={28} className="text-bendito-verde-escuro mb-2" />
          <h3 className="font-bold text-bendito-verde-escuro">Repetir Último</h3>
          <p className="text-xs text-bendito-verde mt-0.5">
            {ultimoPedido ? `#${ultimoPedido.numero_pedido} · ${formatData(ultimoPedido.created_at)}` : 'Nenhum anterior'}
          </p>
        </Link>

        <Link href="/cliente/pedidos" className="bg-white rounded-xl shadow-md p-5 hover:shadow-xl transition">
          <Clock size={28} className="text-bendito-dourado-escuro mb-2" />
          <h3 className="font-bold text-bendito-verde-escuro">Meus Pedidos</h3>
          <p className="text-sm text-gray-500 mt-0.5">Histórico e status</p>
        </Link>

        <Link href="/cliente/favoritos" className="bg-white rounded-xl shadow-md p-5 hover:shadow-xl transition">
          <Star size={28} className="text-bendito-dourado mb-2" fill="currentColor" />
          <h3 className="font-bold text-bendito-verde-escuro">Favoritos</h3>
          <p className="text-sm text-gray-500 mt-0.5">Pedidos recorrentes</p>
        </Link>

        <Link href="/cliente/dados-loja" className="bg-white rounded-xl shadow-md p-5 hover:shadow-xl transition">
          <Store size={28} className="text-gray-500 mb-2" />
          <h3 className="font-bold text-bendito-verde-escuro">Dados da Loja</h3>
          <p className="text-sm text-gray-500 mt-0.5">Endereço e contato</p>
        </Link>
      </div>

      {/* Contato com vendedor */}
      {vendedor?.telefone && (
        <a
          href={`https://wa.me/55${vendedor.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${vendedor.nome}, sou ${nomeLoja}. Preciso de ajuda.`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl p-4 hover:bg-green-100 transition"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
              <MessageCircle size={18} className="text-white" />
            </div>
            <div>
              <p className="font-semibold text-green-800 text-sm">Falar com {vendedor.nome}</p>
              <p className="text-xs text-green-600">Seu vendedor responsável · WhatsApp</p>
            </div>
          </div>
          <span className="text-xs bg-green-500 text-white px-3 py-1 rounded-full font-semibold">Abrir chat</span>
        </a>
      )}

      {/* Últimos pedidos */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-lg font-bold text-bendito-verde-escuro mb-4 flex items-center gap-2">
          <Package size={20} /> Últimos pedidos
        </h2>
        {historico.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">Você ainda não fez nenhum pedido. Clique em "Novo Pedido" para começar.</p>
        ) : (
          <div className="space-y-2">
            {historico.map((p) => {
              const st = STATUS_PEDIDO.find((s) => s.value === p.status)
              return (
                <div key={p.id} className="flex justify-between items-center py-3 border-b last:border-0">
                  <div>
                    <p className="font-semibold">#{p.numero_pedido}</p>
                    <p className="text-xs text-gray-500">
                      {formatData(p.created_at)}{p.data_entrega ? ` · Entrega ${formatData(p.data_entrega)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {st && <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${st.cor}`}>{st.label}</span>}
                    <span className="font-bold text-bendito-verde">{formatBRL(p.valor_total)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
