const NEWS_ENDPOINT = 'data/news.json';
const UFM2_ENDPOINT = 'data/ufm2.json';

const REFRESH_MS = 60 * 1000;   // refrescar news.json cada 1 min
const CAROUSEL_MS = 60 * 1000;  // rotar titular grande cada 1 min

const headlineContainer = document.getElementById('headline');
const newsGrid = document.getElementById('news-grid');
const ufTableBody = document.getElementById('uf-table-body');
const clockEl = document.getElementById('clock');
const lastUpdatedEl = document.getElementById('last-updated');
const refreshButton = document.getElementById('refresh-news');

let carouselItems = [];
let carouselIndex = 0;
let carouselTimer = null;

function formatDate(dateStr) {
  if (!dateStr) return 'Sin fecha disponible';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return 'Sin fecha disponible';
  return date.toLocaleString('es-CL', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Santiago',
  });
}

function formatDateOnly(dateStr) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('es-CL', { timeZone: 'America/Santiago' });
}

function safeText(s) {
  return (s || '').toString().trim();
}

function getSummary(item) {
  if (item?.summary) return safeText(item.summary);
  if (item?.description) return safeText(item.description);
  return 'Sin resumen disponible.';
}

function createSafeImage(src, altText = 'Imagen de la noticia') {
  if (!src) return null;
  const img = document.createElement('img');
  img.src = src;
  img.alt = altText;
  img.referrerPolicy = 'no-referrer';
  img.loading = 'lazy';
  img.onerror = () => img.remove();
  return img;
}

function stopCarousel() {
  if (carouselTimer) {
    clearInterval(carouselTimer);
    carouselTimer = null;
  }
}

function startCarousel(items) {
  stopCarousel();
  if (!items || items.length <= 1) return;

  carouselTimer = setInterval(() => {
    carouselIndex = (carouselIndex + 1) % items.length;
    const headline = items[carouselIndex];
    const gridItems = items.filter((_, idx) => idx !== carouselIndex);
    renderHeadline(headline);
    renderGrid(gridItems);
  }, CAROUSEL_MS);
}

function pickToday(items) {
  // Si tus items traen pubDate confiable, esto sirve.
  // Si todos traen "ahora", igual devuelve items (no rompe).
  const todayStr = new Date().toLocaleDateString('es-CL', { timeZone: 'America/Santiago' });
  const todays = items.filter((item) => {
    if (!item?.pubDate) return false;
    const itemDate = formatDateOnly(item.pubDate);
    return itemDate && itemDate === todayStr;
  });
  return todays.length ? todays : items;
}

function renderHeadline(item) {
  if (!item) {
    headlineContainer.innerHTML = '<p class="empty">Sin noticias disponibles</p>';
    return;
  }

  headlineContainer.innerHTML = '';

  if (item.image) {
    const figure = document.createElement('div');
    figure.className = 'headline-figure';
    const img = createSafeImage(item.image, item.title || 'Imagen de la noticia');
    if (img) {
      figure.appendChild(img);
      headlineContainer.appendChild(figure);
    }
  }

  const title = document.createElement('a');
  title.href = item.link || '#';
  title.target = '_blank';
  title.rel = 'noopener noreferrer';
  title.className = 'headline-title';
  title.textContent = item.title || 'Titular';

  const summary = document.createElement('p');
  summary.className = 'headline-summary';
  summary.textContent = getSummary(item);

  const meta = document.createElement('p');
  meta.className = 'headline-meta';
  meta.textContent = item.pubDate
    ? `Publicado: ${formatDate(item.pubDate)} · PortalPortuario`
    : 'PortalPortuario';

  headlineContainer.append(title, summary, meta);
}

function renderGrid(items) {
  if (!items || !items.length) {
    newsGrid.innerHTML = '<p class="empty">No hay más noticias para mostrar.</p>';
    return;
  }

  const fragment = document.createDocumentFragment();

  items.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'news-card';

    const content = document.createElement('div');
    content.className = 'news-content';

    const titleLink = document.createElement('a');
    titleLink.href = item.link || '#';
    titleLink.target = '_blank';
    titleLink.rel = 'noopener noreferrer';
    titleLink.className = 'news-title';
    titleLink.textContent = item.title || 'Noticia';

    const summary = document.createElement('p');
    summary.className = 'news-summary';
    summary.textContent = getSummary(item);

    const meta = document.createElement('p');
    meta.className = 'news-meta';
    meta.textContent = item.pubDate
      ? `Publicado: ${formatDate(item.pubDate)}`
      : 'Sin fecha disponible';

    content.append(titleLink, summary, meta);
    card.appendChild(content);

    if (item.image) {
      const thumb = document.createElement('div');
      thumb.className = 'news-thumb';
      const img = createSafeImage(item.image, item.title || 'Imagen');
      if (img) {
        thumb.appendChild(img);
        card.appendChild(thumb);
      } else {
        card.classList.add('no-thumb');
      }
    } else {
      card.classList.add('no-thumb');
    }

    fragment.appendChild(card);
  });

  newsGrid.innerHTML = '';
  newsGrid.appendChild(fragment);
}

