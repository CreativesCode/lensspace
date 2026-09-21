# Evidencia QA: venta, pedido y cobro por propietario

Fecha: 2026-09-20

## Cobertura

- Flujo móvil de venta con creación rápida de cliente y receta.
- Validación legible de graduación y tasa de cambio.
- Conversión de cotización en pedido sin abandonar `/sales`.
- Cobro CUP/USD desde la venta y desde Pedidos.
- Acceso del propietario a todas las sucursales y recepción de efectivo.
- Estados traducidos, prioridad del estado Entregado y navegación móvil.
- Historial del pedido con el evento más reciente primero.

## Verificaciones realizadas

- `npm run lint`: correcto.
- `npm run typecheck`: correcto.
- `npm run build`: correcto.
- `supabase db lint --linked --schema private,public --level error`: sin errores.
- Cobro de propietario contra el proyecto enlazado dentro de `BEGIN/ROLLBACK`:
  autorizado correctamente, sin persistir datos de prueba.

## Verificación pendiente

- Ejecutar `supabase test db --linked supabase/tests/cashbox_closures.sql` cuando
  Docker Desktop esté disponible. El fixture ya incluye el caso de cobro por owner.

