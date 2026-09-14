# Guía completa de QA manual — Vision Studio MVP

Fecha: 2026-09-13  
Objetivo: validar el MVP completo desde la administración del SaaS hasta la entrega de un pedido real, incluyendo permisos, responsive, accesibilidad, errores e invariantes de negocio.

> No uses datos reales de pacientes ni contraseñas reales. Crea usuarios, teléfonos,
> recetas y pedidos exclusivamente de prueba. No pegues secretos ni valores de
> `.env.local` en capturas o reportes.

## 1. Cómo ejecutar y registrar la revisión

### 1.1 Resultado permitido por prueba

Marca exactamente una opción:

- `[ ] PASS`: ocurrió todo lo esperado y no apareció ningún efecto inesperado.
- `[ ] FAIL`: el comportamiento contradice el resultado esperado.
- `[ ] BLOCKED`: falta una cuenta, configuración, navegador o dato imprescindible.
- `[ ] N/A`: está explícitamente fuera del MVP; explica por qué.

Una captura ayuda, pero no demuestra por sí sola que una escritura, permiso o
aislamiento funcionó. Después de cada mutación recarga la página y verifica que el
resultado persista.

### 1.2 Evidencia mínima por fallo

Registra:

- ID de prueba de esta guía.
- Fecha, hora y zona horaria.
- URL y rol utilizado.
- Navegador, versión y tamaño de viewport.
- Datos de prueba empleados, sin contraseñas.
- Pasos exactos.
- Resultado esperado y resultado observado.
- Captura o video y texto literal del error.
- Si el fallo persiste tras recargar y repetir una vez.
- Severidad propuesta: bloqueante, alta, media o baja.

### 1.3 Severidades

- **Bloqueante:** fuga entre organizaciones, acceso de rol indebido, pérdida de
  datos, cobro/saldo incorrecto, entrega con deuda, historial mutable o flujo
  principal imposible.
- **Alta:** operación esencial falla para un usuario autorizado, cálculo incorrecto,
  archivo privado expuesto, atribución de actor incorrecta o pantalla inutilizable
  en móvil.
- **Media:** validación confusa, estado visual desactualizado, error recuperable,
  filtro incorrecto o problema importante de teclado/lector de pantalla.
- **Baja:** detalle visual, texto, alineación o inconsistencia que no bloquea el uso.

## 2. Preparación del entorno

### QA-SETUP-01 — Aplicación disponible

1. Ejecuta `npm run dev` desde la raíz del proyecto.
2. Usa la URL exacta que indique la terminal; no asumas que siempre es el puerto 3000.
3. Abre `/login`.

Esperado:

- La página responde sin error de servidor.
- No aparecen secretos, trazas internas ni valores de entorno.
- Las rutas protegidas redirigen a `/login` sin sesión.

### QA-SETUP-02 — Cuentas necesarias

Prepara seis cuentas de prueba:

| Código | Rol | Organización | Sucursal |
|---|---|---|---|
| `PA` | Superadministrador | Plataforma | Ninguna |
| `O1` | Dueño | Óptica A | Todas |
| `S1` | Vendedor | Óptica A | Centro |
| `S2` | Vendedor | Óptica A | Otra sucursal o Centro |
| `LP` | Cristalero | Óptica A y, si es posible, B | Acceso externo |
| `MP` | Montador | Óptica A | Acceso externo |
| `O2/S3` | Dueño o vendedor | Óptica B | Cualquiera |

La cuenta `LP` debe reutilizarse en dos organizaciones para comprobar que ve solo
las asignaciones explícitas de cada una.

### QA-SETUP-03 — Datos mínimos sugeridos

Crea o reserva estos datos:

- Óptica A con módulos Ventas, Caja, Producción, WhatsApp y Analítica.
- Óptica B con datos distintos para pruebas de aislamiento.
- Dos sucursales en A si Multisucursal está habilitado.
- Cliente Ana QA con consentimiento y teléfono principal habilitado para WhatsApp.
- Cliente Bruno QA sin consentimiento.
- Cliente Carla QA sin teléfono habilitado para WhatsApp.
- Dos clientes que compartan el mismo teléfono.
- Una receta de graduación baja y otra alta que active advertencia/recargo.
- Catálogo con al menos un artículo CUP y otro USD.

## 3. Revisión global de interfaz

### QA-UI-01 — Identidad visual

