import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { nome, email, senha, papel, filial_id } = await request.json()

    if (!nome || !email || !papel) {
      return NextResponse.json({ error: 'Nome, email e papel são obrigatórios.' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {}
          },
        },
      }
    )

    // Verificar se o usuário logado é admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    // Chamar função SQL SECURITY DEFINER que cria o usuário
    const { data, error } = await supabase.rpc('criar_usuario_admin', {
      p_email: email,
      p_nome: nome,
      p_papel: papel,
      p_filial_id: filial_id || null,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      userId: (data as any)?.userId,
      senha_temporaria: 'Mudar123!',
      message: `Usuário criado! Senha temporária: Mudar123! — o usuário deverá alterá-la no primeiro acesso.`
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
