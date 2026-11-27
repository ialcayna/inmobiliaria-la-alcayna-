# Inmobiliaria La Alcayna

Web inmobiliaria estática para GitHub Pages, conectada con Supabase para el panel privado, las fichas y las fotografías. Las fichas incluyen galería interactiva, filtros, favoritos y opciones para compartir cada inmueble.

## Puesta en marcha de la gestión privada

La web ya contiene la URL del proyecto y su clave publicable en `supabase-config.js`. La clave publishable está diseñada para usarse en el navegador; el acceso a las propiedades y las fotos lo limitan las políticas de la base de datos. No pegues aquí una clave `secret` ni `service_role`.

1. En Supabase abre **SQL Editor → New query**.
2. Abre el archivo `supabase/crear-base-de-datos.sql`, copia todo su contenido en la consulta y pulsa **Run**. Si ya configuraste Supabase anteriormente, vuelve a ejecutar este archivo actualizado: añade la edición de secciones y reseñas sin borrar las propiedades guardadas. Solo la cuenta `inmoalcayna@gmail.com` puede cambiar el contenido.
3. En Supabase abre **Authentication → Users → Add user** y crea el usuario `inmoalcayna@gmail.com` con una contraseña que guardes de forma privada. Confirma la cuenta si el panel te ofrece esa opción. No compartas la contraseña.
4. En **Authentication → URL Configuration → Redirect URLs**, añade `https://ialcayna.github.io/inmobiliaria-la-alcayna-/gestionar.html?recovery=1`.
5. Sube al repositorio actualizado el contenido de esta carpeta, incluyendo `supabase-config.js`, `auth-panel.css` y la carpeta `supabase/`. Deja `index.html` directamente en la raíz del repositorio y confirma los cambios.
6. Abre `https://ialcayna.github.io/inmobiliaria-la-alcayna-/gestionar.html`, inicia sesión con el correo y la contraseña y ya podrás administrar las propiedades.

## Añadir o editar propiedades

Desde el panel, completa tipo, operación, precio, zona, mapa, superficie, habitaciones, baños, parking, descripción, características y fotografías. Marca **Publicar esta propiedad en la web** para mostrarla. Al guardar, la ficha queda disponible en la página pública inmediatamente, sin volver a subir archivos. Puedes iniciar sesión desde cualquier dispositivo. En **Editar secciones** también puedes cambiar el texto de “Nosotros”, añadir o quitar reseñas y actualizar teléfono, WhatsApp y correo.

En la web, las fotos se pueden recorrer con miniaturas, flechas, teclado o gestos en móvil; también se pueden ampliar y poner en pase automático. Los favoritos quedan guardados en el navegador del visitante. Cada ficha tiene un enlace propio para compartir. WhatsApp y Facebook tienen botones directos; Instagram y TikTok usan el menú de compartir del móvil o copian el enlace para pegarlo en una publicación.

Las fotos admitidas son JPG, PNG y WebP, con un máximo de 25 MB antes de optimizarlas. Al guardarlas, la web conserva sus proporciones, reduce el lado mayor a 1600 píxeles y las comprime para que carguen más rápido. Las tarjetas muestran una vista recortada adaptada al diseño; al abrir la ficha se ve la imagen completa.

## Recuperar la contraseña

En el acceso del panel, pulsa **He olvidado mi contraseña**. Supabase enviará un enlace al correo autorizado. Abre ese enlace para introducir y confirmar la contraseña nueva. Para que el enlace vuelva al panel, debe estar permitida la dirección de recuperación indicada arriba en **Authentication → URL Configuration → Redirect URLs**.

## Alojamiento y límites

GitHub Pages publica la parte visible de la web; Supabase gestiona el acceso, los datos y las fotos. El plan gratuito de Supabase incluye cuotas y puede pausar proyectos que no tengan actividad durante una semana; consulta sus [límites y precios](https://supabase.com/pricing).

El contenido de ejemplo que había en la web no se copia a la base de datos. Añade las propiedades reales desde el panel. El formulario de contacto usa WhatsApp si se configura; mientras tanto, prepara un correo a `inmoalcayna@gmail.com`.
