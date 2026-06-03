import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Rota server-side para criar usuário com service_role (necessário para criar auth.users)
export async function POST(request: NextRequest) {
  try {
    const { nome, email, senha, papel, filial_id } = await request.json()

    if (!nome || !email || !senha) {
      return NextResponse.json({ error: 'Nome, email e senha são obrigatórios.' }, { status: 400 })
    }

    // Usar service_role para criar usuários (só disponível server-side)
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
      if (!['admin','matriz'].includes(profile?.papel || '')) {
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

    // Criar profile
    await supabaseAdmin.from('profiles').upsert({
      id: userId,
      nome,
      papel,
      filial_id: filial_id || null,
      ativo: true,
    })

    // Criar papel inicial
    await supabaseAdmin.from('usuario_papeis').insert({
      user_id: userId,
      papel,
      filial_id: filial_id || null,
    })

    // Se for vendedor, criar registro em vendedores
    if (papel === 'vendedor') {
      await supabaseAdmin.from('vendedores').insert({
        nome,
        usuario_id: userId,
        filial_id: filial_id || '11111111-1111-1111-1111-111111111111',
        ativo: true,
      })
    }

    // Criar registro em public.usuarios (compatibilidade)
    await supabaseAdmin.from('usuarios').upsert({
      id: userId,
      nome,
      email,
      perfil: papel,
      ativo: true,
      filial_id: filial_id || '11111111-1111-1111-1111-111111111111',
    }).on('conflict', 'email').ignore()

    return NextResponse.json({ success: true, userId })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
