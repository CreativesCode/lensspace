# QA O1: panel y gestión de equipo

Fecha: 2026-09-14

## Hallazgos corregidos

- El panel del propietario estaba ocupado por la administración de equipo.
- Los roles y estados se mostraban con los valores internos de la base de datos.
- El selector de sucursal estaba dentro del área desplazable de la tabla y su lista quedaba recortada.
- La invitación permanecía expandida debajo de la tabla.

## Implementación verificada

- `/dashboard` conserva paneles específicos: plataforma, propietario, vendedor y proveedores, con accesos rápidos relevantes al rol.
- La administración de miembros se movió a `/team`, visible solo para propietarios activos.
- La tabla presenta etiquetas en español y acciones compactas.
- Invitación y gestión de miembros usan diálogos; los selectores ya no forman parte del contenedor desplazable de la tabla.
- Los diálogos cierran por Escape, fondo o botón, y bloquean el desplazamiento del documento mientras están abiertos.
- “Pulso del negocio” aparece antes de los accesos del propietario y carga las métricas automáticamente usando los filtros predeterminados.

## Evidencia técnica

- `npm run lint`: aprobado.
- `npm run typecheck`: aprobado.
- `npm run build`: aprobado; `/team` aparece como ruta dinámica.
- `git diff --check`: aprobado.

## Cobertura pendiente

No fue posible ejecutar QA visual autenticado con O1 porque no había una superficie de navegador conectada y el navegador integrado no estaba disponible. Falta comprobar foco, contención visual y comportamiento responsive con la sesión real de O1. No se enviaron invitaciones ni se modificaron miembros.
