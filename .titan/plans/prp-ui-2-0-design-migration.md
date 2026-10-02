# PRP: Migración gradual a la Guía UI 2.0

> **Estado**: EN EJECUCIÓN (aprobado 2026-10-01)
> **Progreso**: Fase 0 ✅ · Fase 1 ✅ · Fase 2 ✅ · Fase 3 en curso
> **Fecha**: 2026-10-01
> **Proyecto**: LensSpace

---

## Objetivo

Llevar toda la app autenticada (shell, auth, panel y los 14 workspaces) al lenguaje
visual "Guía UI 2.0" de Claude Design. Se hace en fases que se pueden publicar por
separado: primero una sola fuente de tokens, después primitivas compartidas en
`src/shared/ui`, y al final el reemplazo vista por vista. "Pedidos y cobros v2" es la
vista piloto de referencia.

## Por Qué

| Problema (auditoría de la guía + verificado en código) | Solución |
|----------|----------|
| Conviven tres sistemas visuales: landing (radios grandes y coral), app (plana, 7 px) y auth (clases `sky-*`/`amber-*` del starter en 7 archivos) | Tokens semánticos únicos (`ink`, `action`, `mint`, `coral`, `amber`, `text`, `line`, `canvas`) en CSS vars y en `tailwind.config.ts` |
| 957 hex literales en `.tsx`, 4 copias de `inputClass` y 16 variantes de `rounded-*` (71× `rounded-[7px]`, 47× `[10px]`, `[8px]`, `[12px]`…) | Primitivas `Button`, `Field`, `Badge`, `Card`… en `src/shared/ui`, y prohibir hex en `src/features` |
| Contraste bajo AA: `#74857F` (90 usos) da 3,9:1, la etiqueta de sección del menú `#4D7A74` da 2,9:1 y el CTA coral con texto blanco 2,8:1 | `muted #5F716C` (5,2:1), `#7FB3AC` en la navegación y texto tinta sobre coral |
| Jerarquía plana: todo es tarjeta blanca, cada `page.tsx` repite a mano eyebrow + h1 + párrafo (12 páginas) y el panel se titula "LensSpace" | `PageHeader` compartido con variante destacada en tinta y cifras clave |
| Estados binarios: todo lo no pagado se ve coral, así que un pedido sano parece un error | `Badge` con 5 tonos (neutral, progress, success, warning, danger) mapeados desde los estados del negocio |
| La navegación no tiene iconos (puntos de 8 px), aunque `lucide-react` ya está instalado | Un icono por destino, barra de acento en el activo y contadores opcionales |

**Valor de negocio**: la app se percibe al nivel de la landing, lo que ayuda en demos y
pilotos. Además baja el coste de cada vista nueva, porque se compone con piezas en vez
de escribir clases a mano, y corrige problemas de accesibilidad (AA) en textos de apoyo
y en la navegación.

## Qué

### Criterios de Éxito
- [ ] `grep -rE "#[0-9A-Fa-f]{6}" src/features src/app/(main) src/app/(auth)` devuelve 0 resultados en `className`. Excepciones documentadas: landing, `opengraph-image`, logo y SVG.
- [ ] No queda ninguna clase `sky-*`/`amber-*` ni ninguna copia local de `inputClass`. Todos los controles de formulario usan `Field`.
- [ ] Cada `page.tsx` de `(main)` abre con `<PageHeader>`, y los estados del negocio se pintan con `<Badge tone>`.
- [ ] La navegación de escritorio y la de móvil tienen icono lucide por destino. La cabecera móvil va en tinta.
- [ ] "Pedidos y cobros" coincide con `Pedidos y cobros v2.dc.html` en escritorio y móvil, sin regresiones de flujo: pago CUP/USD, bloqueo de entrega con saldo, historial.
- [ ] `npm run lint`, `npm run typecheck` y `npm run build` pasan en cada fase. Al cerrar cada fase se entrega al usuario una lista de qué revisar y en qué pantalla; el usuario valida manualmente.

