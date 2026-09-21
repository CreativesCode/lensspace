# QA de ventas, pedidos y experiencia del propietario

Fecha: 2026-09-20
Estado: implementado; migración de autorización aplicada al proyecto Supabase enlazado
Fuente: QA funcional del rol propietario durante el flujo completo de venta.

## Decisiones de producto y UX

- El propietario es el administrador operativo de su organización. Su membresía
  `owner` no lleva `branch_id` y abarca todas las sucursales activas; un `seller`
  continúa limitado a su sucursal asignada.
- Nueva venta es el flujo principal y debe permitir, especialmente desde móvil,
  seleccionar o crear cliente, seleccionar o crear receta, configurar productos,
  cotizar, aceptar, revisar el pedido y cobrar sin abandonar `/sales`.
- La creación rápida de clientes y recetas ocurre en diálogos. Los registros
  creados se seleccionan inmediatamente en la venta. El formulario de cliente
  se comparte con `/customers` y contiene la ficha completa, no una versión
  reducida.
- La creación de recetas desde `/sales` y `/prescriptions` reutiliza el mismo
  formulario clínico, transformación de datos y validaciones en español. Ambos
  flujos admiten DP monocular, alturas, prismas, bases y original privado.
- Los formularios de receta usan validación controlada por la aplicación con
  mensajes en español; no dependen de los textos nativos del navegador. Esto
  incluye fecha obligatoria, rangos clínicos, nombre del especialista, motivo de
  corrección y formato/tamaño del original privado.
- Si el original no puede almacenarse después de crear la receta desde ventas,
  la receta permanece asociada y se informa en español que el archivo puede
  adjuntarse posteriormente desde `/prescriptions`.
- Los diálogos de receta y cliente de `/sales` usan ancho amplio (`max-w-4xl`)
  para sus formularios completos. En pantallas pequeñas, la tabla clínica
  mantiene desplazamiento horizontal.
- La tasa de cambio es un dato auxiliar de la venta: se presenta como
  `1 USD = [tasa] CUP`, avanza en pasos de `0.01` y se congela al aceptar.
- Las categorías técnicas del catálogo se traducen en la interfaz, incluyendo
  Tipo de visión, Material del cristal, Tratamiento, Montaje y Armadura.
- Los campos de receta muestran rangos clínicos y validan antes de llamar a la
  base. Los errores de restricciones se convierten en mensajes que nombran el
  campo visible y su rango, sin exponer nombres internos de Postgres.
- Después de aceptar la cotización, `/sales` muestra el número y detalle del
  pedido, total, saldo y captura de efectivo CUP/USD. El usuario puede iniciar
  otra venta desde la misma vista.
- En móvil, Pedidos usa navegación maestro-detalle: la lista se oculta al abrir
  un pedido y un botón permite volver. En escritorio se mantienen ambas columnas.
- Los estados se presentan en español. En la bandeja, `delivered` o `closed`
  prevalecen como estado principal sobre el estado de pago; un pedido entregado
  no debe mostrarse simplemente como “Pagado”.
- El historial del pedido se muestra en orden cronológico inverso, con el evento
  más reciente primero. Formularios de cobro y entrega se ocultan cuando ya no
  aplican.

## Correcciones de autorización y datos

- `/sales` expande una membresía `owner` a todas las sucursales activas y usa una
  clave compuesta `organization_id:branch_id` para evitar colisiones.
- `private.prepare_cash_payment()` ahora permite recibir efectivo a un propietario
  activo de la organización o a un vendedor activo de la sucursal. La caja y el
  pago quedan atribuidos al usuario autenticado que recibió el efectivo.
- La migración `20260920221232_allow_owners_to_receive_cash.sql` fue ejecutada en
  el proyecto enlazado y su versión quedó registrada como aplicada.
- La autorización se verificó con la cuenta propietaria de QA mediante un cobro
  de `0.01 CUP` dentro de una transacción revertida. No quedó ningún pago ni cambio
  de saldo de la prueba.
- Los errores de cobro `42501`, sobrepago, caja inactiva y pedido cerrado se
  traducen a mensajes visibles tanto en `/sales` como en `/orders`.

## Otros resultados del bloque de QA

- Los roles obtuvieron paneles adecuados; el propietario usa un panel operativo
  propio y la gestión de equipo quedó separada en `/team`.
- Equipo traduce roles y estados, usa diálogos para invitación/edición y evita que
  los desplegables expandan la tabla.
- El panel carga su analítica con el filtro inicial aplicado y prioriza las
  métricas sobre los accesos rápidos.
- Se añadió el favicon de la aplicación mediante `src/app/icon.svg`.
- Login valida el formato del correo antes de autenticar.

## Evidencia y limitaciones

- ESLint, TypeScript y la compilación de producción pasaron después de los cambios.
- La unificación del formulario y la ampliación selectiva del diálogo pasaron
  TypeScript, ESLint y `git diff --check` el 2026-09-20.
- El esquema remoto pasó `supabase db lint` sin errores.
- La prueba SQL transaccional específica del propietario pasó y se revirtió.
- La suite SQL automatizada no pudo ejecutarse porque Docker Desktop no estaba
  activo en el entorno local.
- Existe una deriva histórica previa y no relacionada: la migración local
  `20260913224717` no coincide por número con la remota `20260913224749`. No se
  reparó porque requería revisar su procedencia y estaba fuera del arreglo de cobros.
