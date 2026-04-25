// Edge Function: create-payment
// Cria uma preferência de pagamento no Mercado Pago e retorna o link de checkout.
// Aceita body JSON com { product: "pro" | "mesa" | "delivery" }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MP_ACCESS_TOKEN  = Deno.env.get('MP_ACCESS_TOKEN')!
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/mp-webhook`

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

const PRODUCTS = {
  pro: {
    id:          'fluxox-pro-mensal',
    title:       'FluxoX Pro — Mensal',
    description: 'Acesso completo ao FluxoX',
    unit_price:  29.90,
  },
  mesa: {
    id:          'fluxox-addon-mesa',
    title:       'FluxoX Add-on Mesas — Mensal',
    description: 'Módulo de mesas e comandas (requer Pro)',
    unit_price:  6.99,
  },
  delivery: {
    id:          'fluxox-addon-delivery',
    title:       'FluxoX Add-on Delivery — Mensal',
    description: 'Módulo de delivery e pedidos (requer Pro)',
    unit_price:  6.99,
  },
} as const

type Product = keyof typeof PRODUCTS

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // 1. Verificar JWT do usuário
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Não autenticado' }, 401)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE)
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authErr || !user) return json({ error: 'Token inválido' }, 401)

    // 2. Ler produto do body
    const body = await req.json().catch(() => ({}))
    const product: Product = body.product && PRODUCTS[body.product as Product]
      ? body.product
      : 'pro'

    // 3. Validar add-ons: usuário precisa ter Pro ativo para comprar mesa/delivery
    if (product === 'mesa' || product === 'delivery') {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('plan, expires_at')
        .eq('id', user.id)
        .maybeSingle()

      const proActive = profile?.plan === 'pro' &&
        profile?.expires_at &&
        new Date(profile.expires_at) > new Date()

      if (!proActive) {
        return json({ error: 'É necessário ter o plano Pro ativo para adquirir este add-on.' }, 400)
      }
    }

    // 4. Criar preferência no Mercado Pago
    // external_reference = "userId:product" para o webhook identificar o que atualizar
    const item = PRODUCTS[product]
    const preference = {
      items: [{
        ...item,
        quantity:    1,
        currency_id: 'BRL',
      }],
      external_reference: `${user.id}:${product}`,
      notification_url:   WEBHOOK_URL,
      statement_descriptor: 'FLUXOX',
    }

    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(preference),
    })

    if (!mpRes.ok) {
      const err = await mpRes.text()
      console.error('Erro MP:', err)
      return json({ error: 'Erro ao criar pagamento' }, 500)
    }

    const { id, init_point } = await mpRes.json()
    return json({ preference_id: id, init_point, product })

  } catch (e) {
    console.error(e)
    return json({ error: 'Erro interno' }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
