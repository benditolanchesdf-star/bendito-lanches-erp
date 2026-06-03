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

    const filialFinal = filial_id || '11111111-1111-1111-1111-111111111111'

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

    // Criar profile
    await supabaseAdmin.from('profiles').upsert({
      id: userId, nome, papel, filial_id: filialFinal, ativo: true,
    })

    // Criar papel inicial em usuario_papeis
    await supabaseAdmin.from('usuario_papeis').insert({
      user_id: userId, papel, filial_id: filial_id || null,
    })

    // Se for vendedor, criar registro em vendedores
    if (papel === 'vendedor') {
      await supabaseAdmin.from('vendedores').insert({
        nome, usuario_id: userId, filial_id: filialFinal, ativo: true,
      })
    }

    // Criar registro em public.usuarios (compatibilidade)
    const { data: usuarioExiste } = await supabaseAdmin
      .from('usuarios').select('id').eq('email', email).maybeSingle()

    if (!usuarioExiste) {
      await supabaseAdmin.from('usuarios').insert({
        id: userId, nome, email, perfil: papel, ativo: true, filial_id: filialFinal,
      })
    }

    return NextResponse.json({ success: true, userId })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
