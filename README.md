# Mapeo Lineal de Intervalos

Calculadora visual que transforma linealmente un valor del intervalo origen `[a, b]` al intervalo destino `[A, B]`:

```
y = A + ((x - a) / (b - a)) · (B - A)
```

Es una **PWA** instalable, con soporte sin conexión y diseño *mobile-first* para teléfonos, tablets y escritorio.

- Demo: <https://tecdea.github.io/mapeolineal/>

## Estructura

| Archivo | Función |
| --- | --- |
| `index.html` | Interfaz y lógica de la transformación |
| `styles.css` | CSS compilado con Tailwind (generado, no editar a mano) |
| `src/input.css` | Fuente del CSS: `@font-face`, componentes y estilos del deslizador |
| `manifest.json` | Metadatos de instalación (`start_url` y `scope` relativos) |
| `sw.js` | Service worker: precarga del *shell* y respaldo sin conexión |
| `icons/` | Iconos 192/512, variantes *maskable*, `apple-touch-icon` y favicons |
| `fonts/` | Inter variable autoalojada (subconjuntos latin / latin-ext) |

## Desarrollo

```bash
npm install          # dependencias de compilación (Tailwind)
npm run build:css    # compila src/input.css -> styles.css (minificado)
npm run watch:css    # recompila al guardar
npm run serve        # servidor local en http://localhost:8080
npm run icons        # regenera los iconos de /icons
```

El service worker y la instalación PWA requieren `https://` o `localhost`; abrir `index.html` con `file://` funciona para calcular, pero no registra el worker.

## Despliegue en el portal

El repositorio se publica como *project site* de GitHub Pages en `https://tecdea.github.io/mapeolineal/`, dentro del portal `https://tecdea.github.io`.

- `start_url`, `scope`, `id` y todos los recursos usan rutas **relativas**, así que la app funciona igual en la raíz de un dominio que en una subcarpeta.
- `index.html` y `sw.js` están en la raíz de esta carpeta, por lo que el ámbito del worker queda limitado a `/mapeolineal/`.
- `sw.js` descarta cualquier petición de otro origen o de una ruta fuera de `/mapeolineal/`, y sólo limpia cachés con prefijo `mapeolineal-`: no interfiere con las demás aplicaciones del portal.
- `.nojekyll` evita el procesado de Jekyll y sirve los archivos tal cual.

Tras publicar una nueva versión, la app muestra un aviso para recargar y activar el worker actualizado. Cuando cambies `index.html`, `styles.css`, los iconos o las fuentes, incrementa `VERSION` en `sw.js` para invalidar la caché anterior.

El chip junto al título muestra esa misma `VERSION`. La página se la pide al worker activo con `postMessage` + `MessageChannel` (`GET_VERSION`) y, si no responde, recurre al nombre de la caché; así el chip refleja lo que de verdad está en marcha y no una copia del número escrita en el HTML.

## Uso

1. Define los intervalos origen `[a, b]` y destino `[A, B]` (el botón `±` cambia el signo en móvil).
2. Ajusta `x` escribiendo, con el deslizador o arrastrando sobre el gráfico.
3. Copia el resultado `y` con el botón del portapapeles.

