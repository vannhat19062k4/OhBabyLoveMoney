import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { parseGmailTransaction, type GmailMessage } from '@/lib/gmail-parser';

export const dynamic = 'force-dynamic';

async function refreshGoogleAccessToken(refreshToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return { error: 'Vercel chưa có GOOGLE_CLIENT_ID và GOOGLE_CLIENT_SECRET để tự gia hạn Gmail.' } as const;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
    cache: 'no-store',
  });
  if (!response.ok) return { error: 'Refresh token Google không còn hiệu lực. Cần cấp lại quyền Gmail một lần.' } as const;
  const data = await response.json() as { access_token?: string; expires_in?: number };
  return data.access_token ? { accessToken: data.access_token, expiresIn: data.expires_in ?? 3600 } as const : { error: 'Google không trả về access token mới.' } as const;
}

export async function POST() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return NextResponse.json({ error: 'Supabase chưa được cấu hình.' }, { status: 503 });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => undefined,
    },
  });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Phiên đăng nhập đã hết hạn.' }, { status: 401 });

  let providerToken = cookieStore.get('ohbaby-google-token')?.value;
  const refreshToken = cookieStore.get('ohbaby-google-refresh-token')?.value;
  let refreshedExpiresIn: number | null = null;

  if (!providerToken && refreshToken) {
    const refreshed = await refreshGoogleAccessToken(refreshToken);
    if ('error' in refreshed) return NextResponse.json({ code: 'GMAIL_REFRESH_FAILED', error: refreshed.error }, { status: 401 });
    providerToken = refreshed.accessToken;
    refreshedExpiresIn = refreshed.expiresIn;
  }
  if (!providerToken) return NextResponse.json({ error: 'Chưa có quyền Gmail dài hạn. Nhấn “Cấp lại quyền Gmail” một lần.' }, { status: 401 });

  let tokenInfoResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(providerToken)}`, { cache: 'no-store' });
  if (!tokenInfoResponse.ok && refreshToken) {
    const refreshed = await refreshGoogleAccessToken(refreshToken);
    if ('error' in refreshed) return NextResponse.json({ code: 'GMAIL_REFRESH_FAILED', error: refreshed.error }, { status: 401 });
    providerToken = refreshed.accessToken;
    refreshedExpiresIn = refreshed.expiresIn;
    tokenInfoResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(providerToken)}`, { cache: 'no-store' });
  }
  const tokenInfo = tokenInfoResponse.ok ? await tokenInfoResponse.json() as { scope?: string } : null;
  if (!tokenInfo?.scope?.split(' ').includes('https://www.googleapis.com/auth/gmail.readonly')) {
    return NextResponse.json({ code: 'GMAIL_SCOPE_MISSING', error: 'Token Google hiện tại chưa có quyền gmail.readonly. Nhấn “Cấp lại quyền Gmail” rồi chọn Cho phép.' }, { status: 403 });
  }

  const listUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
  listUrl.searchParams.set('maxResults', '100');
  listUrl.searchParams.set('q', 'newer_than:90d (TPBank OR Techcombank OR Vietcombank OR MoMo OR M_Service)');
  const headers = { Authorization: `Bearer ${providerToken}` };
  const listResponse = await fetch(listUrl, { headers, cache: 'no-store' });
  if (!listResponse.ok) {
    const status = listResponse.status;
    const details = await listResponse.json().catch(() => null) as { error?: { message?: string; errors?: Array<{ reason?: string }> } } | null;
    const reason = details?.error?.errors?.[0]?.reason ?? '';
    const message = details?.error?.message ?? '';
    if (status === 403 && (reason === 'accessNotConfigured' || /has not been used|is disabled/i.test(message))) {
      return NextResponse.json({ code: 'GMAIL_API_DISABLED', error: 'Gmail API chưa được bật trong đúng Google Cloud project của OAuth Client. Hãy bật Gmail API trong project đang chứa Client ID.' }, { status });
    }
    if (status === 403 && (reason === 'insufficientPermissions' || /insufficient.*scope|permission/i.test(message))) {
      return NextResponse.json({ code: 'GMAIL_SCOPE_MISSING', error: 'Google đã đăng nhập nhưng access token chưa có quyền gmail.readonly. Hãy cấp lại quyền Gmail.' }, { status });
    }
    return NextResponse.json({ code: 'GMAIL_API_ERROR', error: status === 401 ? 'Quyền Gmail đã hết hạn. Hãy cấp lại quyền Gmail.' : `Gmail API từ chối yêu cầu${message ? `: ${message}` : '.'}` }, { status });
  }

  const list = await listResponse.json() as { messages?: Array<{ id: string }> };
  const messages = await Promise.all((list.messages ?? []).map(async ({ id }) => {
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, { headers, cache: 'no-store' });
    return response.ok ? await response.json() as GmailMessage : null;
  }));
  const drafts = messages.flatMap((message) => {
    const draft = message ? parseGmailTransaction(message) : null;
    return draft ? [draft] : [];
  });
  const result = NextResponse.json({ drafts });
  if (refreshedExpiresIn) {
    result.cookies.set('ohbaby-google-token', providerToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: Math.max(60, refreshedExpiresIn - 60),
    });
  }
  return result;
}