function renderNews(items) {
  if (!items || !items.length) {
    headlineContainer.innerHTML = '<p class="empty">Sin noticias disponibles</p>';
    newsGrid.innerHTML = '';
    stopCarousel();
    return;
  }

  // Ordenar por pubDate si existe (si no, no rompe)
  const sorted = [...items].sort((a, b) => {
    const da = new Date(a.pubDate || 0).getTime();
    const db = new Date(b.pubDate || 0).getTime();
    return db - da;
  });

  const todays = pickToday(sorted);

  // EXACTAMENTE 3 titulares: 1 grande + 2 chicos
  const latest = todays.slice(0, 3);

  carouselItems = latest;
  carouselIndex = 0;

  renderHeadline(latest[0]);
  renderGrid(latest.slice(1));
  startCarousel(latest);
}

async function loadNews(showLoadingState = false) {
  if (showLoadingState) {
    newsGrid.innerHTML = '<p class="empty">Cargando noticias...</p>';
    headlineContainer.innerHTML = '';
  }

  try {
    const response = await fetch(`${NEWS_ENDPOINT}?_=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('No se pudo obtener news.json');
    const data = await response.json();

    renderNews(data.items || []);

    const stamp = data.lastUpdated || data.updatedAt || data.checkedAt;
    if (stamp) {
      lastUpdatedEl.textContent = `Última actualización: ${formatDate(stamp)}`;
    } else {
      lastUpdatedEl.textContent = 'Última actualización: sin timestamp';
    }
  } catch (error) {
    console.error('Error cargando noticias', error);
    newsGrid.innerHTML = '<p class="empty">No se pudieron cargar las noticias.</p>';
    headlineContainer.innerHTML = '';
    lastUpdatedEl.textContent = 'Última actualización: error al consultar news.json';
    stopCarousel();
  }
}

function renderTable(zones) {
  if (!zones || !zones.length) {
    ufTableBody.innerHTML = '<tr><td colspan="3" class="empty">Sin datos de UF/m²</td></tr>';
    return;
  }

  const fragment = document.createDocumentFragment();
  zones.forEach((zone) => {
    const row = document.createElement('tr');

    const zoneCell = document.createElement('td');
    zoneCell.textContent = zone.zone ?? zone.zona ?? '';

    const valueCell = document.createElement('td');
    valueCell.textContent = zone.value ?? zone.ufm2 ?? '';

    const noteCell = document.createElement('td');
    noteCell.textContent = zone.note ?? zone.obs ?? zone.observacion ?? '';

    row.append(zoneCell, valueCell, noteCell);
    fragment.appendChild(row);
  });

  ufTableBody.innerHTML = '';
  ufTableBody.appendChild(fragment);
}

async function loadUFM2() {
  try {
    const response = await fetch(`${UFM2_ENDPOINT}?_=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('No se pudo obtener ufm2.json');
    const data = await response.json();

    // Soporta ambos formatos:
    // A) { "zones": [...] }  (tu formato actual)
    // B) [ ... ]            (si después cambias a array)
    const zones = Array.isArray(data) ? data : (data.zones || []);
    renderTable(zones);
  } catch (error) {
    console.error('Error cargando UF/m²', error);
    ufTableBody.innerHTML = '<tr><td colspan="3" class="empty">No se pudo cargar ufm2.json</td></tr>';
  }
}

function startClock() {
  const tick = () => {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('es-CL', {
      hour12: false,
      timeZone: 'America/Santiago',
    });
  };
  tick();
  setInterval(tick, 1000);
}

function registerRefresh() {
  refreshButton?.addEventListener('click', () => loadNews(true));
  setInterval(() => loadNews(), REFRESH_MS);
}

function init() {
  startClock();
  loadNews(true);
  loadUFM2();
  registerRefresh();
}

init();
