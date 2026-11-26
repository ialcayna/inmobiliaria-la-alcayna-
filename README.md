# Inmobiliaria La Alcayna

Web inmobiliaria estática, adaptable a móvil, con buscador y fichas detalladas. Incluye un gestor visual para añadir y editar anuncios sin escribir código.

## Gestionar propiedades sin código

1. Abre `gestionar.html` en el navegador. Una vez publicada la web, también estará en `https://tu-usuario.github.io/mi-inmobiliaria/gestionar.html`.
2. En **Añadir propiedad**, completa el tipo de inmueble (casa, piso, ático, local o terreno), operación, precio, zona, ubicación del mapa, metros, dormitorios, baños, parking y descripción. Añade las fotografías y las características, una por línea.
3. Pulsa **Guardar propiedad**. Para modificar una ficha existente, pulsa **Editar** en la lista. Las fichas se guardan en el navegador de ese dispositivo.
4. Cuando quieras publicar los cambios, pulsa **Descargar actualización**. Se descarga un archivo llamado `datos.js`.
5. Sube ese `datos.js` a tu repositorio de GitHub, reemplazando el archivo que ya existe, y confirma los cambios. GitHub Pages publicará la actualización.

El gestor también permite importar un `datos.js` generado anteriormente, por si cambias de ordenador o navegador. La página pública no cambia hasta que se sube la actualización a GitHub.

Las fotos seleccionadas se reducen para la web y se incluyen dentro de `datos.js`, por lo que no hace falta subirlas por separado. Si vas a añadir muchas propiedades con varias fotos, descarga y publica con frecuencia para guardar una copia.

## Datos de la inmobiliaria

El nombre está configurado como **Inmobiliaria La Alcayna**. En el gestor puedes actualizar el correo, teléfono y WhatsApp. El correo actual es `inmoalcayna@gmail.com`; añade el WhatsApp internacional, solo cifras (por ejemplo, `34600111222`), para que el formulario prepare las consultas.

Las fichas que aparecen ahora están marcadas como **Ejemplo** y usan ubicaciones y fotos ilustrativas. Sustitúyelas por inmuebles reales antes de publicar. Al editar una ficha de ejemplo, puedes completar sus datos reales y quitar la etiqueta `Ejemplo`.

## Alojamiento gratuito con GitHub Pages

GitHub Pages sirve páginas estáticas gratis desde un repositorio público. Para esta web no hace falta contratar un servidor. La dirección gratuita tendrá un formato parecido a `https://tu-usuario.github.io/mi-inmobiliaria/`.

1. Crea una cuenta en [GitHub](https://github.com/) si todavía no tienes una.
2. Crea un repositorio **público** nuevo y sube los archivos de esta carpeta: `index.html`, `styles.css`, `fichas.css`, `app.js`, `datos.js`, `gestionar.html`, `gestionar.css` y `gestionar.js`.
3. En el repositorio, abre **Settings → Pages**. En **Build and deployment**, elige **Deploy from a branch**, selecciona `main` y la carpeta `/ (root)`, y guarda.
4. Cuando termine la publicación, GitHub mostrará el enlace de la web en esa pantalla.

Puedes usar un dominio propio si ya tienes uno; el alojamiento en Pages sigue siendo estático. La web puede recibir consultas por enlaces a WhatsApp, correo y teléfono; no almacena formularios en un servidor.
