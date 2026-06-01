import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname
  const isAuthPath = path.startsWith('/login') || path.startsWith('/auth')

  // Sem usuário → manda para /login (exceto se já estiver lá)
  if (!user && !isAuthPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Com usuário, verifica papel e protege áreas cruzadas
  if (user && !isAuthPath) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('papel')
      .eq('id', user.id)
      .maybeSingle()

    const papel = profile?.papel ?? 'cliente'

    // Bloqueia acessos cruzados
    if (path.startsWith('/dashboard') && papel !== 'admin' && papel !== 'matriz') {
      const url = request.nextUrl.clone()
      url.pathname = papel === 'vendedor' ? '/vendedor' : '/cliente'
      return NextResponse.redirect(url)
    }
    if (path.startsWith('/vendedor') && papel !== 'vendedor' && papel !== 'admin' && papel !== 'matriz') {
      const url = request.nextUrl.clone()
      url.pathname = '/cliente'
      return NextResponse.redirect(url)
    }
    if (path.startsWith('/cliente') && papel !== 'cliente' && papel !== 'admin' && papel !== 'matriz') {
      const url = request.nextUrl.clone()
      url.pathname = papel === 'vendedor' ? '/vendedor' : '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