### Comportamiento Esperado
Cada fase se publica sola y deja la app funcionando. Mientras dure la migración, las
vistas ya migradas usan primitivas y tokens nuevos, y las pendientes siguen con las
clases actuales sin romperse: el mapeo legado de `tailwind.config.ts` se mantiene hasta
la fase de limpieza. No cambia ninguna regla de negocio, autorización ni RLS. Solo
cambian la presentación y, si se aprueba, el payload de lectura de pedidos.

---

## Contexto

### Referencias
- `docs/design/Guía UI LensSpace.dc.html`: auditoría (9 hallazgos), 6 directrices, tokens, escala tipográfica (7 niveles), radios 6/10/14/20, elevaciones e1–e3, botones (34/44/52 px), `Field` (44 px, radio 10, etiqueta de 13 px arriba), tonos de `Badge`, `PageHeader`, navegación, `ListItem`/`StatCard`, avisos y diálogos, y el plan de adopción en 3 pasos con un snippet de Tailwind.
- `docs/design/Pedidos y cobros v2.dc.html`: composición completa de la piloto. Cabecera destacada con 4 KPIs, bandeja con chips (Todos / Con saldo / Por entregar / Entregados), búsqueda y filtro de fechas en panel, panel de saldo coloreado según la deuda con barra de progreso, formulario de cobro con selector segmentado CUP/USD, equivalencia en vivo y "Cobrar saldo completo", pestañas Pagos/Historial con contador, timeline con etiqueta por tipo y entrega bloqueada con explicación. También trae el toggle "Hoy/Propuesta" como comparación.
- `docs/design/Pedidos y cobros LensSpace.html`: la misma v2 empaquetada para abrir sin servidor (487 KB, con runtime y fuentes inline y el mismo prop `vista: propuesta | hoy`). Sirve para compartir; la fuente editable es `Pedidos y cobros v2.dc.html`.
- `docs/design/brand/`: copia del logo que usan los mockups. Es el **D2 anterior** (con brillo `#FFD9D0` y la mitad oscura `#0D7A72`), no el D2.1 de `public/brand/`, aprobado el 2026-10-01. Además trae metadatos C2PA.
- `docs/design/ref/`: copias de `public/manual/login.png` y `portada.png`, usadas como referencia del estado actual.
- `docs/design/support.js`: runtime de Design Canvas. No se copia a producción. Los iconos del mockup usan `lucide-static` por CDN; en la app se usa `lucide-react` (ya es dependencia, v1.47).
- `src/app/globals.css`: ya tiene `--vs-*` (ink, action, mint, coral, highlight, canvas, border).
- `tailwind.config.ts`: **remapea** `slate`, `sky`, `emerald` y `red` a la paleta de marca, y redefine `rounded-lg` y `rounded-xl` como 7 px y `2xl`/`3xl` como 10 px.
- `src/shared/components/`: `MainNavigation`, `MobileSidebar`, `FormSelect`, `OperationalFilters`, `FilterPanel`, `PasswordInput` y `LensSpaceLogo`. Se mantienen como piezas compuestas y se reescriben sobre las primitivas.
- `src/features/orders/components/OrderPaymentsWorkspace.tsx` y la RPC `list_accessible_orders` (`supabase/migrations/20260921104329_*.sql`).
- `.titan/memory/project/2026-09-13-design-system.md` cita archivos "Vision Studio" que ya no existen y hay que marcarlo como superado.

### Arquitectura Propuesta

