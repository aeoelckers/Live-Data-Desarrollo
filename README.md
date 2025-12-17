# Dashboard TV para oficina (PortalPortuario + UF/m²)

Dashboard estático listo para GitHub Pages que muestra las noticias más recientes de PortalPortuario y una tabla lateral editable con valores UF/m² por zona en Chile. No requiere backend ni servidores externos.

## Estructura

```
.
├── assets/
│   ├── css/styles.css   # Estilos base del dashboard
│   └── js/app.js        # Lógica de actualización de noticias y tabla UF/m²
├── data/
│   ├── news.json        # Noticias generadas automáticamente
│   └── ufm2.json        # Tabla UF/m² editable por contenido
├── .github/workflows/news-fetch.yml  # Action que actualiza news.json
└── index.html           # Layout principal
```

## Publicar en GitHub Pages
1. Sube este repositorio a GitHub.
2. Ve a **Settings → Pages**.
3. En **Source**, selecciona **Deploy from a branch** y elige la rama (ej: `main`) y carpeta `/` (root).
4. Guarda los cambios. GitHub Pages generará la URL pública automáticamente.

## Datos de UF/m² (sin tocar código)
- Edita `data/ufm2.json` con las zonas, valores y observaciones necesarias.
- El dashboard recargará el archivo cada vez que se abra o se refresque el navegador.

## Actualización automática de noticias
- El archivo `data/news.json` se genera cada 30 minutos mediante GitHub Actions, consultando el RSS público de PortalPortuario (`https://portalportuario.cl/feed/`).
- Workflow: `.github/workflows/news-fetch.yml`.
- El Action descarga el feed, lo transforma a JSON y hace commit automático si hay novedades.
- Variables: utiliza el `GITHUB_TOKEN` que GitHub expone por defecto; no requiere secretos adicionales.
- Disparo manual: desde **Actions → Actualizar noticias PortalPortuario → Run workflow**.

## Desarrollo local
- No hay dependencias. Basta con abrir `index.html` en el navegador.
- Para ver cambios en `ufm2.json` o `news.json`, recarga la página o usa el botón **Actualizar** en el panel de noticias.

## Diseño para TV
- Tema oscuro, tipografía grande y layout horizontal (noticias a la izquierda, tabla a la derecha).
- Incluye reloj en vivo y timestamp de última actualización.