Revisa todas las rutas: `/login`, `/set-password`, `/dashboard`, `/customers`,
`/prescriptions`, `/catalog`, `/sales`, `/orders`, `/cashbox` y `/production`.

Esperado:

- Logo Vision Studio correcto, sin deformación ni duplicados.
- Paleta Caribe moderno, tipografía, radios, bordes y sombras coherentes.
- No aparece una interfaz genérica ajena a `docs/design/`.
- Textos en español legibles, con tildes correctas y sin caracteres como `Ã`, `Â`
  o `â€”`. Si aparecen, regístralo como FAIL visual/encoding.
- Cifras monetarias alineadas y fáciles de distinguir de etiquetas.

### QA-UI-02 — Navegación

1. Recorre todos los enlaces del menú lateral.
2. Usa Atrás/Adelante del navegador.
3. Recarga cada ruta directamente.

Esperado:

- Ningún enlace devuelve 404 ni pantalla en blanco.
- La sesión se conserva al recargar.
- La pantalla activa debería poder identificarse visualmente.
- En móvil debe existir una forma usable de llegar a todas las funciones autorizadas.
  Actualmente el encabezado móvil merece revisión especial: si solo muestra logo y
  salir, y no existe navegación alternativa, registra un FAIL alto.

### QA-UI-03 — Estados de carga y mensajes

Esperado:

- Al enviar una operación, el botón evita doble envío.
- Éxitos y errores aparecen como texto visible, no solo por color.
- El mensaje explica qué corregir sin revelar SQL, claves o trazas.
- Tras un error se puede corregir el formulario y reintentar.
- Recargar no duplica pagos, pedidos, cierres, incidencias ni invitaciones.

## 4. Autenticación y sesión

### QA-AUTH-01 — Login correcto

1. Accede con cada cuenta válida.
2. Confirma que llegas al panel.
3. Recarga y navega entre varias rutas.

Esperado: sesión persistente, correo de la cuenta visible y datos acordes al rol.

### QA-AUTH-02 — Credenciales incorrectas

Prueba correo inexistente, contraseña incorrecta y campos vacíos.

Esperado: no inicia sesión, muestra error comprensible y no revela si una cuenta
sensible existe más allá de lo necesario.

### QA-AUTH-03 — Mostrar/ocultar contraseña

En login, activación y onboarding:

- El control cambia entre texto oculto/visible.
- Es accionable con teclado.
- Tiene nombre accesible.
- No altera el valor escrito ni envía el formulario accidentalmente.

### QA-AUTH-04 — Logout

1. Pulsa Cerrar sesión/Salir.
2. Usa Atrás y abre una URL protegida directamente.

Esperado: vuelve a login y ninguna página protegida reaparece con datos en caché.

### QA-AUTH-05 — Cuenta inactiva o invitada

Esperado: una cuenta sin membresía activa no obtiene operación del tenant. Debe ver
un estado vacío/solo lectura apropiado, nunca datos de otra organización.

## 5. Superadministración de plataforma

### QA-PA-01 — Aislamiento del rol de plataforma

Con `PA`:

- Debe ver organizaciones, uso, onboarding y controles contractuales.
- No debe aparecer como vendedor, propietario ni proveedor de una óptica.

Con cualquier otro rol:

- No debe ver ni ejecutar controles de plataforma.
- Intentar llamar esos controles desde UI o petición manipulada debe ser rechazado.

### QA-PA-02 — Alta completa de organización

1. Crea Óptica QA Nueva con prefijo de 3–8 caracteres.
2. Define primera sucursal, propietario, prueba de 15 días y Ventas.
3. Envía una vez.

Esperado:

- Se crean organización, sucursal, suscripción, propietario y módulos juntos.
- El propietario puede iniciar sesión.
- Si falla cualquier paso, no queda una organización parcial ni usuario huérfano.
- Prefijo y código se normalizan a mayúsculas.
- No permite prefijo duplicado ni fechas inválidas.

### QA-PA-03 — Dependencias de módulos

Prueba habilitar Caja, Producción o WhatsApp sin Ventas.

Esperado: operación rechazada claramente. Con Ventas habilitado, debe permitirlos.
Al deshabilitar Ventas, primero deben deshabilitarse sus dependientes.

### QA-PA-04 — Cambio contractual

1. Cambia importe, moneda, periodicidad, fechas, estado y módulos.
2. Usa un motivo menor de 10 caracteres.
3. Repite con un motivo válido.

Esperado:

