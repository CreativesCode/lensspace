# Manual integrado de LensSpace

Fecha: 2026-09-21

Actualización 2026-10-03 (QA-64, sustituye el control de acceso descrito abajo): el
contenido se guarda en `public.manual_documents` (clave `main`, jsonb con el
`ClientDocsInput`). Solo el superadmin edita y publica («Guardar manual»; RLS lo
impone); todos los roles leen `/manual` como páginas (`ManualReader`) y descargan el
PDF desde `/manual/print`, que usa el texto guardado. Los dueños ven también la
variante de administración. Sin fila guardada se muestra el contenido inicial.

Actualización 2026-10-04: el contenido por defecto (`clientDocsInput.ts`, textos fijos
del generador y `copy.ts`) se reescribió en lenguaje llano para personas poco
tecnológicas (español de Cuba, «tú», «espejuelos», glosario y camino del pedido). Cada
sección lleva una foto en `public/manual/*.jpg`, recortada de capturas de QA de
organizaciones de prueba (solo nombres «QA…»; no usar capturas de Óptica Javier, que es
la org real del piloto); una foto por sección, porque el schema solo admite `image`
único. `manual_documents` seguía vacío, así que la app usa ese texto. El dueño del
producto lo aprobó como **documentación oficial del sitio**: `/manual` y su PDF son la
única fuente; la copia temporal publicada como Artifact se retira. Si el superadmin
guarda desde el editor, debe partir de este texto. Reglas de redacción:
`feedback/2026-10-04-plain-language-end-user-docs.md`.

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
