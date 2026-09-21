# Filtros operativos reutilizables

Fecha: 2026-09-21

Estado: implementado y validado localmente.

Fuente: solicitud de filtros por cliente, estado y fecha en Producción y vistas
operativas equivalentes.

## Decisiones

- `OperationalFilters` es el patrón compartido para filtros de cliente, estado,
  fecha desde/hasta, contador de resultados y limpieza.
- Producción filtra por estado y fecha para todos los roles. Cliente solo se
  muestra a propietario/vendedor; cristaleros y montadores no reciben ni ven la
  identidad del cliente.
- En todas las vistas operativas los filtros se abren desde un botón compacto
  con icono Lucide. Un badge muestra cuántos criterios están activos y `Limpiar`
  aparece junto al botón cuando corresponde; el formulario completo vive en un
  diálogo. `FilterPanel` centraliza ese patrón, incluido cierre por Escape,
  bloqueo del scroll, conteo de resultados y acciones del pie.
- El nombre del cliente de un trabajo se deriva en el Server Component a partir
  de pedidos ya autorizados por RLS. No se añade a la instantánea operativa que
  reciben los proveedores.
- Pedidos filtra por cliente, estado principal y fecha de creación. Los estados
  comerciales Entregado/Cerrado prevalecen sobre el estado de pago, igual que en
  las tarjetas de la bandeja.
- Caja usa el mismo patrón para fecha, sucursal y vendedor. El directorio de
  Organizaciones lo usa para búsqueda y estado. No deben volver a mostrar estos
  formularios de filtro permanentemente dentro de la página.
- Los filtros se aplican en memoria sobre las colecciones autorizadas ya cargadas;
  no amplían el acceso ni crean endpoints adicionales.
- Clientes conserva búsqueda por nombre/teléfono. Otras vistas solo deben adoptar
  los filtros que tengan sentido para sus datos, evitando controles vacíos o
  estados inexistentes.

## Evidencia

- Componentes: `src/shared/components/FilterPanel.tsx` y
  `src/shared/components/OperationalFilters.tsx`.
- Integraciones: Producción, Pedidos, Caja y Organizaciones.
- ESLint, TypeScript, build de producción y `git diff --check` pasaron.
