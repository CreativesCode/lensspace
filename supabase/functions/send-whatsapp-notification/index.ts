import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.116.0'

type SendRequest = { dispatchId?: number }
type PreparedNotification = {
  dispatchId: number
  sourceEventKey: string
  dispatchStatus: 'requested' | 'sent' | 'failed'
  orderId: number
  organizationId: number
  branchId: number
  customerId: number
  templateKey: string
  actorId: string
  recipient: string | null
  message: string
  failureCode: string | null
  failureMessage: string | null
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function secureEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  let result = 0
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return result === 0
}

function phoneToChatId(phone: string, countryCode: string) {
  const raw = phone.trim()
  if (raw.startsWith('+')) return `${raw.slice(1).replace(/[^\d]/g, '')}@c.us`
  const number = raw.replace(/[^\d]/g, '')
  const code = countryCode.replace(/[^\d]/g, '')
  return `${!code || number.startsWith(code) ? number : `${code}${number}`}@c.us`
}

function providerMessageId(raw: Record<string, unknown>) {
  if (typeof raw.messageId === 'string') return raw.messageId
  const data = raw.data
  return data && typeof data === 'object' && typeof (data as Record<string, unknown>).messageId === 'string'
    ? (data as Record<string, unknown>).messageId as string
    : null
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return jsonResponse({ error: 'Método no permitido.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Configuración de Supabase incompleta.' }, 500)

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: configData, error: configError } = await admin.rpc('get_openwa_runtime_config')
  if (configError) return jsonResponse({ error: 'No se pudo cargar la configuración de OpenWA.' }, 500)

  const config = (configData ?? {}) as Record<string, string>
  const expectedSecret = config.vision_studio_wa_notify_secret
  const providedSecret = request.headers.get('x-wa-secret') ?? ''
  if (!expectedSecret || !secureEqual(providedSecret, expectedSecret)) {
    return jsonResponse({ error: 'No autorizado.' }, 401)
  }

  const openwaBaseUrl = config.vision_studio_openwa_base_url?.replace(/\/$/, '')
  const openwaApiKey = config.vision_studio_openwa_api_key
  const openwaSessionId = config.vision_studio_openwa_session_id
  const defaultCountryCode = config.vision_studio_openwa_country_code ?? '53'
  if (!openwaBaseUrl || !openwaApiKey || !openwaSessionId) return jsonResponse({ error: 'OpenWA no está configurado.' }, 503)

  let payload: SendRequest
  try { payload = await request.json() } catch { return jsonResponse({ error: 'Solicitud inválida.' }, 400) }
  if (!Number.isSafeInteger(payload.dispatchId) || (payload.dispatchId ?? 0) <= 0) {
    return jsonResponse({ error: 'Despacho inválido.' }, 400)
  }

  const { data, error } = await admin.rpc('get_automatic_notification_payload', { target_dispatch_id: payload.dispatchId })
  if (error) return jsonResponse({ error: error.message }, error.code === 'P0002' ? 404 : 400)

  const prepared = data as PreparedNotification
  if (prepared.dispatchStatus !== 'requested') return jsonResponse({ ok: prepared.dispatchStatus === 'sent', duplicate: true })

  const baseAttempt = {
    order_id: prepared.orderId,
    organization_id: prepared.organizationId,
    branch_id: prepared.branchId,
    customer_id: prepared.customerId,
    template_key: prepared.templateKey,
    channel: 'whatsapp',
    provider_key: 'openwa',
    recipient_snapshot: prepared.recipient,
    message_snapshot: prepared.message,
    attempted_by: prepared.actorId,
    source_event_key: prepared.sourceEventKey,
  }

  async function finish(outcome: 'sent' | 'failed', values: Record<string, unknown>) {
    const { error: attemptError } = await admin.from('notification_attempts').insert({ ...baseAttempt, outcome, ...values })
    if (attemptError && attemptError.code !== '23505') throw attemptError

    const { error: dispatchError } = await admin.rpc('complete_automatic_notification_dispatch', {
      target_dispatch_id: prepared.dispatchId,
      target_outcome: outcome,
      target_failure_code: outcome === 'failed' ? values.failure_code : null,
    })
    if (dispatchError) throw dispatchError
  }

  if (prepared.failureCode || !prepared.recipient) {
    const failureCode = prepared.failureCode ?? 'missing_recipient'
    const failureMessage = prepared.failureMessage ?? 'No existe un teléfono habilitado para WhatsApp.'
    await finish('failed', { failure_code: failureCode, failure_message: failureMessage })
    return jsonResponse({ ok: false, failureCode, error: failureMessage }, 422)
  }

  const chatId = phoneToChatId(prepared.recipient, defaultCountryCode)
  let response: Response
  let raw: Record<string, unknown> = {}
  try {
    response = await fetch(`${openwaBaseUrl}/sessions/${openwaSessionId}/messages/send-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': openwaApiKey },
      body: JSON.stringify({ chatId, text: prepared.message }),
    })
    const responseText = await response.text()
    try { raw = JSON.parse(responseText) as Record<string, unknown> } catch { raw = {} }
  } catch (sendError) {
    const failureMessage = sendError instanceof Error ? sendError.message : 'No se pudo contactar OpenWA.'
    await finish('failed', {
      failure_code: 'provider_network_error',
      failure_message: failureMessage.slice(0, 500),
      provider_chat_id: chatId,
    })
    return jsonResponse({ ok: false, failureCode: 'provider_network_error', error: failureMessage }, 502)
  }

  const sent = response.ok && raw.success !== false
  const messageId = providerMessageId(raw)
  const failureMessage = sent ? null : String(raw.message ?? raw.error ?? `OpenWA respondió HTTP ${response.status}`).slice(0, 500)
  await finish(sent ? 'sent' : 'failed', {
    failure_code: sent ? null : `provider_http_${response.status}`,
    failure_message: failureMessage,
    provider_message_id: messageId,
    provider_chat_id: chatId,
  })

  if (!sent) return jsonResponse({ ok: false, failureCode: `provider_http_${response.status}`, error: failureMessage }, 502)
  return jsonResponse({ ok: true, messageId })
})