- El motivo corto se rechaza.
- El cambio válido es atómico y persiste al recargar.
- Moneda exige tres letras y el importe no acepta negativos.
- Vencimiento no puede ser anterior al inicio.
- Se genera auditoría con actor, fecha, motivo y valores aplicados.

### QA-PA-05 — Estado del tenant

Prueba `active`, `suspended` y `archived`.

Esperado:

- Solo `PA` puede cambiarlo.
- Un dueño no puede elevarse ni modificar el estado manipulando una petición.
- Suspensión bloquea operación de usuarios del tenant y preserva los datos.
- Reactivación restaura la operación cuando la suscripción y módulos son válidos.

### QA-PA-06 — Uso por organización

Compara los contadores antes y después de crear cliente, pedido, trabajo y mensaje.

Esperado: clientes, pedidos, miembros activos, trabajos abiertos, intentos de
notificación y última actividad corresponden al tenant correcto.

### QA-PA-07 — Asistencia auditada

1. Inicia asistencia con menos de 10 caracteres: debe fallar.
2. Prueba duración menor de 5 o mayor de 120 minutos: debe fallar.
3. Inicia 30 minutos con motivo válido.
4. Inicia otra sesión con el mismo administrador.
5. Finaliza la sesión.

Esperado:

- La tarjeta muestra sesión y caducidad.
- Solo existe una sesión no cerrada por administrador.
- Iniciar otra cierra la anterior.
- Inicio y fin quedan auditados.
- Finalizar dos veces no crea un segundo cierre.

### QA-PA-08 — Catálogo base

Desde Administración abre `/catalog`.

Esperado: `PA` puede mantener artículos globales; los cambios no convierten al
administrador en miembro operativo y las instantáneas de pedidos previos no cambian.

## 6. Dueño, equipo e invitaciones

### QA-TEAM-01 — Invitar vendedor

1. Con `O1`, invita un vendedor a una sucursal.
2. Acepta/activa la cuenta.

Esperado: rol, sucursal y estado correctos; el vendedor accede solo a su ámbito.

### QA-TEAM-02 — Invitar proveedores

Invita `LP` y `MP`.

Esperado: proveedores sin sucursal, con el rol exacto. Reutilizar `LP` en otra
organización no crea una segunda identidad ni mezcla trabajos.

### QA-TEAM-03 — Gestión de miembros

Prueba desactivar, reactivar y reasignar `S1` de sucursal.

Esperado:

- Cada mutación queda auditada.
- Un vendedor inactivo pierde acceso operativo.
- La reasignación solo admite sucursal de la misma organización.
- No se borran ventas o historiales previos.
- Un vendedor/proveedor no puede gestionar membresías.

### QA-TEAM-04 — Tenant vencido/suspendido

Esperado: el dueño puede consultar el contexto histórico permitido, pero botones de
escritura fallan o están deshabilitados; ninguna mutación debe colarse por una UI
todavía visible.

## 7. Matriz de acceso obligatoria

Marca cada celda después de probarla directamente:

| Capacidad | PA | Dueño | Vendedor propio | Otro vendedor | LP/MP | Otro tenant |
|---|---:|---:|---:|---:|---:|---:|
| Configurar tenant | Sí | No | No | No | No | No |
| Gestionar equipo | No operativo | Sí | No | No | No | No |
| Ver clientes básicos de sucursal | Soporte/plataforma | Sí | Sí | Sí misma sucursal | No | No |
| Ver ventas/pagos del vendedor S1 | Plataforma | Sí | S1 sí | No | No | No |
| Cambiar precios de óptica | Base global | Sí | No | No | No | No |
| Calcular cotización | Según acceso | Sí | Sí | Sí propia | No | No |
| Ver trabajo asignado | Plataforma | Sí | Vendedor principal | No | Solo asignado | No |
| Ver precio/pago como proveedor | No aplica | Sí | Propio | No | Nunca | No |
| Ver analítica consolidada | Plataforma/uso | Sí con módulo | No | No | No | No |

Cualquier “Sí” inesperado hacia otro tenant o hacia precios/pagos de proveedores es
un fallo bloqueante.

## 8. Clientes

### QA-CUS-01 — Búsqueda

Busca por nombre parcial, teléfono con formato y teléfono normalizado.

Esperado: encuentra coincidencias autorizadas sin exigir formato idéntico y no
devuelve clientes de otra organización/sucursal no permitida.

### QA-CUS-02 — Crear cliente