```
src/app/globals.css          # --ls-* tokens (ink, ink-2, action, mint, coral, amber, text, muted, line, canvas, surface)
tailwind.config.ts           # semantic colors + radii (badge/control/card/panel) + shadows e1–e3, legacy remaps kept until cleanup
src/shared/ui/               # NEW: domain-free primitives
├── button.tsx               # variants: primary | secondary | ghost | attention | danger; sizes sm 34 / md 44 / lg 52; icon prop (LucideIcon)
├── field.tsx                # label + control + help/error; Input/Textarea/Select slots; addon (CUP/USD)
├── segmented-control.tsx    # CUP/USD, view toggles
├── switch.tsx
├── badge.tsx                # tone: neutral | progress | success | warning | danger; size sm | lg; dot
├── card.tsx                 # surface + e1, radius card
├── page-header.tsx          # variant featured (ink + stats) | simple; eyebrow, title, description, actions
├── stat-card.tsx
├── list-item.tsx            # avatar/icon, title, meta, badge, trailing figure, selected state
├── tabs.tsx · filter-chips.tsx · progress-bar.tsx · timeline.tsx
├── empty-state.tsx · alert.tsx · dialog.tsx · toast.tsx
└── index.ts
src/features/<feature>/status-tone.ts   # business status → Badge tone (domain mapping stays in the feature)
```

Decisiones clave:
1. **Tokens primero, sin tocar vistas.** Los tokens semánticos nuevos conviven con el
   remapeo legado. Quitar `lg/xl = 7px` o los remapeos de `slate`/`sky` cambiaría a la
   vez unos 90 `rounded-lg/xl` y todas las vistas, y eso rompe la gradualidad. Se borra
   en la fase de limpieza, cuando ya no quede ningún uso.
2. **`src/shared/ui` separado de `src/shared/components`.** `ui` guarda las primitivas
   sin dominio. `components` guarda las piezas compuestas o con conocimiento de la app
   (navegación, filtros, logo). El mapeo estado → tono vive en cada feature para que
   `shared` no tenga lógica de negocio.
3. **Sin dependencias nuevas.** No se agrega cva, clsx ni Radix: alcanza con un helper
   `cx()` mínimo. `Dialog` usa `<dialog>` nativo o el patrón de foco y Escape que ya
   tiene `MobileSidebar`. Se carga solo Space Grotesk y Source Sans 3; JetBrains Mono es
   solo de la guía.
4. **Piloto antes de expandir.** Pedidos y cobros v2 prueba las primitivas en una vista
   real y densa antes del reemplazo masivo. Si una primitiva no encaja, se ajusta ahí y
   no en 14 vistas.
5. **Guardia automática al final.** Una regla `no-restricted-syntax` en
   `eslint.config.mjs`, limitada a `src/features/**`, rechaza hex en `className` para
   que no vuelva el problema.

### Modelo de Datos (D1, aprobado)

La bandeja v2 necesita por pedido el `balanceCup` (para mostrar el saldo en cada fila
y en los KPIs), un `hasOpenIncident` (para el tono danger) y el total "cobrado hoy".
Hoy `list_accessible_orders()` solo devuelve `totalCup` y `paymentStatus`.

```sql
-- Additive change: same security invoker function, more fields in the jsonb payload.
create or replace function public.list_accessible_orders()
returns jsonb language sql stable security invoker set search_path = '' as $$
  -- ...existing fields...
  -- + 'balanceCup'      (cup_equivalent - sum(payments.equivalent_cup))
  -- + 'hasOpenIncident' (exists open lens/mounting incident)
$$;
-- "Cobrado hoy" is derived from the payments already visible under RLS, or from a
-- read-only RPC scoped to the current cashbox. No new tables; RLS unchanged.
```

---

## Blueprint (Assembly Line)

> Solo fases. Las subtareas se generan al entrar a cada fase con `tf-bucle-agentico`.
> Cada fase es un PR independiente.

### Fase 0: Línea base y fuente de verdad ✅ (2026-10-01)
**Objetivo**: actualizar la memoria: marcar como superada la entrada de design system de 2026-09-13 y registrar la precedencia nueva: la Guía UI 2.0 manda para todo; Pedidos v2 es su aplicación concreta; los patrones existentes solo donde la guía no dice nada. Sincronizar `docs/design/brand/` con los SVG D2.1 de `public/brand/`.
**Validación**: `MEMORY.md` apunta a la entrada nueva y `docs/design/brand/*.svg` coincide con `public/brand/`.

