# Ajustes de precio por producto en ventas

Fecha: 2026-09-20

Fuente: decisión del usuario e implementación validada en el flujo `/sales`.

## Decisión

- Cada producto seleccionado conserva su precio base de catálogo y puede tener un precio acordado distinto.
- Todo cambio, hacia arriba o hacia abajo, exige un motivo de 5 a 300 caracteres.
- Un vendedor puede aumentar el precio sin límite y aplicar descuentos de hasta 10 % inclusive.
- Un descuento mayor del 10 % solo puede registrarlo un propietario de la organización o un administrador de plataforma; esa identidad queda guardada como autorizador.
- La cotización y el pedido aceptado guardan precio base, precio acordado, motivo, actor del ajuste y autorizador. La aceptación sigue rechazándose si el precio base del catálogo cambió después de cotizar.
- Los recargos automáticos por graduación no admiten ajuste manual.

## Implementación

- Migración: `supabase/migrations/20260921015206_add_sale_line_price_adjustments.sql`.
- La función `calculate_sale_price` valida permisos y ajustes; `save_quotation` persiste la auditoría y `accept_quotation` crea la instantánea inmutable.
- La interfaz muestra precio base, precio acordado y motivo por producto, además del ajuste en el resumen final.
