const NEWS_ENDPOINT = 'data/news.json';
const UFM2_ENDPOINT = 'data/ufm2.json';
const REFRESH_MS = 60 * 1000;

const newsList = document.getElementById('news-list');
const ufTableBody = document.getElementById('uf-table-body');
const clockEl = document.getElementById('clock');
const lastUpdatedEl = document.getElementById('last-updated');
const refreshButton = document.getElementById('refresh-news');

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleString('es-CL', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function loadNews(showLoadingState = false) {
  if (showLoadingState) {
    newsList.innerHTML = '<li class="empty">Cargando noticias...</li>';
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
    newsList.innerHTML = '<li class="empty">No se pudieron cargar las noticias.</li>';
    lastUpdatedEl.textContent = 'Última actualización: error al consultar news.json';
  }
}

function renderNews(items) {
  if (!items.length) {
    newsList.innerHTML = '<li class="empty">Sin noticias disponibles</li>';
    return;
  }

  const fragment = document.createDocumentFragment();
  items
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .forEach((item) => {
      const li = document.createElement('li');
      li.className = 'news-card';

      const titleLink = document.createElement('a');
      titleLink.href = item.link;
      titleLink.target = '_blank';
      titleLink.rel = 'noopener noreferrer';
      titleLink.className = 'news-title';
      titleLink.textContent = item.title;

      const meta = document.createElement('p');
      meta.className = 'news-meta';
      meta.textContent = item.pubDate ? `Publicado: ${formatDate(item.pubDate)}` : 'Sin fecha disponible';

      li.appendChild(titleLink);
      li.appendChild(meta);
      fragment.appendChild(li);
    });

  newsList.innerHTML = '';
  newsList.appendChild(fragment);
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
    clockEl.textContent = now.toLocaleTimeString('es-CL', { hour12: false });
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
