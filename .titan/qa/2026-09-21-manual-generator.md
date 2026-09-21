# QA — Manual integrado de LensSpace

Fecha: 2026-09-21

## Alcance verificado

- `npm run typecheck`: aprobado.
- `npm run lint`: aprobado sin advertencias.
- Playwright contra `http://localhost:3000`:
  - `/manual` redirige a una persona anónima hacia `/login?next=/manual` en 1440×900 y 390×844.
  - El formulario de acceso aparece después de la redirección en ambos tamaños.
  - `/manual/portada.png` y `/manual/login.png` responden HTTP 200.
- Las capturas de portada y acceso fueron inspeccionadas visualmente.
- El build que estaba en curso se detuvo por instrucción explícita del usuario y no se volvió a ejecutar.

## Cobertura pendiente

- Abrir `/manual` con una sesión real de dueño y de superadministrador.
- Verificar edición, alta, eliminación, reordenamiento y restablecimiento en navegador.
- Descargar y revisar el Markdown desde el navegador.
- Generar las variantes operativa y administrativa en PDF, renderizarlas y revisar paginación y recortes.
- Capturar pantallas operativas autenticadas. No se usaron ni inventaron credenciales de prueba.

## Evidencia

- `public/manual/portada.png`
- `public/manual/login.png`
- `scripts/capture-manual-screenshots.mjs`
- `scripts/verify-manual.mjs`

