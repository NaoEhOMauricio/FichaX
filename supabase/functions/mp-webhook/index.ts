// Edge Function: mp-webhook
// Recebe notificações do Mercado Pago e atualiza user_profiles quando o pagamento é aprovado.
// external_reference formato: "userId:product"  (product = pro | mesa | delivery)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MP_ACCESS_TOKEN  = Deno.env.get('MP_ACCESS_TOKEN')!
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const SUBSCRIPTION_DAYS = 31

Deno.serve(async (req) => {
  if (req.method === 'GET') return new Response('ok', { status: 200 })

  try {
    const body = await req.json()
    if (body.type !== 'payment') return new Response('ignored', { status: 200 })

    const paymentId = body.data?.id
    if (!paymentId) return new Response('no id', { status: 400 })

    // 1. Buscar detalhes do pagamento na API do MP
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` },
    })
    if (!mpRes.ok) return new Response('mp error', { status: 500 })

    const payment = await mpRes.json()
    if (payment.status !== 'approved') return new Response('not approved', { status: 200 })

    // 2. Parsear external_reference: "userId:product"
    const ref: string = payment.external_reference ?? ''
    const colonIdx = ref.indexOf(':')
    const userId  = colonIdx > 0 ? ref.slice(0, colonIdx) : ref
    const product = colonIdx > 0 ? ref.slice(colonIdx + 1) : 'pro'

    if (!userId) return new Response('no user ref', { status: 400 })

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + SUBSCRIPTION_DAYS)
    const expiresIso = expiresAt.toISOString()

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE)

    // 3. Montar update conforme o produto comprado
    let update: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (product === 'pro') {
      update = { ...update, plan: 'pro', expires_at: expiresIso }
    } else if (product === 'mesa') {
      update = { ...update, mesa: true, mesa_expires_at: expiresIso }
    } else if (product === 'delivery') {
      update = { ...update, delivery: true, delivery_expires_at: expiresIso }
    } else {
      // fallback: produto desconhecido → ativa pro completo
      update = { ...update, plan: 'pro', mesa: true, delivery: true, expires_at: expiresIso }
    }

    const { error } = await supabase
      .from('user_profiles')
      .upsert({ id: userId, ...update }, { onConflict: 'id' })

    if (error) {
      console.error('Erro ao atualizar perfil:', error)
      return new Response('db error', { status: 500 })
    }

    console.log(`Pagamento ${paymentId} aprovado — user ${userId} produto "${product}" até ${expiresIso}`)
    return new Response('ok', { status: 200 })

  } catch (e) {
    console.error(e)
    return new Response('error', { status: 500 })
  }
})
