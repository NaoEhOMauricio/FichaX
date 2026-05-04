import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ADMIN_EMAIL = 'leonardo.clemente.braga@gmail.com'

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const isRateLimitError = (message: string) => {
  const m = message.toLowerCase()
  return m.includes('rate limit') || m.includes('security purposes') || m.includes('too many requests')
}

const guessRetryAfterSeconds = (message: string) => {
  const m = message.toLowerCase()
  const match = m.match(/(\d+)\s*(second|seconds|minute|minutes|hour|hours)/)
  if (match) {
    const n = Number(match[1])
    const unit = match[2]
    if (unit.startsWith('hour')) return n * 3600
    if (unit.startsWith('minute')) return n * 60
    return n
  }
  if (m.includes('hour')) return 3600
  if (m.includes('minute')) return 300
  return 60
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const url    = Deno.env.get('SUPABASE_URL')!
    const anon   = Deno.env.get('SUPABASE_ANON_KEY')!
    const svcKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // 1. Verifica se é o admin
    const caller = createClient(url, anon, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    })
    const { data: { user } } = await caller.auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: cors })
    if (user.email !== ADMIN_EMAIL) return new Response(JSON.stringify({ error: 'Acesso negado' }), { status: 403, headers: cors })

    const body   = await req.json()
    const action = body.action as string
    const db     = createClient(url, svcKey)
    const publicAuth = createClient(url, anon)

    // 2. Executa ação
    if (action === 'activate_pro') {
      const expires = new Date()
      expires.setDate(expires.getDate() + 31)
      await db.from('user_profiles').upsert({
        id: body.user_id,
        plan: 'pro',
        expires_at: expires.toISOString(),
      })

    } else if (action === 'extend_pro') {
      const { data: current } = await db.from('user_profiles').select('expires_at').eq('id', body.user_id).maybeSingle()
      const base = current?.expires_at && new Date(current.expires_at) > new Date()
        ? new Date(current.expires_at)
        : new Date()
      base.setDate(base.getDate() + (body.days ?? 31))
      await db.from('user_profiles').upsert({ id: body.user_id, expires_at: base.toISOString() })

    } else if (action === 'revoke_pro') {
      await db.from('user_profiles')
        .update({ plan: 'free', mesa: false, delivery: false, expires_at: null })
        .eq('id', body.user_id)

    } else if (action === 'toggle_mesa') {
      await db.from('user_profiles')
        .update({ mesa: body.value })
        .eq('id', body.user_id)

    } else if (action === 'toggle_delivery') {
      await db.from('user_profiles')
        .update({ delivery: body.value })
        .eq('id', body.user_id)

    } else if (action === 'send_setup_email') {
      let targetEmail = (body.email as string | undefined)?.trim().toLowerCase()
      const userId = body.user_id as string | undefined

      if (!targetEmail && userId) {
        const { data: profile } = await db
          .from('profiles')
          .select('email')
          .eq('id', userId)
          .maybeSingle()
        targetEmail = profile?.email?.trim().toLowerCase()
      }

      if (!targetEmail) {
        return new Response(JSON.stringify({ error: 'E-mail do usuário não encontrado' }), {
          status: 400,
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }

      const redirectTo = (body.redirect_to as string | undefined) || Deno.env.get('APP_AUTH_REDIRECT_URL')
      const magicLink = await publicAuth.auth.signInWithOtp({
        email: targetEmail,
        options: {
          shouldCreateUser: false,
          ...(redirectTo ? { emailRedirectTo: redirectTo } : {}),
        },
      })

      if (magicLink.error) {
        if (isRateLimitError(magicLink.error.message)) {
          const retryAfter = guessRetryAfterSeconds(magicLink.error.message)
          return new Response(JSON.stringify({
            error: `Limite de envio atingido. Aguarde ${retryAfter}s e tente novamente.`,
            retry_after_seconds: retryAfter,
          }), {
            status: 429,
            headers: { ...cors, 'Content-Type': 'application/json', 'Retry-After': String(retryAfter) },
          })
        }

        return new Response(JSON.stringify({ error: magicLink.error.message }), {
          status: 400,
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({
        ok: true,
        message: `E-mail de acesso enviado para ${targetEmail}.`,
      }), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      })

    } else {
      return new Response(JSON.stringify({ error: 'Ação inválida' }), { status: 400, headers: cors })
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: cors })
  }
})
