import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { name, password } = await req.json();
  if (password !== process.env.APP_PASSWORD) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  const maxAge = 60 * 60 * 24 * 30;
  res.cookies.set('vistara_auth', process.env.APP_PASSWORD!, { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge });
  res.cookies.set('vistara_owner', (name || 'user').slice(0, 60), { httpOnly: false, sameSite: 'lax', secure: true, path: '/', maxAge });
  return res;
}