Prueba nombre válido, identificador opcional, dirección, nacimiento, notas,
consentimiento y entre 1 y 5 teléfonos.

Esperado: creación atómica, nombre requerido, fecha no futura y teléfonos
normalizados sin destruir el formato mostrado.

### QA-CUS-03 — Teléfono compartido

Crea dos clientes con el mismo teléfono.

Esperado: se permite conservar ambos; el teléfono no es único. La búsqueda debe
mostrar las posibles coincidencias para evitar seleccionar a la persona equivocada.

### QA-CUS-04 — Duplicados y rollback

1. Intenta crear un posible duplicado.
2. Revisa la advertencia y reutiliza el existente cuando corresponda.
3. Provoca un teléfono inválido dentro de una creación.

Esperado: no se duplica silenciosamente; si falla un teléfono, no queda cliente
parcial.

## 9. Recetas y archivos privados

### QA-RX-01 — Receta completa

Registra esfera, cilindro, eje por ojo, adición, DP conjunta o separada, altura,
prisma/base, fecha, profesional y observaciones.

Esperado: rangos válidos, campos opcionales realmente opcionales y valores de OD/OI
sin intercambio.

### QA-RX-02 — Original adjunto

Prueba JPEG, PNG, WebP y PDF menores de 10 MB.

Esperado: carga exitosa y acceso privado solo para actores autorizados.

Prueba archivo mayor de 10 MB y extensión no permitida.

Esperado: rechazo sin metadato huérfano. Una carga cuyo registro posterior falla
solo puede limpiar su propio objeto no registrado.

### QA-RX-03 — Corrección inmutable

1. Guarda receta.
2. Corrige un valor indicando motivo.
3. Recarga y consulta revisiones.

Esperado: nueva revisión secuencial con autor, fecha, motivo y valores; el original
no cambia ni puede borrarse/editarse directamente.

### QA-RX-04 — Acceso clínico

Esperado: vendedores autorizados de la sucursal reutilizan datos clínicos necesarios;
proveedores y otro tenant no acceden al expediente del cliente.

## 10. Catálogo y cálculo de precios

### QA-CAT-01 — Catálogo efectivo

Con `O1`, crea un artículo propio y modifica disponibilidad/precio de un artículo
base. Con `S1`, intenta editarlo.

Esperado: dueño sí; vendedor solo calcula. El costo interno no debe aparecer a un
rol no autorizado.

### QA-CAT-02 — Monedas mixtas

Combina un artículo CUP y otro USD e introduce una tasa explícita.

Esperado:

- Cada línea conserva importe y moneda originales.
- El resumen CUP usa exactamente la tasa indicada.
- Cambiar la tasa altera solo el equivalente, no los precios originales.
- No aparece conversión silenciosa.

### QA-CAT-03 — Graduación alta

Usa la receta preparada para superar una regla.

Esperado: advertencia no bloqueante y recargo claramente desglosado si la regla lo
define. Nunca debe presentar una sugerencia como diagnóstico clínico obligatorio.

### QA-CAT-04 — Aislamiento y desactivación

Un cambio de Óptica A no afecta el catálogo efectivo de B. Desactivar un artículo
impide usarlo en nuevas ventas, pero pedidos anteriores conservan nombre, moneda y
precio instantáneos.

## 11. Cotización y aceptación

### QA-SALE-01 — Crear cotización

1. Con `S1`, elige cliente y receta opcional.
2. Selecciona configuración de catálogo.
3. Introduce tasa USD/CUP.
4. Revisa advertencias y total.
5. Guarda cotización.

Esperado: desglose correcto, tasa positiva obligatoria para una venta aceptable,
datos asociados a organización/sucursal/vendedor correctos.

### QA-SALE-02 — Aceptación verbal

Acepta la cotización.

Esperado:

- Se crea un único pedido sin reintroducir datos.
- Número `PREFIJO-AÑO-000001` secuencial por organización/año.
- Se crean instantáneas de líneas, totales, tasa y confirmación verbal.
- El prefijo ya no puede cambiar tras el primer pedido.

### QA-SALE-03 — Precio cambiado antes de aceptar

1. Guarda una cotización.
2. Cambia un precio del catálogo con el dueño.
3. Intenta aceptar la cotización anterior.

Esperado: rechazo y solicitud de revisar/reconfirmar; no crea pedido con precio
distinto al que el cliente vio.

### QA-SALE-04 — Doble envío

Haz doble clic o reintenta tras una respuesta lenta.

