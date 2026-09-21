# Integración OpenWA para notificaciones de pedidos

Fecha: 2026-09-20

## Objetivo

Enviar automáticamente mediante OpenWA las cuatro plantillas existentes, sin
exponer credenciales y conservando consentimiento, permisos, deduplicación y
auditoría inmutable.

## Fases

1. Reutilizar el renderizado y las reglas de acceso del dominio de pedidos.
2. Añadir una Edge Function autenticada internamente que llame a OpenWA y tolere
   sus dos formatos conocidos de respuesta.
3. Registrar `sent`/`failed`, `messageId`, `chatId` y la clave única del evento.
4. Disparar las plantillas al confirmar, cobrar, terminar producción y entregar.
5. Eliminar el envío manual de la interfaz y mostrar los resultados en el historial.
6. Verificar código y SQL, desplegar migraciones, Vault y Edge Function.
7. Ejecutar un envío real a un número controlado.

## Fuera de alcance inicial

Recepción de respuestas y automatizaciones conversacionales. Requieren un caso
de uso definido, webhook HMAC, idempotencia y asociación por `messageId`/`@lid`.
