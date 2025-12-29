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

let itemsCache = [];
let rotateIdx = 0;
let rotateTimer = null;
let selectedIdx = null;
let selectedNews = null;
let ufData = [];

const UFM2_STORAGE_KEY = 'ufm2Data';

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
      selectedNews = it;
      highlightSelected();
      renderUfm2();
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
    if (selectedIdx !== null) {
      selectedNews = itemsCache[selectedIdx] || null;
    }

    setHero(itemsCache[rotateIdx]);
    renderList(itemsCache, rotateIdx);

    updateLastUpdated(data.lastUpdated);
    noteEl.textContent = data.lastUpdated
      ? `Actualizado desde RSS: ${formatDate(data.lastUpdated)}`
      : 'Actualización RSS no disponible';

    startRotation();
  } catch (error) {
    noteEl.textContent = 'No fue posible cargar las noticias.';
    updateLastUpdated(null);
    setHero(null);
    renderList([]);
    if (rotateTimer) {
      clearInterval(rotateTimer);
      rotateTimer = null;
    }
    console.error(error);
  }
}

function loadLocalUfm2() {
  try {
    const raw = localStorage.getItem(UFM2_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.zones) ? parsed.zones : null;
  } catch (error) {
    console.error(error);
    return null;
  }
}

function persistUfm2() {
  localStorage.setItem(UFM2_STORAGE_KEY, JSON.stringify({ zones: ufData }));
}

function renderPinnedCell(cell, zone, idx) {
  cell.innerHTML = '';
  cell.className = 'pinned-cell';

  if (zone.pinned && zone.pinned.title) {
    const link = document.createElement('a');
    link.className = 'pinned-link';
    link.href = zone.pinned.link || '#';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = safeText(zone.pinned.title);

    const meta = document.createElement('span');
    meta.className = 'pinned-meta';
    meta.textContent = zone.pinned.pubDate ? formatDate(zone.pinned.pubDate) : '';

    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.className = 'pinned-clear';
    clearButton.textContent = 'Quitar';
    clearButton.addEventListener('click', () => {
      ufData[idx].pinned = null;
      persistUfm2();
      renderUfm2();
    });

    const actions = document.createElement('div');
    actions.className = 'pinned-actions';
    actions.appendChild(clearButton);

    cell.appendChild(link);
    if (meta.textContent) {
      cell.appendChild(meta);
    }
    cell.appendChild(actions);
    return;
  }

  const empty = document.createElement('span');
  empty.className = 'pinned-empty';
  empty.textContent = 'Selecciona una noticia y fíjala.';

  const pinButton = document.createElement('button');
  pinButton.type = 'button';
  pinButton.className = 'pinned-pin';
  pinButton.textContent = 'Fijar';
  pinButton.disabled = !selectedNews;
  pinButton.addEventListener('click', () => {
    if (!selectedNews) return;
    ufData[idx].pinned = {
      title: selectedNews.title,
      link: selectedNews.link,
      pubDate: selectedNews.pubDate
    };
    persistUfm2();
    renderUfm2();
  });

  const actions = document.createElement('div');
  actions.className = 'pinned-actions';
  actions.appendChild(pinButton);

  cell.appendChild(empty);
  cell.appendChild(actions);
}

function renderUfm2() {
  ufBody.innerHTML = '';

  if (!ufData.length) {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="4" class="empty">Sin datos</td>';
    ufBody.appendChild(row);
    return;
  }

  ufData.forEach((zone, idx) => {
    const row = document.createElement('tr');

    const zoneCell = document.createElement('td');
    zoneCell.className = 'editable-cell';
    zoneCell.contentEditable = 'true';
    zoneCell.textContent = safeText(zone.zone) || '-';
    zoneCell.addEventListener('blur', () => {
      ufData[idx].zone = safeText(zoneCell.textContent) || '-';
      persistUfm2();
    });

    const valueCell = document.createElement('td');
    valueCell.className = 'editable-cell';
    valueCell.contentEditable = 'true';
    valueCell.textContent = safeText(zone.value) || '-';
    valueCell.addEventListener('blur', () => {
      ufData[idx].value = safeText(valueCell.textContent) || '-';
      persistUfm2();
    });

    const noteCell = document.createElement('td');
    noteCell.className = 'editable-cell';
    noteCell.contentEditable = 'true';
    noteCell.textContent = safeText(zone.note) || '-';
    noteCell.addEventListener('blur', () => {
      ufData[idx].note = safeText(noteCell.textContent) || '-';
      persistUfm2();
    });

    const pinnedCell = document.createElement('td');
    renderPinnedCell(pinnedCell, zone, idx);

    row.appendChild(zoneCell);
    row.appendChild(valueCell);
    row.appendChild(noteCell);
    row.appendChild(pinnedCell);
    ufBody.appendChild(row);
  });
}

async function loadUfm2() {
  try {
    const data = await fetchJson(UFM2_ENDPOINT);
    const zones = Array.isArray(data.zones) ? data.zones : [];
    const localZones = loadLocalUfm2();
    ufData = localZones || zones;
    renderUfm2();
  } catch (error) {
    ufBody.innerHTML = '<tr><td colspan="4" class="empty">Error al cargar datos</td></tr>';
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