### Fase 1: Tokens ✅ (2026-10-01)
**Objetivo**: variables `--ls-*` en `globals.css` y tokens semánticos, radios `badge/control/card/panel` y sombras `e1–e3` en `tailwind.config.ts`, sin tocar vistas. Corrección de contraste como cambio mecánico de color: `slate-500` pasa a `#5F716C`, los literales `#74857F` (unos 100) se reemplazan por `#5F716C` y `#4D7A74` por `#7FB3AC`. No cambia ninguna forma ni ningún layout.
**Validación**: lint, typecheck y build pasan. Revisión manual: solo cambian esos tonos de texto.

### Fase 2: Primitivas en `src/shared/ui` ✅ (2026-10-01)
**Objetivo**: implementar las primitivas listadas, accesibles (foco visible, `aria-*`, objetivos de 44 px), siguiendo las medidas de la guía, sin lógica de negocio y con iconos `lucide-react`.
**Validación**: typecheck estricto sin `any`, lint y build pasan. Cada primitiva se usa al menos una vez en la Fase 4.

### Fase 3: Shell de navegación
**Objetivo**: `MainNavigation` con un icono por destino (incluido Organizaciones, que no aparece en la guía), barra de acento, etiquetas de sección AA y "Nueva venta" como `Button`. Cabecera móvil en tinta y `MobileSidebar` con la misma lista. Bloque de usuario con avatar de iniciales, `profiles.display_name` y rol, y subtítulo con el nombre de la organización en lugar de "Gestión óptica". Ambos datos se leen en `(main)/layout.tsx`, que ya consulta las membresías. Los contadores de pendientes van en la Fase 11 (D2).
**Validación**: revisión manual del usuario en escritorio y en 390 px por rol. Se mantienen la navegación por teclado, `aria-current` y el filtrado por `allowedHrefs`.

### Fase 4: Piloto, Pedidos y cobros v2
**Objetivo**: recomponer `orders/page.tsx` y `OrderPaymentsWorkspace` según la v2: `PageHeader` destacado con KPIs, chips con contador, `ListItem` con `Badge` por tono, panel de saldo, cobro con segmentado CUP/USD y equivalencia en vivo, pestañas Pagos/Historial, timeline y entrega bloqueada con explicación. Incluye la extensión aditiva de `list_accessible_orders` (D1) y la fuente de "cobrado hoy".
**Validación**: lista de revisión manual del flujo completo (cobro CUP, cobro USD con tasa, saldo 0, entregar, filtros por chip y fecha, detalle en móvil con "volver"). Comparado a ojo con el mockup.

### Fase 5: Pantallas de auth y alta de organización
**Objetivo**: login, signup, set-password, callback, `UpdatePasswordForm`, `PasswordInput` y `OrganizationOnboardingForm` sobre `Field`, `Button` y `Alert`, eliminando `sky-*` y `amber-*` (hallazgo 01).
**Validación**: login, recuperación y activación funcionan. Un `grep` de `sky-|amber-` en esos archivos da 0.

### Fase 6: Panel principal y `PageHeader` en todas las páginas
**Objetivo**: el dashboard por rol con `PageHeader` destacado (saludo, sucursal, fecha y cifras que ya se cargan), `DashboardCard` sin primarios que compitan y `OwnerAnalyticsDashboard` con `StatCard`. Reemplazar el bloque eyebrow + h1 repetido en las 12 `page.tsx`.
**Validación**: revisión manual por rol. El panel ya no se titula "LensSpace" y cada página usa `PageHeader`.

