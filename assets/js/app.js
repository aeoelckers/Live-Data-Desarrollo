const NEWS_ENDPOINT = 'data/news.json';
const UFM2_ENDPOINT = 'data/ufm2.json';
const REFRESH_MS = 60 * 1000;
const CAROUSEL_MS = 60 * 1000;

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
  const date = new Date(dateStr);
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
  return date.toLocaleDateString('es-CL', { timeZone: 'America/Santiago' });
}

async function loadNews(showLoadingState = false) {
  if (showLoadingState) {
    newsGrid.innerHTML = '<p class="empty">Cargando noticias...</p>';
    headlineContainer.innerHTML = '';
  }

  try {
    const response = await fetch(`${NEWS_ENDPOINT}?_=${Date.now()}`);
    if (!response.ok) throw new Error('No se pudo obtener news.json');
    const data = await response.json();
    renderNews(data.items || []);
    if (data.lastUpdated) {
      lastUpdatedEl.textContent = `Última actualización: ${formatDate(data.lastUpdated)}`;
    }
  } catch (error) {
    console.error('Error cargando noticias', error);
    newsGrid.innerHTML = '<p class="empty">No se pudieron cargar las noticias.</p>';
    headlineContainer.innerHTML = '';
    lastUpdatedEl.textContent = 'Última actualización: error al consultar news.json';
    stopCarousel();
  }
}

function pickToday(items) {
  const today = new Date();
  const todayStr = today.toLocaleDateString('es-CL', { timeZone: 'America/Santiago' });
  const todays = items.filter((item) => {
    if (!item.pubDate) return false;
    const itemDate = formatDateOnly(item.pubDate);
    return itemDate === todayStr;
  });
  return todays.length ? todays : items;
}

function getSummary(item) {
  if (item.summary) return item.summary;
  if (item.description) return item.description;
  return 'Sin resumen disponible.';
}

function renderHeadline(item) {
  if (!item) {
    headlineContainer.innerHTML = '<p class="empty">Sin noticias del día</p>';
    return;
  }

  headlineContainer.innerHTML = '';
  const title = document.createElement('a');
  title.href = item.link;
  title.target = '_blank';
  title.rel = 'noopener noreferrer';
  title.className = 'headline-title';
  title.textContent = item.title;

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
  if (!items.length) {
    newsGrid.innerHTML = '<p class="empty">No hay más noticias para hoy.</p>';
    return;
  }

  const fragment = document.createDocumentFragment();
  items.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'news-card';

    const titleLink = document.createElement('a');
    titleLink.href = item.link;
    titleLink.target = '_blank';
    titleLink.rel = 'noopener noreferrer';
    titleLink.className = 'news-title';
    titleLink.textContent = item.title;

    const summary = document.createElement('p');
    summary.className = 'news-summary';
    summary.textContent = getSummary(item);

    const meta = document.createElement('p');
    meta.className = 'news-meta';
    meta.textContent = item.pubDate
      ? `Publicado: ${formatDate(item.pubDate)}`
      : 'Sin fecha disponible';

    card.append(titleLink, summary, meta);
    fragment.appendChild(card);
  });

  newsGrid.innerHTML = '';
  newsGrid.appendChild(fragment);
}

function stopCarousel() {
  if (carouselTimer) {
    clearInterval(carouselTimer);
    carouselTimer = null;
  }
}

function startCarousel(items) {
  stopCarousel();
  if (items.length <= 1) return;
  carouselTimer = setInterval(() => {
    carouselIndex = (carouselIndex + 1) % items.length;
    const headline = items[carouselIndex];
    const gridItems = items.filter((_, idx) => idx !== carouselIndex);
    renderHeadline(headline);
    renderGrid(gridItems);
  }, CAROUSEL_MS);
}

function renderNews(items) {
  if (!items.length) {
    headlineContainer.innerHTML = '<p class="empty">Sin noticias disponibles</p>';
    newsGrid.innerHTML = '';
    stopCarousel();
    return;
  }

  const sorted = [...items].sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  const todays = pickToday(sorted);
  const latestThree = todays.slice(0, 3);

  if (!latestThree.length) {
    headlineContainer.innerHTML = '<p class="empty">Sin noticias disponibles</p>';
    newsGrid.innerHTML = '';
    stopCarousel();
    return;
  }

  carouselIndex = 0;
  carouselItems = latestThree;

  renderHeadline(latestThree[0]);
  renderGrid(latestThree.slice(1));
  startCarousel(latestThree);
}

async function loadUFM2() {
  try {
    const response = await fetch(`${UFM2_ENDPOINT}?_=${Date.now()}`);
    if (!response.ok) throw new Error('No se pudo obtener ufm2.json');
    const data = await response.json();
    renderTable(data.zones || []);
  } catch (error) {
    console.error('Error cargando UF/m²', error);
    ufTableBody.innerHTML = '<tr><td colspan="3" class="empty">No se pudo cargar ufm2.json</td></tr>';
  }
}

function renderTable(zones) {
  if (!zones.length) {
    ufTableBody.innerHTML = '<tr><td colspan="3" class="empty">Sin datos de UF/m²</td></tr>';
    return;
  }

  const fragment = document.createDocumentFragment();
  zones.forEach((zone) => {
    const row = document.createElement('tr');

    const zoneCell = document.createElement('td');
    zoneCell.textContent = zone.zone;

    const valueCell = document.createElement('td');
    valueCell.textContent = zone.value;

    const noteCell = document.createElement('td');
    noteCell.textContent = zone.note || '';

    row.append(zoneCell, valueCell, noteCell);
    fragment.appendChild(row);
  });

  ufTableBody.innerHTML = '';
  ufTableBody.appendChild(fragment);
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
