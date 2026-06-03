import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { nome, email, senha, papel, filial_id } = await request.json()

    if (!nome || !email || !senha) {
      return NextResponse.json({ error: 'Nome, email e senha são obrigatórios.' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verificar se quem está chamando é admin
    const authHeader = request.headers.get('Authorization')
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user } } = await supabaseAdmin.auth.getUser(token)
      if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
      const { data: profile } = await supabaseAdmin
        .from('profiles').select('papel').eq('id', user.id).maybeSingle()
      if (!['admin', 'matriz'].includes(profile?.papel || '')) {
        return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
      }
    }

    // Criar usuário no Auth
    const { data: novoUser, error: errUser } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome },
    })

    if (errUser || !novoUser.user) {
      return NextResponse.json({ error: errUser?.message || 'Erro ao criar usuário.' }, { status: 400 })
    }

    const userId = novoUser.user.id
    const filialFinal = filial_id || '11111111-1111-1111-1111-111111111111'

    // Criar profile
    await supabaseAdmin.from('profiles').upsert({
      id: userId, nome, papel, filial_id: filialFinal, ativo: true,
    })

    // Criar papel inicial
    await supabaseAdmin.from('usuario_papeis').insert({
      user_id: userId, papel, filial_id: filial_id || null,
    })

    // Se for vendedor, criar registro em vendedores
    if (papel === 'vendedor') {
      await supabaseAdmin.from('vendedores').insert({
        nome, usuario_id: userId, filial_id: filialFinal, ativo: true,
      })
    }

    // Criar registro em public.usuarios (compatibilidade) — upsert sem .on()
    const { data: usuarioExiste } = await supabaseAdmin
      .from('usuarios').select('id').eq('email', email).maybeSingle()

    if (!usuarioExiste) {
      await supabaseAdmin.from('usuarios').insert({
        id: userId, nome, email,
        perfil: papel, ativo: true, filial_id: filialFinal,
      })
    }

    return NextResponse.json({ success: true, userId })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
