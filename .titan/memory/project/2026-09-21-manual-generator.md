# Manual integrado de LensSpace

Fecha: 2026-09-21

Actualización 2026-10-02: el dueño del producto pidió que solo el superadmin edite el
manual y que el resto de roles lo lea como páginas y descargue el PDF (QA-64, Fase 6,
pendiente). Hoy `authorizeManualEditor` deja editar a admin y dueños, y vendedores y
proveedores no pueden verlo.

LensSpace incorpora un generador interno en `/manual` para producir documentación en español. La herramienta ofrece editor, vista previa, variantes para personal operativo y administración, descarga Markdown y vista preparada para guardar como PDF.

El acceso se valida en servidor y está limitado a superadministradores y dueños activos. La ruta de impresión aplica el mismo control. El menú muestra «Manual del sistema» únicamente a esos perfiles.

El contenido inicial documenta panel y navegación, clientes, recetas, catálogo, venta, pedidos y cobros, producción, caja, equipo y administración de organizaciones, junto con cinco roles, flujos completos, preguntas frecuentes y políticas. Las capturas reales de portada y login viven en `public/manual/`; las capturas autenticadas requieren cuentas de prueba autorizadas.

Evidencia detallada: `.titan/qa/2026-09-21-manual-generator.md`.

Verificación local: lint y TypeScript pasaron después de la integración.
Playwright confirmó la redirección anónima en escritorio y móvil y la entrega de
las dos imágenes. No se declara un build de producción posterior al manual: el
que estaba en curso compiló y fue detenido durante la generación de páginas por
petición explícita del usuario. La revisión autenticada del editor y de los PDF
continúa pendiente.
