# Hierro · Cómo publicarla, instalarla y actualizarla

Hierro es una carpeta de archivos estáticos. Hay que subirla a un hosting gratuito
(aquí, GitHub Pages) y después instalarla en el iPhone desde Safari.
Necesitas un ordenador cualquiera (Windows vale) con Chrome o Edge solo para subir los archivos.

## 1. Publicarla gratis con GitHub Pages (unos 10 minutos)

1. Descomprime `hierro.zip`. Tendrás una carpeta `hierro` con `index.html`, `sw.js`, `css`, `js`…
2. Entra en https://github.com y crea una cuenta gratuita (Sign up).
3. Arriba a la derecha pulsa **+ → New repository**.
   - Repository name: `hierro`
   - Marca **Public** (GitHub Pages gratis lo exige).
   - Pulsa **Create repository**.
4. En la página del repositorio vacío pulsa el enlace **uploading an existing file**.
5. Abre la carpeta `hierro` en el ordenador, selecciona **todo lo que hay dentro**
   (no la carpeta en sí) y arrástralo a la página. Espera a que termine la lista.
6. Abajo pulsa **Commit changes**.
7. Ve a **Settings → Pages** (menú de la izquierda).
   - Source: **Deploy from a branch**
   - Branch: **main** y carpeta **/ (root)** → **Save**.
8. Espera 1–2 minutos y recarga esa página: aparecerá tu dirección, del tipo
   `https://TU-USUARIO.github.io/hierro/`. Esa es tu app.

> **Privacidad:** el repositorio es público. La carpeta `tests/` incluye tu CSV de Hevy
> (`tests/workout_data.csv`) para que los tests funcionen. Si no quieres que sea visible,
> borra ese archivo antes de subirlo: la app funciona igual y solo dejarán de pasar los
> tests del importador.

## 2. Instalarla en el iPhone

1. Abre **Safari** en el iPhone y entra en tu dirección (`https://TU-USUARIO.github.io/hierro/`).
2. Pulsa **Compartir** (el cuadrado con la flecha) → **Añadir a pantalla de inicio** → **Añadir**.
3. Abre Hierro desde el icono de la pantalla de inicio. Se abre a pantalla completa.
4. **Importa tu historial desde la app instalada**, no desde Safari: Ajustes → Importar desde Hevy.
   (iOS guarda los datos de la app instalada separados de los de Safari.)
5. Activa el modo avión y ábrela una vez para comprobar que funciona sin conexión.

## 3. Actualizarla sin perder los datos

Cuando te pase una versión nueva:

1. Descomprime el zip nuevo.
2. En tu repositorio de GitHub: **Add file → Upload files**, arrastra de nuevo todo el
   contenido de la carpeta y pulsa **Commit changes**. Los archivos se sustituyen.
3. En el iPhone, abre la app con conexión. En uno o dos minutos detecta la versión nueva
   y se recarga sola (si estás a mitad de entreno, se aplica la próxima vez que la abras).

Tus datos no se tocan porque viven en el iPhone, no en GitHub. Para que eso siga siendo así:

- **No cambies la dirección** (ni el nombre de usuario ni el del repositorio): los datos van ligados a ella.
- **No borres el icono** de la pantalla de inicio: en iOS, borrar una web app borra sus datos.
- **Haz copias de seguridad**: Ajustes → Crear copia de seguridad → Guardar en Archivos / iCloud Drive.
  La app te lo recuerda. Con esa copia puedes restaurarlo todo en cualquier momento.

Si alguna vez modificas un archivo por tu cuenta, cambia también el texto de `VERSION`
al principio de `sw.js`; si no, el iPhone seguirá usando la copia guardada.

## 4. Tests

Abre `https://TU-USUARIO.github.io/hierro/tests/` (también hay un enlace al final de Ajustes).
Deben salir todos en verde. Abrir el archivo con doble clic desde el disco no funciona,
porque los navegadores no cargan módulos de JavaScript desde `file://`.

## Alternativa: Netlify

En https://app.netlify.com/drop puedes arrastrar la carpeta `hierro` entera y te da una
dirección al momento. Crea una cuenta para conservarla y, para actualizar, sube la carpeta
nueva al mismo sitio (pestaña Deploys) para mantener la misma dirección.
