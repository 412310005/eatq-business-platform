import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  .replace(/(?:\/rest\/v1)+\/?$/i, '')
  .replace(/\/$/, '')
// Use service role key so all reads/writes bypass RLS on this internal CRM
const supabaseKey = process.env.SUPABASE_SERVICE_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function normalizeSupabaseRequest(input: Parameters<typeof fetch>[0]): Parameters<typeof fetch>[0] {
  const rawUrl = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url
  const normalizedUrl = rawUrl.replace(/\/rest\/v1(?:\/rest\/v1)+/i, '/rest/v1')

  if (normalizedUrl === rawUrl) return input
  if (typeof input === 'string') return normalizedUrl
  if (input instanceof URL) return new URL(normalizedUrl)
  return new Request(normalizedUrl, input)
}

console.log('SUPABASE URL =', supabaseUrl)

export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    fetch: (input, init) => fetch(normalizeSupabaseRequest(input), init),
  },
})