Esperado: no crea dos pedidos, dos confirmaciones ni salta el consecutivo.

## 12. Pedidos, pagos, entrega, historial y WhatsApp

### QA-ORD-01 — Bandeja por rol

Esperado: `S1` ve solo sus pedidos; `S2` no ve los de `S1`; `O1` ve todos los de A;
proveedores no ven la bandeja comercial; B no ve A.

### QA-PAY-01 — Pago CUP

Registra un pago parcial.

Esperado: pago inmutable con actor/hora, estado pasa de `unpaid` a `partial`, barra y
saldo se actualizan y persisten.

### QA-PAY-02 — Pago USD

Registra USD con tasa aplicada.

Esperado: conserva USD, tasa y equivalente CUP. La suma de equivalentes determina
el saldo; una tasa global posterior no altera el pedido.

### QA-PAY-03 — Sobrepago e importe inválido

Prueba cero, negativo y un pago mayor que el saldo.

Esperado: todos rechazados sin insertar pago ni cambiar estado.

### QA-DEL-01 — Entrega con deuda

Intenta entregar con saldo pendiente, incluso manipulando la interfaz/petición.

Esperado: rechazo de base de datos sin excepción posible. Este fallo es bloqueante.

### QA-DEL-02 — Entrega pagada

Completa el saldo y entrega.

Esperado: estado pagado, entrega con fecha y evento en historial; repetir no duplica
la entrega.

### QA-HIST-01 — Cronología completa

Revisa orden: confirmación, pagos, producción, incidencias, repetición, WhatsApp y
entrega.

Esperado: orden cronológico estable; cada evento muestra título, detalle, fecha y
actor cuando existe. No permite editar ni borrar eventos históricos.

### QA-WA-01 — Cliente con consentimiento

Selecciona una plantilla y pulsa Abrir WhatsApp.

Esperado:

- Primero se registra el intento inmutable.
- Se abre `wa.me` con teléfono normalizado y texto renderizado.
- Incluye cliente, número de pedido y saldo según la plantilla.
- La aplicación no afirma que el mensaje fue enviado; solo que abrió el flujo manual.

No envíes el mensaje a una persona real durante QA.

### QA-WA-02 — Sin consentimiento o destinatario

Prueba Bruno y Carla.

Esperado: no abre WhatsApp; registra intento `failed` con `missing_consent` o
`missing_recipient`; el error aparece en la cronología.

## 13. Caja y cierres

### QA-CASH-01 — Caja por vendedor/fecha/moneda

Esperado: cajas separadas por organización, sucursal, vendedor, fecha local y CUP/USD.
`S1` no ve ni cierra la caja de `S2`; el dueño puede revisar con filtros.

### QA-CASH-02 — Cierre principal

1. Registra varios cobros.
2. Abre `/cashbox`.
3. Compara esperado y cuenta efectivo.
4. Registra declarado y cierra.

Esperado: diferencia = declarado − esperado; pagos asignados una sola vez; cierre
inmutable, con actor y hora.

### QA-CASH-03 — Pago posterior y cierre complementario

1. Después del cierre principal, cobra otro pedido.
2. Revisa el pago en `/orders`.
3. Crea cierre complementario.

Esperado: el cobro se acepta y marca posterior al cierre; no modifica el cierre
principal; aparece únicamente en el siguiente complementario; secuencia 1, 2, etc.

### QA-CASH-04 — Concurrencia básica

Si puedes usar dos ventanas, intenta cerrar mientras registras un pago.

Esperado: serialización consistente; el pago queda antes en el cierre o después como
post-cierre, nunca perdido ni contado dos veces.

## 14. Producción, proveedores, incidencias y repetición

### QA-PROD-01 — Asignación

Con dueño o vendedor principal asigna cristales a `LP` y montaje a `MP`.

Esperado:

- El proveedor debe tener el rol compatible.
- Solo un trabajo actual de cada tipo por pedido.
- Se preserva instantánea de trabajo y actor asignador.
- No se exponen precios, pagos ni identidad innecesaria del cliente al proveedor.

### QA-PROD-02 — Visibilidad externa

Con `LP` revisa trabajos de A y B.

Esperado: solo asignados explícitamente. `LP` no ve trabajos de `MP`, no asignados,
precios, pagos ni datos de clientes.

### QA-PROD-03 — Estados de cristales

Recorre: pendiente → listo para enviar → enviado → en fabricación → terminado → recibido.

