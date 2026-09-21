# QA: sucursal comercial disponible para propietarios

Fecha: 2026-09-20

## Caso reproducido

La organización tenía una sucursal Principal activa y módulos comerciales vigentes, pero `/sales` devolvía “No tienes una sucursal comercial disponible” para el propietario.

## Causa

El cargador filtraba las membresías con `branch_id IS NOT NULL`. La base exige `branch_id = NULL` para propietarios porque su alcance cubre todas las sucursales.

## Corrección

- Los propietarios expanden a todas las sucursales activas de su organización.
- Los vendedores conservan únicamente su sucursal asignada.
- Los alcances se deduplican por organización y sucursal.
- El selector comercial usa una clave compuesta para distinguir sucursales de una misma organización.
- Cambiar de alcance limpia cliente, receta, conceptos y cotización previa.

## Auditoría de rutas relacionadas

- Clientes y Recetas: ya correctas.
- Pedidos, Caja y Producción: alcance resuelto por RPC/RLS.
- Catálogo: alcance por organización, sin dependencia de `branch_id`.

## Verificación

- Base remota consultada en modo lectura: organización, sucursal Principal, membresías, suscripción y módulos coherentes.
- `npm run lint`: aprobado.
- `npm run typecheck`: aprobado.
- `npm run build`: aprobado.
- `git diff --check`: aprobado.

No se modificaron datos remotos ni políticas de base de datos.