### Fase 7: Workspaces, ola A (flujo comercial)
**Objetivo**: clientes, recetas y ventas (`CustomerWorkspace`, `CustomerFormFields`, `PrescriptionWorkspace`, `PrescriptionFormFields` y `SalesWorkspace`, que tiene 914 líneas) migrados a primitivas, sin copias de `inputClass` ni hex.
**Validación**: revisión manual del flujo receta → cotización → aceptación → pedido. Si `SalesWorkspace` se parte, solo se hace para sacar piezas de UI, sin cambiar lógica.

### Fase 8: Workspaces, ola B (operación y gestión)
**Objetivo**: caja, producción, catálogo, equipo, administración de plataforma u organizaciones y editor del manual (`client-docs`) migrados a primitivas y tonos.
**Validación**: revisión manual de cierre de caja, cambio de estado de producción con incidencia, edición de catálogo e invitación de miembro.

### Fase 9: Limpieza y guardia
**Objetivo**: quitar del `tailwind.config.ts` el remapeo legado (`slate/sky/emerald/red`, `lg/xl = 7px`) y las `--vs-*` que ya no se usen, agregar la regla ESLint anti-hex en `src/features/**` y retirar los huérfanos (`inputClass` y clases muertas).
**Validación**: lint con la regla nueva pasa. Los `grep` de los criterios de éxito dan 0 y la revisión manual no muestra regresiones.

### Fase 10: Validación final
**Objetivo**: todo el sistema coherente de punta a punta.
**Validación**:
- [ ] `npm run lint`, `npm run typecheck` y `npm run build` pasan
- [ ] Revisión manual del usuario por ruta, rol y viewport con la lista entregada
- [ ] Revisión de contraste AA en textos de apoyo, navegación y badges
- [ ] Criterios de éxito cumplidos

### Fase 11: Contadores en la navegación (D2)
**Objetivo**: contadores de pendientes en el menú (pedidos con saldo, trabajos de producción pendientes), con una sola consulta liviana y respetando RLS desde `(main)/layout.tsx`. Medir el costo por request antes de dejarlo activo.
**Validación**: los contadores coinciden con la bandeja y con producción para cada rol; el TTFB del layout no empeora de forma apreciable.

---

## Decisiones (resueltas 2026-10-01)

- **D1. Datos de la bandeja v2 — APLICAR.** Ampliar `list_accessible_orders` con `balanceCup` y `hasOpenIncident`, y agregar la fuente de "cobrado hoy". Migración aditiva, RLS sin cambios. Va en la Fase 4.
- **D2. Contadores en la navegación — AL FINAL.** Se movieron a la Fase 11, después de la validación final.
- **D3. Landing — SOLO EL BOTÓN CORAL.** El CTA coral pasa a texto tinta (contraste). El resto de la landing queda fuera del alcance. Se aplica en la Fase 1 junto con el resto de los cambios de contraste.
- **D4. Export empaquetado — SE CONSERVA.** No es significativo; queda como copia para compartir.

---

## Aprendizajes (Self-Annealing / Neural Network)

> Esta sección crece con cada error encontrado durante la implementación.

### 2026-10-01: Hover del CTA coral rompía el contraste
- **Error**: con texto tinta, el hover original `#E95B3C` daba 4,0:1 (bajo AA).
- **Fix**: hover aclarado a `#FF8466` (5,8:1), igual que la guía; token `coral.hover`.
- **Aplicar en**: todo botón `attention` (coral) de `src/shared/ui/button.tsx`.

### 2026-10-01: `theme.extend.colors.amber` no pisa la paleta por defecto
- **Error**: riesgo de que definir `amber: { ink, soft }` borrara `amber-50/700` aún usados en auth.
- **Fix**: verificado en el CSS compilado que Tailwind fusiona el objeto; `amber-50/700` siguen existiendo.
- **Aplicar en**: cualquier token semántico nuevo que comparta nombre con una paleta de Tailwind.

