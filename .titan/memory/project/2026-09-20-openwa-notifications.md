# Integración OpenWA para notificaciones de pedidos

Fecha: 2026-09-20
Estado: automatización, migraciones, Vault y Edge Function desplegados; prueba real pendiente

## Decisión

- Las cuatro plantillas se disparan automáticamente al confirmar el pedido,
  registrar cada pago, completar los trabajos de producción actuales y entregar.
- La Edge Function `send-whatsapp-notification` acepta solo llamadas internas firmadas;
  las credenciales nunca llegan al navegador.
- La base conserva la autoridad sobre permisos, módulo WhatsApp, consentimiento,
  destinatario y renderizado mediante `prepare_openwa_notification`.
- `notification_attempts` sigue siendo append-only y ahora distingue `opened`,
  `sent` y `failed`. Para OpenWA registra `provider_message_id` y `provider_chat_id`.
- El historial del pedido refleja cada intento automático con una acción legible
  en español, incluida la confirmación de envío o el fallo de WhatsApp, además del
  evento comercial que originó la notificación.
- El cliente tolera las respuestas OpenWA documentada y real: `{success,data}` y
  `{messageId,...}`. El identificador de sesión debe ser el UUID, no el alias.
- El código de país predeterminado es Cuba (`53`) y no se duplica si el teléfono
  ya viene en formato internacional.
- Cada evento tiene una clave única en `private.notification_dispatches`, evitando
  notificaciones duplicadas si una transición se repite.
- `/orders` ya no presenta envío manual y explica el comportamiento automático.

## Verificación

- ESLint, TypeScript y la compilación Next.js pasaron.
- Las migraciones `20260920224027` y `20260920225647` están aplicadas remotamente.
- La suite SQL transaccional y `supabase db lint` remoto pasaron.
- La Edge Function está desplegada. Su autenticación interna y lectura de Vault
  devolvieron el 404 esperado ante un despacho inexistente.
- La sesión compartida de Tasknic (`robert-us`) existe en OpenWA y está `ready`.
- La migración `20260920233125_repair_notification_timeline_utf8.sql` corrigió
  los literales mojibake de `get_order_timeline`; el pedido `JAV-2026-000002`
  devuelve ahora `Aceptación del cliente` y `Confirmación verbal` correctamente.
- La corrección de UTF-8 vive en la base de datos, no como sustitución cosmética
  en la interfaz, para que todos los consumidores reciban tildes válidas.

## Pendiente

Ejecutar un envío real controlado con un cliente que haya otorgado consentimiento
y un teléfono confirmado por el usuario. Los secretos OpenWA y el secreto interno
están cifrados en Supabase Vault.

La recepción de respuestas queda fuera de este bloque hasta definir un caso de uso;
necesitaría webhook HMAC, idempotencia y asociación mediante `messageId`/`@lid`.
