# Alcance de sucursales para propietarios

Fecha: 2026-09-20
Estado: corregido localmente y verificado técnicamente
Fuente: QA autenticado con el propietario de una organización creada desde plataforma.

- Una membresía `owner` tiene `branch_id = NULL` por diseño y representa acceso a todas las sucursales activas de la organización. Solo las membresías `seller` llevan una sucursal concreta.
- Ninguna vista debe descartar propietarios mediante `branch_id IS NOT NULL`. Debe expandir propietarios a todas las sucursales activas y vendedores únicamente a su sucursal asignada.
- `/sales` incumplía esa regla y mostraba que no había sucursal comercial aunque la sucursal Principal existía y estaba activa.
- El cargador de ventas ahora produce alcances únicos por `organization_id:branch_id`. El selector usa esa clave compuesta para soportar correctamente organizaciones multisucursal.
- Clientes y Recetas ya aplicaban la regla correcta. Pedidos, Caja y Producción delegan el alcance a funciones de base de datos; Catálogo trabaja a nivel de organización.
- La función de base `save_quotation` ya permite operar al propietario mediante las comprobaciones existentes; no se cambió esquema, RLS ni información remota.

Evidencia: `.titan/qa/2026-09-20-owner-sales-branch-scope.md`.