### 2026-10-01: Utilidades de Tailwind en conflicto dentro de una primitiva
- **Error**: `controlClasses` apilaba `text-text` + `text-ink`, dos `bg-*` y `font-semibold` + `font-bold` según la variante. Tailwind resuelve por orden del stylesheet, no por orden de clases, así que el resultado era impredecible.
- **Fix**: las utilidades del mismo grupo (color, fondo, peso, tamaño) se eligen de forma exclusiva con ternarios; el peso de fuente vive en cada variante del botón.
- **Aplicar en**: toda primitiva con variantes y todo `className` que el consumidor sobrescriba; no "pisar" una clase pasando otra del mismo grupo.

---

## Gotchas

- [ ] **Validación visual manual (decisión del usuario, 2026-10-01):** no se hacen capturas con Playwright. Cada fase termina con una lista concreta de pantallas y detalles a revisar.

- [ ] `tailwind.config.ts` redefine `rounded-lg` y `rounded-xl` como 7 px, y `slate`, `sky`, `emerald` y `red` como la paleta de marca. Hoy `sky-700` ya es teal, no azul. Cambiar estos valores es un cambio global. Solo se hace en la Fase 9.
- [ ] El mockup usa `lucide-static` por CDN con `mask`. En la app se usa `lucide-react` v1.47. Verificado el 2026-10-01 que existen: `ReceiptText`, `UsersRound`, `Factory`, `PackageCheck`, `Hourglass`, `SearchX`, `SlidersHorizontal`, `Glasses`, `Banknote`, `LayoutDashboard`, `Tags`, `Wallet`, `BookOpen`. Para Organizaciones hay que buscar un nombre equivalente (en esta versión no existe `Building2`).
- [ ] El hallazgo 01 de la guía muestra el login en azul `#0369A1`, pero por el remapeo `sky-700` ya se ve teal. El problema real es semántico: nombres de paleta que no dicen lo que pintan, `rounded-xl` de 7 px y bordes `slate-300`. Visualmente el cambio es menor de lo que sugiere el mockup.
- [ ] Tipos reales de `get_order_timeline`: `order_created`, `confirmation`, `payment`, `production`, `incident`, `notification` y `delivery`. Se mapean a las etiquetas de la v2: Venta, Pago, WhatsApp, Incidencia, Entrega. Producción se agrega con tono `progress`.
- [ ] `SalesWorkspace.tsx` tiene 914 líneas, por encima del límite de 500 del proyecto. Partirlo en la Fase 7 es aceptable solo para extraer piezas de UI.
- [ ] La v2 deriva el estado general (Incidencia > Pagado · por entregar > Pago parcial > Pendiente de pago, con Entregado/Cerrado neutros). Esa derivación vive en `src/features/orders/status-tone.ts`, nunca en `shared/ui`.
- [ ] La regla de negocio "no entregar con saldo" debe seguir aplicándose en el servidor (`mark_order_delivered`). El botón bloqueado es solo informativo.
- [ ] `support.js` y los `.dc.html` ya están ignorados por ESLint (`docs/design/**`). No se importan ni se copian.
- [ ] Inputs de 16 px en móvil y el estilo global de `select` en `globals.css`: `Field` debe respetarlos para evitar el zoom de iOS.
- [ ] El copy visible sigue en español y los identificadores y archivos en inglés y `kebab-case` (por ejemplo `page-header.tsx`).
- [ ] La guía omite "Organizaciones" (platform admin) en el menú. Hay que asignarle icono, no quitarlo.

## Anti-Patrones

- NO rediseñar vista por vista con clases a mano: componer con `src/shared/ui`.
- NO meter lógica de negocio ni etiquetas de estado en `src/shared/ui`.
- NO quitar el remapeo legado de Tailwind antes de que la última vista migre.
- NO agregar dependencias de UI (cva, Radix, shadcn) sin justificarlo y avisar.
- NO cambiar reglas, RPC ni RLS fuera de lo aprobado en D1 y D2.
- NO usar `any` ni ignorar errores de TypeScript.

---

*PRP aprobado el 2026-10-01. Ejecución con `tf-bucle-agentico`, una fase por PR.*
