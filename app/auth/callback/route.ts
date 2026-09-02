import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') || '/';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!code || !supabaseUrl || !supabaseKey) {
    return NextResponse.redirect(new URL('/?auth_error=configuration', url.origin));
  }

  const cookieStore = await cookies();
  const destination = new URL(next.startsWith('/') ? next : '/', url.origin);
  const response = NextResponse.redirect(destination);
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => values.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
    },
  });
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL('/?auth_error=oauth', url.origin));
  response.cookies.set('ohbaby-google-token', '', { path: '/', maxAge: 0 });
  response.cookies.set('ohbaby-google-refresh-token', '', { path: '/', maxAge: 0 });
  if (data.session?.provider_token) {
    response.cookies.set('ohbaby-google-token', data.session.provider_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 55 * 60,
    });
  }
  if (data.session?.provider_refresh_token) {
    response.cookies.set('ohbaby-google-refresh-token', data.session.provider_refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 365 * 24 * 60 * 60,
    });
  }
  return response;
}