Esperado: no permite saltos, retrocesos arbitrarios ni estado de montaje. Cada paso
registra actor real, rol, fecha y nota cuando corresponda.

### QA-PROD-04 — Estados de montaje

Recorre: pendiente → listo para enviar → enviado → en montaje → terminado → recibido → revisado.

Esperado: mismas garantías y sin estados exclusivos de cristales.

### QA-PROD-05 — Incidencia

Registra descripción menor de 5 caracteres y luego una válida. Prueba responsables:
óptica, cristalero, montador y cliente.

Esperado: descripción corta rechazada; incidencia válida preserva responsabilidad,
actor, fecha y trabajo original.

### QA-PROD-06 — Repetición

Acepta repetición desde una incidencia.

Esperado: el trabajo original pasa a no actual/superseded sin borrarse; se crea uno
nuevo vinculado; una incidencia no genera dos repeticiones actuales.

## 15. Panel analítico del dueño

### QA-AN-01 — Acceso y módulo

Esperado: solo dueño con Analítica habilitada. Vendedor/proveedor no accede. Si el
módulo está deshabilitado, no se muestra o el servidor rechaza la consulta.

### QA-AN-02 — Filtros

Prueba todas las sucursales, una sucursal, todos los vendedores, uno y varios rangos.

Esperado: rango inclusivo, no permite fechas invertidas ni más de 367 días. Los
resultados cambian solo según filtros autorizados.

### QA-AN-03 — Reconciliación manual

Con una muestra pequeña calcula a mano:

- Ventas aceptadas CUP equivalente.
- Cobros CUP equivalente.
- Saldo pendiente.
- Pedidos aceptados/entregados y con incidencias.
- Diferencia de caja CUP.
- Trabajos activos por proveedor.
- Promedio aceptación–entrega.
- Productos principales.

Esperado: coincide exactamente con los registros del período; un pedido no se cuenta
dos veces por tener varios pagos o eventos.

## 16. Suscripciones, módulos y solo lectura

### QA-SUB-01 — Prueba/activa

Esperado: operación normal dentro de fechas y con módulos habilitados.

### QA-SUB-02 — Vencida

Esperado: datos históricos visibles según rol, nuevas escrituras rechazadas en
clientes, recetas, catálogo, ventas, pagos, caja, producción y equipo.

### QA-SUB-03 — Suspendida

Esperado: operación bloqueada para usuarios del tenant, datos preservados y
reactivación posterior sin reconstrucción.

### QA-MOD-01 — Módulo deshabilitado

Deshabilita cada módulo por separado y prueba su escritura directa.

Esperado: acciones nuevas ocultas o deshabilitadas y servidor las rechaza; el dueño
conserva lectura histórica prevista; al reactivar reaparecen los mismos datos.

### QA-MOD-02 — Multisucursal

Al deshabilitar Multisucursal, comprueba que se mantenga una sucursal operativa y
las demás queden preservadas en solo lectura. Si esto no ocurre de forma explícita,
registra FAIL contra la regla de negocio.

## 17. Aislamiento y seguridad negativa

### QA-SEC-01 — Cambio de ID en URL/petición

Para clientes, recetas, pedidos, trabajos, pagos y cierres, intenta sustituir un ID
por otro de Óptica B.

Esperado: 0 filas/no encontrado/permiso denegado, nunca datos parciales del objeto.

### QA-SEC-02 — Vendedor vecino

`S2` intenta abrir pedido, pago, caja o trabajo comercial de `S1`.

Esperado: denegado. Sí puede encontrar ficha básica/receta compartible de la misma
sucursal cuando el flujo lo requiera, sin precios o cobros de `S1`.

### QA-SEC-03 — Proveedor

Manipula IDs para consultar otro trabajo o recursos comerciales.

Esperado: denegado; ninguna respuesta incluye nombre del cliente, teléfono, precio,
costo, total, pagos o saldo.

### QA-SEC-04 — Archivos

Prueba abrir una URL de receta privada sin sesión, con otro tenant y con proveedor.

Esperado: denegado; las URLs no deben ser públicas permanentes.

### QA-SEC-05 — Datos sensibles en cliente

En DevTools revisa HTML, Network, errores y almacenamiento.

Esperado: nunca aparece `service_role`, contraseña, secreto, conexión Postgres ni
información de otro tenant. Solo las variables públicas previstas pueden llegar al navegador.

## 18. Responsive y dispositivos

