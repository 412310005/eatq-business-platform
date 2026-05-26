import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({ email: '', password: '' }))
  const demoEmail = process.env.DEMO_ADMIN_EMAIL
  const demoPassword = process.env.DEMO_ADMIN_PASSWORD

  const ok = Boolean(demoEmail && demoPassword && email === demoEmail && password === demoPassword)

  if (!ok) {
    return NextResponse.json({ error: '帳號或密碼錯誤' }, { status: 401 })
  }

  return NextResponse.json({ ok: true })
}
