# Fichas de clientes unificadas y editables

Fecha: 2026-09-21

Estado: implementado; migración aplicada al proyecto Supabase enlazado.

Fuente: corrección solicitada durante QA de `/customers` y `/sales`.

## Decisiones

- Crear un cliente desde `/customers` o desde Nueva venta reutiliza
  `CustomerFormFields`; no deben existir formularios divergentes.
- La ficha completa incluye nombre, carné o identificador, nacimiento,
  dirección, entre uno y cinco teléfonos con etiqueta, consentimiento para
  WhatsApp y notas.
- Al crear desde Nueva venta, el cliente nuevo queda seleccionado en la venta.
- Una ficha existente puede editarse desde `Ficha seleccionada` en `/customers`.
  Se pueden actualizar los datos personales y reemplazar la lista de teléfonos;
  organización y sucursal no se pueden cambiar durante la edición.
- La edición usa `public.update_customer_with_phones` como operación atómica con
  `security invoker`. Las políticas RLS existentes siguen determinando el acceso
  por organización y sucursal; se añadió una política DELETE específica para
  reemplazar teléfonos dentro de la misma transacción.
- La validación y los mensajes visibles deben permanecer en español. El flujo de
  posibles duplicados excluye la propia ficha durante una edición.
- Los resultados de búsqueda muestran el total de trabajos del cliente y separan
  abiertos de finalizados. La ficha seleccionada enlaza a `/orders` con nombre e
  identificador; la bandeja aplica primero el identificador exacto para evitar
  mezclar homónimos y vuelve al filtro normal por nombre cuando el usuario edita
  o limpia la búsqueda. `list_accessible_orders` incluye `customerId` y conserva
  `security invoker`, por lo que los conteos y enlaces respetan el acceso RLS.

## Evidencia

- Componente compartido: `src/features/customers/components/CustomerFormFields.tsx`.
- Migración: `supabase/migrations/20260921020630_update_customer_with_phones.sql`.
- Migración: `supabase/migrations/20260921104329_include_customer_id_in_accessible_orders.sql`.
- ESLint, TypeScript, build de producción y `supabase db lint` pasaron después de
  la implementación.

No se almacenaron datos personales de clientes ni credenciales en esta memoria.
