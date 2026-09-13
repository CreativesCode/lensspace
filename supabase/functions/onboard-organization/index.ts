import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.116.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type OnboardingRequest = {
  organizationName: string
  organizationPrefix: string
  timezone: string
  branchName: string
  branchCode: string
  ownerName: string
  ownerEmail: string
  ownerPassword: string
  subscriptionStatus: 'trial' | 'active'
  subscriptionAmount: number
  subscriptionCurrency: string
  billingPeriod: 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'custom'
  startsOn: string
  expiresOn: string
  enabledModules: string[]
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function validateRequest(value: unknown): value is OnboardingRequest {
  if (!value || typeof value !== 'object') return false

  const input = value as Partial<OnboardingRequest>
  const requiredStrings = [
    input.organizationName,
    input.organizationPrefix,
    input.timezone,
    input.branchName,
    input.branchCode,
    input.ownerName,
    input.ownerEmail,
    input.ownerPassword,
    input.subscriptionCurrency,
    input.billingPeriod,
  ]

  return (
    requiredStrings.every((item) => typeof item === 'string' && item.trim().length > 0) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.ownerEmail ?? '') &&
    (input.ownerPassword?.length ?? 0) >= 10 &&
    typeof input.subscriptionAmount === 'number' &&
    Number.isFinite(input.subscriptionAmount) &&
    input.subscriptionAmount >= 0 &&
    (input.subscriptionStatus === 'trial' || input.subscriptionStatus === 'active') &&
    ['monthly', 'quarterly', 'semiannual', 'annual', 'custom'].includes(
      input.billingPeriod ?? '',
    ) &&
    isIsoDate(input.startsOn) &&
    isIsoDate(input.expiresOn) &&
    input.expiresOn >= input.startsOn &&
    Array.isArray(input.enabledModules) &&
    input.enabledModules.every((moduleKey) => typeof moduleKey === 'string')
  )
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Método no permitido.' }, 405)
  }

  const authorization = request.headers.get('Authorization')
  const token = authorization?.replace(/^Bearer\s+/i, '')

  if (!token) {
    return jsonResponse({ error: 'No autenticado.' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: 'Configuración del servidor incompleta.' }, 500)
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const {
    data: { user: actor },
    error: actorError,
  } = await callerClient.auth.getUser(token)

  if (actorError || !actor) {
    return jsonResponse({ error: 'Sesión inválida.' }, 401)
  }

  const { data: isPlatformAdmin, error: roleError } = await callerClient.rpc(
    'current_user_is_platform_admin',
  )

  if (roleError || !isPlatformAdmin) {
    return jsonResponse({ error: 'No tienes permisos para crear organizaciones.' }, 403)
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return jsonResponse({ error: 'Solicitud inválida.' }, 400)
  }

  if (!validateRequest(payload)) {
    return jsonResponse({ error: 'Revisa los datos de la organización y del propietario.' }, 400)
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: ownerData, error: ownerError } = await adminClient.auth.admin.createUser({
    email: payload.ownerEmail.trim().toLowerCase(),
    password: payload.ownerPassword,
    email_confirm: true,
    user_metadata: {
      display_name: payload.ownerName.trim(),
    },
  })

  if (ownerError || !ownerData.user) {
    const status = ownerError?.message.toLowerCase().includes('already') ? 409 : 400
    return jsonResponse(
      {
        error:
          status === 409
            ? 'Ya existe una cuenta con el correo del propietario.'
            : 'No se pudo crear la cuenta del propietario.',
      },
      status,
    )
  }

  const { data: organizationId, error: organizationError } = await adminClient.rpc(
    'bootstrap_organization',
    {
      actor_user_id: actor.id,
      owner_user_id: ownerData.user.id,
      organization_name: payload.organizationName.trim(),
      organization_prefix: payload.organizationPrefix.trim().toUpperCase(),
      organization_timezone: payload.timezone,
      branch_name: payload.branchName.trim(),
      branch_code: payload.branchCode.trim().toUpperCase(),
      subscription_status: payload.subscriptionStatus,
      subscription_amount: payload.subscriptionAmount,
      subscription_currency: payload.subscriptionCurrency.trim().toUpperCase(),
      subscription_billing_period: payload.billingPeriod,
      subscription_starts_on: payload.startsOn,
      subscription_expires_on: payload.expiresOn,
      enabled_module_keys: [...new Set(payload.enabledModules)],
    },
  )

  if (organizationError) {
    await adminClient.auth.admin.deleteUser(ownerData.user.id)
    return jsonResponse({ error: 'No se pudo completar el alta de la organización.' }, 400)
  }

  return jsonResponse(
    {
      organizationId,
      ownerUserId: ownerData.user.id,
    },
    201,
  )
})
