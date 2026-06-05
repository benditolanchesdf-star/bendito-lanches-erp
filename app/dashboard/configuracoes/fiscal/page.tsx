'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader, Loading, Field, Input, PrimaryButton, SecondaryButton } from '@/components/ui'
import { FileText, Shield, Printer, CheckCircle, AlertTriangle, Eye, EyeOff } from 'lucide-react'

export default function ConfigFiscalPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [filiais, setFiliais] = useState<any[]>([])
  const [filialSel, setFilialSel] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState<any>({
    cnpj: '', inscricao_estadual: '', inscricao_municipal: '',
    regime_tributario: 'simples',
    certificado_base64: '', certificado_senha: '', certificado_validade: '',
    csc_id: '', csc_token: '',
    ambiente_nfce: 'homologacao', serie_nfce: 1, numero_inicial_nfce: 1,
    ambiente_nfe: 'homologacao', serie_nfe: 1, numero_inicial_nfe: 1,
    api_fiscal_provedor: 'focus', api_fiscal_token: '', api_fiscal_url: '',
    impressora_tipo: 'browser', impressora_ip: '', impressora_porta: 9100,
    logradouro: '', numero: '', complemento: '', bairro: '',
    municipio: 'Brasília', uf: 'DF', cep: '', codigo_municipio: '5300108',
    telefone: '', email: '',
    nome_contador: '', cpf_cnpj_contador: '',
  })

  async function load(fid?: string) {
    setLoading(true)
    const { data: fils } = await supabase.from('filiais').select('id, nome').eq('ativo', true)
    setFiliais(fils || [])
    const filialId = fid || filialSel || fils?.[0]?.id || ''
    if (!filialSel && fils?.[0]?.id) setFilialSel(fils[0].id)
    if (!filialId) { setLoading(false); return }

    const { data: cfg } = await supabase.from('config_fiscal').select('*').eq('filial_id', filialId).maybeSingle()
    if (cfg) {
      setForm((prev: any) => ({ ...prev, ...cfg }))
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [])
  useEffect(() => { if (filialSel) load(filialSel) }, [filialSel])

  async function salvar() {
    if (!filialSel) return
    setSalvando(true)
    await supabase.from('config_fiscal').upsert({
      ...form,
      filial_id: filialSel,
      serie_nfce: Number(form.serie_nfce) || 1,
      numero_inicial_nfce: Number(form.numero_inicial_nfce) || 1,
      serie_nfe: Number(form.serie_nfe) || 1,
      numero_inicial_nfe: Number(form.numero_inicial_nfe) || 1,
      impressora_porta: Number(form.impressora_porta) || 9100,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'filial_id' })
    setSalvando(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  // Upload certificado A1
  async function uploadCertificado(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const base64 = (e.target?.result as string).split(',')[1]
      setForm((prev: any) => ({ ...prev, certificado_base64: base64 }))
    }
    reader.readAsDataURL(file)
  }

  const certValidade = form.certificado_validade
    ? new Date(form.certificado_validade)
    : null
  const certVencido = certValidade && certValidade < new Date()
  const certVenceEm30 = certValidade && !certVencido && (certValidade.getTime() - Date.now()) < 30 * 86400000

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <PageHeader title="Configuração Fiscal" subtitle="Dados da empresa, certificado digital, NFC-e e impressão"/>

      {/* Seletor de filial */}
      <div className="bg-white rounded-xl shadow-md p-4 flex gap-3 items-center flex-wrap">
        <span className="text-sm font-semibold text-gray-700">Unidade:</span>
        {filiais.map(f => (
          <button key={f.id} onClick={() => setFilialSel(f.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border transition ${filialSel === f.id ? 'bg-bendito-verde text-white border-bendito-verde' : 'bg-white border-gray-300 text-gray-600 hover:border-bendito-verde'}`}>
            {f.nome}
          </button>
        ))}
      </div>

      {/* Status geral */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'CNPJ',         ok: !!form.cnpj,               icone: '🏢' },
          { label: 'Certificado',  ok: !!form.certificado_base64,  icone: '🔐' },
          { label: 'CSC/Token',    ok: !!form.csc_token,           icone: '🔑' },
          { label: 'API Fiscal',   ok: !!form.api_fiscal_token,    icone: '☁️' },
        ].map(c => (
          <div key={c.label} className={`rounded-xl p-3 border text-center ${c.ok ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
            <p className="text-xl mb-1">{c.icone}</p>
            <p className="text-xs font-semibold text-gray-700">{c.label}</p>
            {c.ok
              ? <p className="text-xs text-green-600 flex items-center justify-center gap-1 mt-0.5"><CheckCircle size={11}/> Configurado</p>
              : <p className="text-xs text-orange-600 flex items-center justify-center gap-1 mt-0.5"><AlertTriangle size={11}/> Pendente</p>
            }
          </div>
        ))}
      </div>

      {/* ── Dados da empresa ── */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="px-5 py-4 border-b bg-gray-50 flex items-center gap-2">
          <FileText size={18} className="text-bendito-verde"/>
          <h2 className="font-bold text-bendito-verde-escuro">Dados da Empresa</h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="CNPJ *">
              <Input value={form.cnpj} onChange={e => setForm({...form, cnpj: e.target.value})} placeholder="00.000.000/0001-00"/>
            </Field>
            <Field label="Inscrição Estadual">
              <Input value={form.inscricao_estadual} onChange={e => setForm({...form, inscricao_estadual: e.target.value})} placeholder="Ex: 07.123.456/001-23"/>
            </Field>
            <Field label="Regime Tributário">
              <select value={form.regime_tributario} onChange={e => setForm({...form, regime_tributario: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                <option value="simples">Simples Nacional</option>
                <option value="lucro_presumido">Lucro Presumido</option>
                <option value="lucro_real">Lucro Real</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Logradouro">
              <Input value={form.logradouro} onChange={e => setForm({...form, logradouro: e.target.value})} placeholder="Rua, Av, Quadra..."/>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Número">
                <Input value={form.numero} onChange={e => setForm({...form, numero: e.target.value})} placeholder="Ex: 123"/>
              </Field>
              <Field label="CEP">
                <Input value={form.cep} onChange={e => setForm({...form, cep: e.target.value})} placeholder="70000-000"/>
              </Field>
            </div>
            <Field label="Bairro">
              <Input value={form.bairro} onChange={e => setForm({...form, bairro: e.target.value})} placeholder="Bairro"/>
            </Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Telefone">
              <Input value={form.telefone} onChange={e => setForm({...form, telefone: e.target.value})} placeholder="(61) 3xxx-xxxx"/>
            </Field>
            <Field label="E-mail fiscal">
              <Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="fiscal@empresa.com"/>
            </Field>
            <Field label="Município / UF">
              <div className="flex gap-2">
                <Input value={form.municipio} onChange={e => setForm({...form, municipio: e.target.value})} placeholder="Brasília" className="flex-1"/>
                <Input value={form.uf} onChange={e => setForm({...form, uf: e.target.value.toUpperCase().slice(0,2)})} placeholder="DF" className="w-14 text-center"/>
              </div>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nome do contador">
              <Input value={form.nome_contador} onChange={e => setForm({...form, nome_contador: e.target.value})} placeholder="Nome completo"/>
            </Field>
            <Field label="CPF/CNPJ do contador">
              <Input value={form.cpf_cnpj_contador} onChange={e => setForm({...form, cpf_cnpj_contador: e.target.value})} placeholder="000.000.000-00"/>
            </Field>
          </div>
        </div>
      </div>

      {/* ── Certificado Digital A1 ── */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="px-5 py-4 border-b bg-gray-50 flex items-center gap-2">
          <Shield size={18} className="text-blue-600"/>
          <h2 className="font-bold text-bendito-verde-escuro">Certificado Digital A1</h2>
        </div>
        <div className="p-5 space-y-4">
          {certVencido && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 flex items-center gap-2">
              <AlertTriangle size={16}/> Certificado digital VENCIDO em {certValidade?.toLocaleDateString('pt-BR')}. Renove imediatamente.
            </div>
          )}
          {certVenceEm30 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-700 flex items-center gap-2">
              <AlertTriangle size={16}/> Certificado vence em {certValidade?.toLocaleDateString('pt-BR')}. Providencie a renovação.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Arquivo .PFX (Certificado A1)</label>
              <label className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-xl p-4 cursor-pointer transition
                ${form.certificado_base64 ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-bendito-verde bg-gray-50'}`}>
                <input type="file" accept=".pfx,.p12" className="hidden"
                  onChange={e => e.target.files?.[0] && uploadCertificado(e.target.files[0])}/>
                <Shield size={20} className={form.certificado_base64 ? 'text-green-600' : 'text-gray-400'}/>
                <span className={`text-sm font-medium ${form.certificado_base64 ? 'text-green-700' : 'text-gray-500'}`}>
                  {form.certificado_base64 ? '✅ Certificado carregado' : 'Clique para carregar o .PFX'}
                </span>
              </label>
            </div>
            <div className="space-y-3">
              <Field label="Senha do certificado">
                <div className="relative">
                  <Input type={showSenha ? 'text' : 'password'} value={form.certificado_senha}
                    onChange={e => setForm({...form, certificado_senha: e.target.value})} placeholder="Senha do .PFX"/>
                  <button onClick={() => setShowSenha(!showSenha)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showSenha ? <EyeOff size={15}/> : <Eye size={15}/>}
                  </button>
                </div>
              </Field>
              <Field label="Validade do certificado">
                <Input type="date" value={form.certificado_validade}
                  onChange={e => setForm({...form, certificado_validade: e.target.value})}/>
              </Field>
            </div>
          </div>
        </div>
      </div>

      {/* ── NFC-e ── */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="px-5 py-4 border-b bg-gray-50 flex items-center gap-2">
          <FileText size={18} className="text-purple-600"/>
          <h2 className="font-bold text-bendito-verde-escuro">NFC-e (Nota Fiscal Consumidor Eletrônica)</h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Ambiente">
              <select value={form.ambiente_nfce} onChange={e => setForm({...form, ambiente_nfce: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                <option value="homologacao">🧪 Homologação (testes)</option>
                <option value="producao">✅ Produção</option>
              </select>
            </Field>
            <Field label="Série">
              <Input type="number" min={1} value={form.serie_nfce}
                onChange={e => setForm({...form, serie_nfce: e.target.value})}/>
            </Field>
            <Field label="Número inicial">
              <Input type="number" min={1} value={form.numero_inicial_nfce}
                onChange={e => setForm({...form, numero_inicial_nfce: e.target.value})}/>
            </Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="CSC ID (Token NFC-e)">
              <Input value={form.csc_id} onChange={e => setForm({...form, csc_id: e.target.value})} placeholder="Ex: 000001"/>
            </Field>
            <Field label="CSC Token">
              <div className="relative">
                <Input type={showToken ? 'text' : 'password'} value={form.csc_token}
                  onChange={e => setForm({...form, csc_token: e.target.value})}
                  placeholder="Token gerado pelo SEFAZ-DF"/>
                <button onClick={() => setShowToken(!showToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showToken ? <EyeOff size={15}/> : <Eye size={15}/>}
                </button>
              </div>
            </Field>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
            💡 O CSC (Código de Segurança do Contribuinte) é gerado no portal do SEFAZ-DF. Para o DF acesse: <strong>https://www.sefaz.df.gov.br</strong> → Contribuinte → NFC-e → Cadastro CSC.
          </div>
        </div>
      </div>

      {/* ── API Fiscal (provedor terceiro) ── */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="px-5 py-4 border-b bg-gray-50 flex items-center gap-2">
          <Shield size={18} className="text-green-600"/>
          <h2 className="font-bold text-bendito-verde-escuro">API Fiscal (serviço de emissão)</h2>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold ml-1">Recomendado para fase B</span>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Provedor">
              <select value={form.api_fiscal_provedor} onChange={e => setForm({...form, api_fiscal_provedor: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                <option value="focus">Focus NFe (focusnfe.com.br)</option>
                <option value="enotas">eNotas (enotas.io)</option>
                <option value="nfeio">NFe.io (nfe.io)</option>
                <option value="propria">Implementação própria</option>
              </select>
            </Field>
            <Field label="Token / API Key">
              <Input type="password" value={form.api_fiscal_token}
                onChange={e => setForm({...form, api_fiscal_token: e.target.value})} placeholder="Token do provedor"/>
            </Field>
            <Field label="URL da API (se própria)">
              <Input value={form.api_fiscal_url}
                onChange={e => setForm({...form, api_fiscal_url: e.target.value})} placeholder="https://api.exemplo.com"/>
            </Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {[
              { nome: 'Focus NFe', url: 'focusnfe.com.br', preco: 'A partir de R$99/mês', destaque: true },
              { nome: 'eNotas',    url: 'enotas.io',       preco: 'A partir de R$79/mês', destaque: false },
              { nome: 'NFe.io',    url: 'nfe.io',          preco: 'A partir de R$149/mês', destaque: false },
            ].map(p => (
              <div key={p.nome} className={`rounded-xl p-3 border ${p.destaque ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                <p className="font-bold text-gray-700">{p.nome} {p.destaque && <span className="text-green-600 text-xs">★ Recomendado</span>}</p>
                <p className="text-gray-500">{p.url}</p>
                <p className="text-gray-400">{p.preco}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Impressora ── */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="px-5 py-4 border-b bg-gray-50 flex items-center gap-2">
          <Printer size={18} className="text-gray-600"/>
          <h2 className="font-bold text-bendito-verde-escuro">Impressora Térmica</h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Tipo de impressão">
              <select value={form.impressora_tipo} onChange={e => setForm({...form, impressora_tipo: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bendito-dourado">
                <option value="browser">🖨️ Navegador (window.print) — atual</option>
                <option value="rede">🌐 Impressora de rede (IP)</option>
                <option value="usb">🔌 USB (via driver local)</option>
                <option value="bluetooth">📶 Bluetooth</option>
                <option value="smartpos">📱 Smart POS integrado</option>
              </select>
            </Field>
            {form.impressora_tipo === 'rede' && (
              <>
                <Field label="IP da impressora">
                  <Input value={form.impressora_ip} onChange={e => setForm({...form, impressora_ip: e.target.value})} placeholder="192.168.1.100"/>
                </Field>
                <Field label="Porta">
                  <Input type="number" value={form.impressora_porta} onChange={e => setForm({...form, impressora_porta: e.target.value})} placeholder="9100"/>
                </Field>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Botão salvar */}
      <div className="flex items-center gap-3">
        <PrimaryButton onClick={salvar} disabled={salvando || !form.cnpj} className="flex items-center gap-2 px-8">
          {salvando ? 'Salvando...' : '💾 Salvar configurações fiscais'}
        </PrimaryButton>
        {saved && (
          <span className="flex items-center gap-1.5 text-green-600 text-sm font-semibold">
            <CheckCircle size={16}/> Salvo com sucesso!
          </span>
        )}
      </div>
    </div>
  )
}