Repite al menos el flujo de login, cliente, venta, pedido, producción, caja y panel
en estos tamaños:

| Perfil | Viewport sugerido |
|---|---|
| Móvil pequeño | 320 × 568 |
| Móvil común | 390 × 844 |
| Tablet vertical | 768 × 1024 |
| Escritorio | 1366 × 768 |
| Escritorio ancho | 1920 × 1080 |

Para cada pantalla marca:

- `[ ]` No hay scroll horizontal de página.
- `[ ]` Texto, totales y estados no se cortan ni superponen.
- `[ ]` Botones críticos tienen al menos ~44–48 px táctiles.
- `[ ]` Formularios mantienen etiquetas visibles.
- `[ ]` Selectores y calendarios son usables.
- `[ ]` Tablas se adaptan, desplazan dentro de su contenedor o cambian a tarjetas.
- `[ ]` Acciones principales no quedan fuera de pantalla.
- `[ ]` Teclado móvil no tapa el campo/botón de envío.
- `[ ]` Existe navegación completa en móvil.
- `[ ]` Zoom al 200 % conserva lectura y operación.

Prueba también rotación vertical/horizontal y modo oscuro del sistema: no es
obligatorio ofrecer tema oscuro, pero el contenido debe seguir siendo legible.

## 19. Accesibilidad y teclado

### QA-A11Y-01 — Solo teclado

Sin ratón, usa Tab, Shift+Tab, Enter, Espacio y Escape.

Esperado:

- Orden de foco lógico y foco siempre visible.
- Se puede entrar/salir de formularios y accionar botones.
- No hay trampas de teclado.
- Selectores, checkboxes y mostrar contraseña funcionan.
- Diálogos/prompt devuelven el foco de forma razonable.

### QA-A11Y-02 — Nombres y errores

Con lector de pantalla o árbol de accesibilidad revisa:

- Cada campo tiene etiqueta/nombre.
- Botones no dependen solo de un icono sin nombre.
- Encabezados siguen jerarquía comprensible.
- Regiones de estado anuncian éxito/error.
- Errores se asocian al campo o explican claramente qué corregir.
- Color no es el único indicador de pagado, incidencia, activo o error.

### QA-A11Y-03 — Contraste y movimiento

Esperado: texto/controles legibles, foco contrastado, animaciones no esenciales y
respeto razonable por reducción de movimiento.

## 20. Robustez, red y concurrencia

### QA-ROB-01 — Red lenta/offline

Simula Slow 3G y desconexión al enviar formularios.

Esperado: estado pendiente visible, error recuperable y ningún duplicado al reintentar.

### QA-ROB-02 — Dos pestañas

Abre el mismo pedido/cotización/caja en dos pestañas y realiza cambios conflictivos.

Esperado: invariantes de base de datos ganan; la segunda acción recibe error o datos
actualizados, nunca corrupción silenciosa.

### QA-ROB-03 — Sesión expirada

Deja vencer/cierra la sesión desde otra pestaña e intenta escribir.

Esperado: operación rechazada, redirección/login claro y ningún dato parcial.

### QA-ROB-04 — Entradas extremas

Prueba espacios, tildes, ñ, guiones, texto largo, decimales, valores límite y HTML
como `<script>alert(1)</script>` en campos de texto.

Esperado: validación consistente, texto tratado como contenido y ningún script ejecutado.

## 21. Compatibilidad mínima

Repite login y flujo principal en versiones actuales de:

- Chrome/Chromium.
- Microsoft Edge.
- Firefox.
- Safari móvil o WebKit equivalente si está disponible.

Esperado: sin diferencias funcionales, formularios y fechas utilizables, impresión
no requerida y consola sin errores repetitivos.

## 22. Guion completo de aceptación del piloto

Ejecuta este recorrido sin saltos y conserva los IDs/números generados:

