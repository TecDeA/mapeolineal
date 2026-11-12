/**
 * Service Worker — Mapeo Lineal de Intervalos
 *
 * Despliegue: https://tecdea.github.io/mapeolineal/
 *
 * Aislamiento respecto al portal
 * ------------------------------
 * Este archivo vive en /mapeolineal/sw.js, por lo que su ámbito máximo es
 * /mapeolineal/. Además, todas las comprobaciones de `fetch` descartan
 * cualquier petición que no empiece por esa ruta, de modo que el worker no
 * intercepta https://tecdea.github.io/ ni ninguna otra aplicación del portal.
 * Los nombres de caché llevan el prefijo "mapeolineal-" y la limpieza sólo
 * elimina cachés con ese prefijo; nunca toca las del resto del sitio.
 */

'use strict';

const VERSION = '1.0.5';
const CACHE_PREFIX = 'mapeolineal-';
const CACHE_NAME = `${CACHE_PREFIX}v${VERSION}`;

/** Carpeta de la aplicación: /mapeolineal/ */
const BASE = new URL('./', self.location.href);
const SCOPE_PATH = BASE.pathname;
const OFFLINE_URL = new URL('index.html', BASE).href;

/** Recursos imprescindibles: si fallan, la instalación se considera fallida. */
const CRITICAL = new Set(['index.html', 'styles.css']);

const PRECACHE_PATHS = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './fonts/inter-latin.woff2',
  './fonts/inter-latin-ext.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon-180.png',
  './icons/favicon-32.png',
  './icons/favicon.svg',
];

/* -------------------------------------------------------------------------- */
/* Instalación                                                                */
/* -------------------------------------------------------------------------- */

self.addEventListener('install', (event) => {
  event.waitUntil(precache());
});

async function precache() {
  const cache = await caches.open(CACHE_NAME);
  const failures = [];

  await Promise.all(
    PRECACHE_PATHS.map(async (path) => {
      const url = new URL(path, BASE).href;
      try {
        const request = new Request(url, { cache: 'reload', credentials: 'same-origin' });
        const response = await fetch(request);
        if (!response || !response.ok) {
          throw new Error(`${response ? response.status : 'sin respuesta'} → ${url}`);
        }
        await cache.put(url, response);
      } catch (error) {
        failures.push({ path, error });
      }
    })
  );

  if (failures.length) {
    failures.forEach(({ path, error }) => console.error('[SW] No se pudo precachear', path, error));
    const criticalFailure = failures.some(({ path }) => CRITICAL.has(path.replace('./', '')));
    if (criticalFailure) {
      throw new Error('[SW] Faltan recursos críticos para funcionar sin conexión');
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Activación                                                                 */
/* -------------------------------------------------------------------------- */

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );

      // El cliente que provocó la actualización recarga al recibir el mensaje,
      // así que aquí sólo tomamos el control de las pestañas de esta app.
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  const data = event.data || {};

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  // La página pide la versión activa para mostrarla en el chip del encabezado.
  if (data.type === 'GET_VERSION') {
    const replyPort = event.ports && event.ports[0];
    if (replyPort) replyPort.postMessage({ type: 'VERSION', version: VERSION });
  }
});

/* -------------------------------------------------------------------------- */
/* Estrategias de red                                                         */
/* -------------------------------------------------------------------------- */

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;
  if (request.headers.has('range')) return;

  let url;
  try {
    url = new URL(request.url);
  } catch (error) {
    return;
  }

  // Nunca interceptamos otros orígenes (CDNs, APIs) ni rutas del portal.
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(SCOPE_PATH)) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(event));
    return;
  }

  event.respondWith(handleAsset(event));
});

/**
 * Navegaciones: red primero (contenido siempre fresco), caché como respaldo.
 */
async function handleNavigation(event) {
  const { request } = event;
  const cache = await caches.open(CACHE_NAME);
  const url = new URL(request.url);

  try {
    const response = await fetch(request);
    if (response && response.ok && !url.search) {
      event.waitUntil(cache.put(request, response.clone()).catch(() => {}));
    }
    return response;
  } catch (error) {
    const cached =
      (await cache.match(request, { ignoreSearch: true })) ||
      (await cache.match(OFFLINE_URL)) ||
      (await cache.match(BASE.href));

    if (cached) return cached;

    return new Response(
      '<!DOCTYPE html><meta charset="utf-8"><title>Sin conexión</title>' +
        '<body style="font-family:system-ui;padding:2rem;text-align:center">' +
        '<h1>Sin conexión</h1><p>Vuelve a abrir la aplicación cuando recuperes la red.</p>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

/**
 * Recursos estáticos: caché primero y revalidación en segundo plano.
 */
async function handleAsset(event) {
  const { request } = event;
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then(async (response) => {
      if (response && response.ok && response.type === 'basic') {
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    event.waitUntil(network.then(() => {}).catch(() => {}));
    return cached;
  }

  const response = await network;
  if (response) return response;

  return new Response('', { status: 504, statusText: 'Recurso no disponible sin conexión' });
}
