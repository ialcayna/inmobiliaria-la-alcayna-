# Inmobiliaria La Alcayna

Web inmobiliaria estática para GitHub Pages, conectada con Supabase para el panel privado, las fichas y las fotografías. Las fichas incluyen galería interactiva, filtros, favoritos y opciones para compartir cada inmueble.

## Puesta en marcha de la gestión privada

La web ya contiene la URL del proyecto y su clave publicable en `supabase-config.js`. La clave publishable está diseñada para usarse en el navegador; el acceso a las propiedades y las fotos lo limitan las políticas de la base de datos. No pegues aquí una clave `secret` ni `service_role`.

1. En Supabase abre **SQL Editor → New query**.
2. Para una instalación nueva, abre `supabase/crear-base-de-datos.sql`, copia su contenido en **New query** y pulsa **Run**. Si la base de datos ya está configurada, ejecuta solo `supabase/actualizar-propietarios.sql`; crea la tabla privada sin tocar las demás tablas ni los anuncios.
3. En Supabase abre **Authentication → Users → Add user** y crea el usuario `inmoalcayna@gmail.com` con una contraseña que guardes de forma privada. Confirma la cuenta si el panel te ofrece esa opción. No compartas la contraseña.
4. En **Authentication → URL Configuration → Redirect URLs**, añade `https://ialcayna.github.io/inmobiliaria-la-alcayna-/gestionar.html?recovery=1`.
5. Sube al repositorio actualizado el contenido de esta carpeta, incluyendo `supabase-config.js`, `auth-panel.css` y la carpeta `supabase/`. Deja `index.html` directamente en la raíz del repositorio y confirma los cambios.
6. Abre `https://ialcayna.github.io/inmobiliaria-la-alcayna-/gestionar.html`, inicia sesión con el correo y la contraseña y ya podrás administrar las propiedades.

## Añadir o editar propiedades

Desde el panel, completa tipo, operación, precio, zona, mapa, superficie, habitaciones, baños, parking, descripción, características y fotografías. Marca **Publicar esta propiedad en la web** para mostrarla. Al guardar, la ficha queda disponible en la página pública inmediatamente, sin volver a subir archivos. Puedes iniciar sesión desde cualquier dispositivo. En **Editar secciones** también puedes cambiar el texto de “Nosotros”, añadir o quitar reseñas y actualizar teléfono, WhatsApp y correo.

En el apartado **Propietarios** del panel privado puedes guardar nombre, teléfono, correo, DNI / NIE y dirección. La tabla `owners` tiene permisos de lectura y edición solo para la cuenta `inmoalcayna@gmail.com`; no se consulta desde la web pública. Mantén en esa lista únicamente los datos necesarios y no compartas DNI ni documentos en el chat.

En la web, las fotos y vídeos aparecen en la galería de cada inmueble. Las fotos se pueden recorrer con miniaturas, flechas, teclado o gestos en móvil; también se pueden ampliar y poner en pase automático. Los favoritos quedan guardados en el navegador del visitante. Cada ficha tiene un enlace propio para compartir. WhatsApp y Facebook tienen botones directos; Instagram y TikTok usan el menú de compartir del móvil o copian el enlace para pegarlo en una publicación.

Las fotos admitidas son JPG, PNG y WebP, con un máximo de 25 MB antes de optimizarlas. Al guardarlas, la web conserva sus proporciones, reduce el lado mayor a 1600 píxeles y las comprime para que carguen más rápido. Los vídeos admitidos son MP4, WebM y MOV hasta 80 MB y 3 minutos; el navegador los convierte automáticamente a 720p aproximados y los guarda con un máximo de 48 MB. La optimización de vídeo sucede en tiempo real, así que mantén abierta la página mientras aparece el aviso de proceso. El gestor requiere Brave o Firefox actualizado para comprimir vídeo. Las tarjetas muestran una vista adaptada al diseño; la galería permite reproducir el vídeo con sonido.

Las fotos y vídeos de anuncios se guardan en un almacén público para que cualquier visitante pueda verlos. No subas documentos privados ni datos personales de clientes. La política de base de datos solo permite a la cuenta administradora gestionar anuncios y archivos.

## Portada, redes y páginas nuevas

En **Editar secciones** puedes subir hasta tres fotos para la portada y guardar los enlaces de Facebook, Instagram, TikTok y LinkedIn. WhatsApp se configura con el número internacional (por ejemplo, 34600000000). En **Páginas adicionales** puedes crear, editar y quitar páginas; al guardar los cambios aparecen enlazadas en el menú público. No hace falta cambiar la base de datos: esta información se guarda en el contenido JSON de `site_settings`.

## Asistente automático para clientes

La página pública incluye a **Sara**, una asistente con voz en español de ritmo suave y cercana (la voz disponible depende del navegador y del dispositivo). Puede ayudar a vendedores, responder dudas frecuentes y buscar entre las propiedades publicadas por operación, tipo, localidad, precio, dormitorios, jardín y características adicionales. El botón **Quiero vender mi casa** abre el diálogo de venta. Para confirmar disponibilidad, horarios, honorarios, financiación u otros detalles variables, deriva la consulta al equipo.

Sara usa el WhatsApp o el correo configurado en **Editar secciones**. Al elegir contactar, abre un mensaje preparado; el visitante debe enviarlo para que llegue al equipo. La conversación no se almacena. No pide ni necesita DNI, dirección privada ni documentos. Sus respuestas son guiadas y se basan en los anuncios públicos; no necesita una clave de IA ni un servidor adicional.

## Recuperar la contraseña

En el acceso del panel, pulsa **He olvidado mi contraseña**. Supabase enviará un enlace al correo autorizado. Abre ese enlace para introducir y confirmar la contraseña nueva. Para que el enlace vuelva al panel, debe estar permitida la dirección de recuperación indicada arriba en **Authentication → URL Configuration → Redirect URLs**.

## Alojamiento y límites

GitHub Pages publica la parte visible de la web; Supabase gestiona el acceso, los datos y las fotos. El plan gratuito de Supabase incluye cuotas y puede pausar proyectos que no tengan actividad durante una semana; consulta sus [límites y precios](https://supabase.com/pricing).

El contenido de ejemplo que había en la web no se copia a la base de datos. Añade las propiedades reales desde el panel. El formulario de contacto usa WhatsApp si se configura; mientras tanto, prepara un correo a `inmoalcayna@gmail.com`.