1. `PA` crea Óptica Piloto, propietario, sucursal, suscripción y módulos.
2. `O1` inicia sesión, invita `S1`, `LP` y `MP`.
3. `S1` crea cliente con consentimiento y dos teléfonos.
4. `S1` registra receta y adjunta PDF/JPEG.
5. `S1` corrige una medida con motivo; verifica nueva revisión.
6. `O1` ajusta un precio del catálogo; `S1` solo lo consulta/calcula.
7. `S1` crea cotización mixta CUP/USD con tasa explícita.
8. `S1` registra aceptación verbal y obtiene número de pedido.
9. `S1` cobra anticipo parcial en CUP.
10. `S1/O1` asigna cristales a `LP`.
11. `LP` ve solo su tarjeta y avanza estados sin información comercial.
12. `LP` registra incidencia; `S1/O1` acepta repetición vinculada.
13. Se completa cristales y se asigna montaje a `MP`.
14. `MP` completa montaje y la óptica marca recibido/revisado.
15. `S1` prepara WhatsApp “pedido listo”; no lo envía a un número real.
16. `S1` intenta entregar con deuda y confirma rechazo.
17. `S1` cobra saldo en USD/CUP y entrega correctamente.
18. `S1` cierra caja principal.
19. Registra otro cobro de prueba posterior y crea cierre complementario.
20. `O1` reconcilia panel analítico y cronología completa.
21. `PA` revisa contadores, inicia/cierra asistencia y cambia el contrato con motivo.
22. `O2/S3` intenta acceder a los IDs del recorrido y es rechazado.

Criterio de aceptación: todos los pasos críticos PASS, cero fallos bloqueantes/altos
abiertos y cualquier fallo medio con decisión explícita antes del piloto real.

## 23. Pruebas de regresión tras cualquier corrección

Ejecuta siempre:

```text
npm run lint
npm run typecheck
npm run build
```

Y repite como mínimo:

- Login/logout y redirección de rutas protegidas.
- Aislamiento Óptica A/B.
- Vendedor S1 contra pedido/caja de S2.
- Proveedor sin datos comerciales.
- Cotización → aceptación → pedido único.
- Pago parcial/final y rechazo de sobrepago.
- Rechazo de entrega con saldo.
- Cierre principal/post-cierre/complementario.
- Incidencia y repetición vinculada.
- Historial y notificación fallida/abierta.
- Cambio contractual y guard de superadministrador.

Para cambios de base de datos ejecuta las fixtures relevantes y asesores de Supabase
en un entorno autorizado. No uses una restauración destructiva sobre producción para
probar recuperación.

## 24. Fuera del MVP: no reportar como bug salvo que aparezca roto en UI

- Inventario completo por sucursal y reservas.
- Garantías y posventa.
- Reembolsos y cancelaciones formales.
- Recibos/facturas fiscales.
- Firma o portal/cuenta del cliente.
- Métodos de pago no efectivos.
- Diagnóstico clínico automático.
- Fechas prometidas, urgencias, prioridad o atrasos.
- Envío automático por OpenWA; actualmente solo preparación manual.

## 25. Lista de pendientes externos conocidos

- `[ ]` Habilitar protección contra contraseñas filtradas en Supabase Auth.
- `[ ]` Proporcionar cuentas de prueba de todos los roles.
- `[ ]` Completar QA autenticado responsive en navegador real.
- `[ ]` Ejecutar ensayo de recuperación en entorno desechable o backup aprobado.
- `[ ]` Definir credenciales, contrato y reintentos de OpenWA antes de integrarlo.

## 26. Plantilla de incidencia

```markdown
### [ID de prueba] Título breve

- Resultado: FAIL
- Severidad:
- Fecha/hora:
- Entorno/URL:
- Rol y organización:
- Navegador/viewport:
- Datos de prueba:

Pasos:
1.
2.
3.

Esperado:

Observado:

Evidencia:

Notas de reproducción:
```

## 27. Acta de cierre

| Área | PASS | FAIL | BLOCKED | Responsable/notas |
|---|---:|---:|---:|---|
| Autenticación |  |  |  |  |
| Plataforma |  |  |  |  |
| Equipo/roles |  |  |  |  |
| Clientes |  |  |  |  |
| Recetas/archivos |  |  |  |  |
| Catálogo/precios |  |  |  |  |
| Cotización/pedido |  |  |  |  |
| Pagos/entrega |  |  |  |  |
| Caja |  |  |  |  |
| Producción/proveedores |  |  |  |  |
| Historial/WhatsApp |  |  |  |  |
| Analítica |  |  |  |  |
| Aislamiento/seguridad |  |  |  |  |
| Responsive/accesibilidad |  |  |  |  |
| Robustez/compatibilidad |  |  |  |  |

Decisión final:

- `[ ]` Aprobado para piloto.
- `[ ]` Aprobado con observaciones aceptadas.
- `[ ]` No aprobado; existen bloqueantes/altos.

Nombre del revisor:  
Fecha:  
Versión/commit revisado:  
Observaciones finales:

