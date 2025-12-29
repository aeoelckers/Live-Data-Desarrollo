const NEWS_ENDPOINT = 'data/news.json';
const UFM2_ENDPOINT = 'data/ufm2.json';

const REFRESH_MS = 60 * 1000;
const ROTATE_MS = 60 * 1000;

const clockEl = document.getElementById('clock');
const lastUpdatedEl = document.getElementById('last-updated');
const refreshBtn = document.getElementById('refresh-news');

const heroLink = document.getElementById('hero-link');
const heroImage = document.getElementById('hero-image');
const heroTitle = document.getElementById('hero-title');
const heroSummary = document.getElementById('hero-summary');
const heroMeta = document.getElementById('hero-meta');

const listEl = document.getElementById('news-list');
const noteEl = document.getElementById('news-note');

const ufBody = document.getElementById('uf-table-body');
const featuredLink = document.getElementById('featured-link');
const featuredTitle = document.getElementById('featured-title');
const featuredSummary = document.getElementById('featured-summary');
const featuredMeta = document.getElementById('featured-meta');

let itemsCache = [];
let rotateIdx = 0;
let rotateTimer = null;
let selectedIdx = null;

function formatDate(dateStr) {
  if (!dateStr) return 'Sin fecha';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 'Sin fecha';
  return d.toLocaleString('es-CL', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Santiago'
  });
}

function formatClock(date = new Date()) {
  return date.toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'America/Santiago'
  });
}

function safeText(value) {
  return (value || '').toString().replace(/\s+/g, ' ').trim();
}

function setHero(item) {
  if (!item) {
    heroTitle.textContent = 'Sin noticias disponibles';
    heroSummary.textContent = '';
    heroMeta.textContent = '';
    heroImage.style.backgroundImage = '';
    heroLink.href = '#';
    return;
  }

  heroLink.href = item.link || '#';
  heroTitle.textContent = safeText(item.title) || 'Sin título';
  heroSummary.textContent = safeText(item.summary) || '';
  heroMeta.textContent = item.pubDate
    ? `Publicado: ${formatDate(item.pubDate)} · PortalPortuario`
    : 'PortalPortuario';

  const img = safeText(item.image);
  heroImage.style.backgroundImage = img
    ? `url("${img}")`
    : 'linear-gradient(135deg, rgba(31,182,255,.35), rgba(58,123,213,.25))';
}

function setFeatured(item) {
  if (!item) {
    featuredTitle.textContent = 'Selecciona una noticia';
    featuredSummary.textContent = '';
    featuredMeta.textContent = '';
    featuredLink.href = '#';
    return;
  }

  featuredTitle.textContent = safeText(item.title) || 'Sin título';
  featuredSummary.textContent = safeText(item.summary) || '';
  featuredMeta.textContent = item.pubDate ? `Publicado: ${formatDate(item.pubDate)}` : 'PortalPortuario';
  featuredLink.href = item.link || '#';
}

function highlightSelected() {
  const items = listEl.querySelectorAll('.news-item');
  items.forEach((li) => li.classList.remove('is-selected'));
  if (selectedIdx === null) return;

  const selected = listEl.querySelector(`[data-index="${selectedIdx}"]`);
  if (selected) {
    selected.classList.add('is-selected');
  }
}

function renderList(items, heroIndex = 0) {
  listEl.innerHTML = '';

  if (!items.length) {
    const li = document.createElement('li');
    li.className = 'news-item empty';
    li.textContent = 'Sin noticias';
    listEl.appendChild(li);
    return;
  }

  items.forEach((it, idx) => {
    if (idx === heroIndex) return;

    const li = document.createElement('li');
    li.className = 'news-item';
    li.dataset.index = String(idx);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'news-link';
    button.addEventListener('click', () => {
      selectedIdx = idx;
      setFeatured(it);
      highlightSelected();
    });

    const thumb = document.createElement('div');
    thumb.className = 'news-thumb';
    const img = safeText(it.image);
    if (img) {
      thumb.style.backgroundImage = `url("${img}")`;
    }

    const content = document.createElement('div');
    content.className = 'news-content';

    const title = document.createElement('p');
    title.className = 'news-title';
    title.textContent = safeText(it.title) || 'Sin título';

    const meta = document.createElement('p');
    meta.className = 'news-meta';
    meta.textContent = it.pubDate ? formatDate(it.pubDate) : 'PortalPortuario';

    content.appendChild(title);
    content.appendChild(meta);

    button.appendChild(thumb);
    button.appendChild(content);
    li.appendChild(button);
    listEl.appendChild(li);
  });

  highlightSelected();
}

function updateClock() {
  clockEl.textContent = formatClock();
}

function updateLastUpdated(value) {
  if (!value) {
    lastUpdatedEl.textContent = 'Última actualización: --';
    return;
  }
  lastUpdatedEl.textContent = `Última actualización: ${formatDate(value)}`;
}

function startRotation() {
  if (rotateTimer) clearInterval(rotateTimer);
  if (!itemsCache.length) return;

  rotateTimer = setInterval(() => {
    rotateIdx = (rotateIdx + 1) % itemsCache.length;
    setHero(itemsCache[rotateIdx]);
    renderList(itemsCache, rotateIdx);
    if (selectedIdx === null) {
      setFeatured(itemsCache[rotateIdx]);
    }
  }, ROTATE_MS);
}

async function fetchJson(path) {
  const url = `${path}?v=${Date.now()}`;
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Error al cargar ${path}`);
  }
  return response.json();
}

async function loadNews() {
  try {
    const data = await fetchJson(NEWS_ENDPOINT);
    const items = Array.isArray(data.items) ? data.items.filter(Boolean) : [];

    itemsCache = items;
    rotateIdx = 0;
    if (selectedIdx !== null && selectedIdx >= itemsCache.length) {
      selectedIdx = null;
    }

    setHero(itemsCache[rotateIdx]);
    renderList(itemsCache, rotateIdx);

    updateLastUpdated(data.lastUpdated);
    noteEl.textContent = data.lastUpdated
      ? `Actualizado desde RSS: ${formatDate(data.lastUpdated)}`
      : 'Actualización RSS no disponible';

    startRotation();
    if (selectedIdx === null) {
      setFeatured(itemsCache[rotateIdx]);
    }
  } catch (error) {
    noteEl.textContent = 'No fue posible cargar las noticias.';
    updateLastUpdated(null);
    setHero(null);
    renderList([]);
    setFeatured(null);
    if (rotateTimer) {
      clearInterval(rotateTimer);
      rotateTimer = null;
    }
    console.error(error);
  }
}

async function loadUfm2() {
  try {
    const data = await fetchJson(UFM2_ENDPOINT);
    const zones = Array.isArray(data.zones) ? data.zones : [];
    ufBody.innerHTML = '';

    if (!zones.length) {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="3" class="empty">Sin datos</td>';
      ufBody.appendChild(row);
      return;
    }

    zones.forEach((zone) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${safeText(zone.zone) || '-'}</td>
        <td>${safeText(zone.value) || '-'}</td>
        <td>${safeText(zone.note) || '-'}</td>
      `;
      ufBody.appendChild(row);
    });
  } catch (error) {
    ufBody.innerHTML = '<tr><td colspan="3" class="empty">Error al cargar datos</td></tr>';
    console.error(error);
  }
}

function refreshAll() {
  loadNews();
  loadUfm2();
}

refreshBtn.addEventListener('click', refreshAll);

updateClock();
setInterval(updateClock, 1000);
refreshAll();
setInterval(refreshAll, REFRESH_MS);
