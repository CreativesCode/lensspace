import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.116.0'

// Refreshes the organization's USD→CUP rate from elTOQUE (informal market rate).
// elTOQUE is called at most once per Havana day for the whole platform: the day's
// rate is cached in `market_exchange_rates`, then the organization adopts it.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const havanaDate = (offsetDays = 0) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Havana' }).format(new Date(Date.now() + offsetDays * 86_400_000))

async function fetchElToque(token: string, date: string) {
  const range = new URLSearchParams({ date_from: `${date} 00:00:01`, date_to: `${date} 23:59:01` })
  const response = await fetch(`https://tasas.eltoque.com/v1/trmi?${range}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`eltoque_http_${response.status}`)
  const body = (await response.json()) as { tasas?: Record<string, unknown> }
  const usd = Number(body.tasas?.USD)
  return Number.isFinite(usd) && usd > 0 ? { usd: Math.round(usd * 100) / 100, rates: body.tasas ?? {} } : null
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Método no permitido.' }, 405)

  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return jsonResponse({ error: 'No autenticado.' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const elToqueToken = Deno.env.get('ELTOQUE_API_TOKEN')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return jsonResponse({ error: 'Configuración del servidor incompleta.' }, 500)

  let organizationId: unknown
  try {
    organizationId = ((await request.json()) as { organizationId?: unknown }).organizationId
  } catch {
    return jsonResponse({ error: 'Solicitud inválida.' }, 400)
  }
  if (!Number.isSafeInteger(organizationId)) return jsonResponse({ error: 'Solicitud inválida.' }, 400)

  const callerClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: { user }, error: userError } = await callerClient.auth.getUser(token)
  if (userError || !user) return jsonResponse({ error: 'Sesión inválida.' }, 401)

  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const today = havanaDate()
  const { data: cached } = await adminClient.from('market_exchange_rates').select('rate_date').eq('source', 'eltoque').eq('rate_date', today).maybeSingle()

  if (!cached) {
    if (!elToqueToken) return jsonResponse({ error: 'Falta configurar el acceso a elTOQUE.' }, 503)
    try {
      // Early in the day elTOQUE may not have published today's rate yet.
      const market = (await fetchElToque(elToqueToken, today)) ?? (await fetchElToque(elToqueToken, havanaDate(-1)))
      if (!market) return jsonResponse({ error: 'elTOQUE no devolvió una tasa del USD.' }, 502)
      const { error: upsertError } = await adminClient.from('market_exchange_rates')
        .upsert({ rate_date: today, source: 'eltoque', usd_to_cup: market.usd, rates: market.rates, fetched_at: new Date().toISOString() })
      if (upsertError) throw upsertError
    } catch (error) {
      console.error('elTOQUE rate refresh failed.', { message: error instanceof Error ? error.message : String(error) })
      return jsonResponse({ error: 'No pudimos consultar elTOQUE. Inténtalo más tarde.' }, 502)
    }
  }

  // The caller's own session enforces role and subscription checks.
  const { data, error } = await callerClient.rpc('adopt_market_usd_rate', { target_organization_id: organizationId })
  if (error) return jsonResponse({ error: error.message }, error.code === '42501' ? 403 : 400)
  return jsonResponse(data)
})
