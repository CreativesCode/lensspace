# Paneles por rol y equipo en diálogos

Fecha: 2026-09-14
Estado: implementado localmente y verificado técnicamente; QA autenticado pendiente

- `/dashboard` es la entrada específica de cada rol. El propietario recibe resumen de organización, accesos rápidos y analítica cuando está habilitada; vendedores y proveedores reciben su contexto operativo y accesos según módulos; el administrador de plataforma conserva su panel agregado.
- La gestión de equipo dejó de ocupar el panel y vive en `/team`, ruta y navegación reservadas a propietarios activos.
- La tabla de equipo traduce roles y estados al español. Los valores internos siguen siendo los contratos enviados a Supabase.
- Invitación y gestión se realizan en diálogos, evitando que los listbox queden recortados por el overflow de la tabla.
- En el diálogo de invitación, el selector de Rol abre hacia arriba mediante la
  opción reutilizable `menuPlacement` de `FormSelect`; así muestra todas las
  opciones sin obligar a desplazar el contenedor vertical del modal.
- Lint, TypeScript y build pasaron. La comprobación visual con O1 quedó pendiente por ausencia de navegador conectado.
- En el panel del propietario, la analítica precede a la tarjeta de accesos y consulta automáticamente el rango predeterminado de 30 días con todas las sucursales y vendedores. El botón queda disponible para aplicar cambios posteriores de filtros.

Evidencia: `.titan/qa/2026-09-14-o1-dashboard-team-dialogs.md`.
