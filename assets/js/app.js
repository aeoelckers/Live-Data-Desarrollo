const NEWS_ENDPOINT = 'data/news.json';
const UFM2_ENDPOINT = 'data/ufm2.json';

const REFRESH_MS = 60 * 1000;       // refrescar JSON cada 60s
const HERO_ROTATE_MS = 60 * 1000;   // rotar titular cada 60s

// DOM
const heroLink = document.getElementById('hero-link');
const heroImage = document.getElementById('hero-image');
const heroTitle = document.getElementById('hero-title');
const heroSummary = document.getElementById('hero-summary');
const heroMeta = document.getElementById('hero-meta');
const newsList = document.getElementById('news-list');
const newsNote = document.getElementById('news-note');

const ufTableBody = document.getElementById('uf-table-body');
const clockEl = document.getElementById('clock');
const lastUpdatedEl = document.getElementById('last-updated');
const refreshButton = document.getElementById('refresh-news');

let currentItems = [];
let heroIndex = 0;
let heroTimer = null;

function formatDate(dateStr) {
  if (!dateStr) return 'Sin fecha';
  const date = new Date(dateStr);
  return date.toLocaleString('es-CL', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Santiago',
  });
}

function safeText(s) {
  return (s || '').toString().trim();
}

function clampText(s, max = 140) {
  const t = safeText(s);
  if (!t) return '';
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + '…';
}

function setHero(item) {
  if (!item) return;

  const title = safeText(item.title) || 'Sin título';
  const summary = clampText(item.summary || item.description || title, 160);
  const pub = item.pubDate ? `Publicado: ${formatDate(item.pubDate)} · PortalPortuario` : 'PortalPortuario';

  heroTitle.textContent = title;
  heroSummary.textContent = summary;
  heroMeta.textContent = pub;

  const link = safeText(item.link) || '#';
  heroLink.href = link;

  // Imagen hero
  if (item.image && safeText(item.image).startsWith('http')) {
    heroImage.style.backgroundImage = `url("${item.image}")`;
  } else {
    heroImage.style.backgroundImage = 'linear-gradient(135deg, #0b1d3a, #102a52)';
  }
}

function renderSidebar(items, heroIdx) {
  if (!items.length) {
    newsList.innerHTML = `<li class="empty">Sin noticias disponibles</li>`;
    return;
  }

  // Lateral: siguientes 6 (saltando el hero actual)
  const listItems = items
    .filter((_, idx) => idx !== heroIdx)
    .slice(0, 6);

  if (!listItems.length) {
    newsList.innerHTML = `<li class="empty">Sin más noticias</li>`;
    return;
  }

  const fragment = document.createDocumentFragment();

  listItems.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'news-item';

    // Thumb
    const thumb = document.createElement('div');
    thumb.className = 'news-thumb';

    if (item.image && safeText(item.image).startsWith('http')) {
      const img = document.createElement('img');
      img.src = item.image;
      img.alt = safeText(item.title) || 'Noticia';
      img.referrerPolicy = 'no-referrer';
      img.onerror = () => img.remove();
      thumb.appendChild(img);
    }
    li.appendChild(thumb);

    // Text
    const text = document.createElement('div');
    text.className = 'news-text';

    const a = document.createElement('a');
    a.className = 'news-title';
    a.href = safeText(item.link) || '#';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = clampText(item.title, 95);

    const meta = document.createElement('div');
    meta.className = 'news-meta';
    meta.textContent = item.pubDate ? formatDate(item.pubDate) : '';

    text.appendChild(a);
    text.appendChild(meta);

    li.appendChild(text);
    fragment.appendChild(li);
  });

  newsList.innerHTML = '';
  newsList.appendChild(fragment);
}

function stopHeroRotation() {
  if (heroTimer) {
    clearInterval(heroTimer);
    heroTimer = null;
  }
}

function startHeroRotation() {
  stopHeroRotation();
  if (!currentItems || currentItems.length <= 1) return;

  heroTimer = setInterval(() => {
    heroIndex = (heroIndex + 1) % currentItems.length;
    setHero(currentItems[heroIndex]);
    renderSidebar(currentItems, heroIndex);
  }, HERO_ROTATE_MS);
}

function normalizeNewsItems(items) {
  // Ordenar por fecha descendente (si viene)
  const sorted = [...items].sort((a, b) => {
    const da = new Date(a.pubDate || 0).getTime();
    const db = new Date(b.pubDate || 0).getTime();
    return db - da;
  });

  // Filtrar basura: si viene algún “item” genérico (por seguridad)
  const filtered = sorted.filter((it) => {
    const t = (it.title || '').toLowerCase();
    const l = (it.link || '').toLowerCase();
    if (!t || !l) return false;
    if (t.includes('titulares - portalportuario')) return false;
    if (l.includes('/feed/')) return false;
    return true;
  });

  return filtered;
}

async function loadNews(showLoading = false) {
  if (showLoading) {
    heroTitle.textContent = 'Cargando...';
    heroSummary.textContent = '';
    heroMeta.textContent = '';
    newsList.innerHTML = `<li class="empty">Cargando...</li>`;
    newsNote.style.display = 'none';
  }

  try {
    const res = await fetch(`${NEWS_ENDPOINT}?_=${Date.now()}`);
    if (!res.ok) throw new Error('No se pudo obtener news.json');
    const data = await res.json();

    // timestamp arriba a la derecha
    if (data.lastUpdated) {
      lastUpdatedEl.textContent = `Última actualización: ${formatDate(data.lastUpdated)}`;
    } else if (data.updatedAt) {
      lastUpdatedEl.textContent = `Última actualización: ${formatDate(data.updatedAt)}`;
    } else {
      lastUpdatedEl.textContent = `Última actualización: --`;
    }

    // nota si el backend dejó aviso
    if (data.note) {
      newsNote.textContent = data.note;
      newsNote.style.display = 'block';
    } else {
      newsNote.style.display = 'none';
    }

    const items = normalizeNewsItems(data.items || []);
    if (!items.length) {
      heroTitle.textContent = 'Sin noticias disponibles';
      heroSummary.textContent = '';
      heroMeta.textContent = '';
      newsList.innerHTML = `<li class="empty">Sin noticias disponibles</li>`;
      stopHeroRotation();
      return;
    }

    currentItems = items.slice(0, 10);
    heroIndex = 0;

    setHero(currentItems[heroIndex]);
    renderSidebar(currentItems, heroIndex);
    startHeroRotation();
  } catch (err) {
    console.error(err);
    heroTitle.textContent = 'No se pudieron cargar las noticias';
    heroSummary.textContent = '';
    heroMeta.textContent = '';
    newsList.innerHTML = `<li class="empty">Error al cargar news.json</li>`;
    lastUpdatedEl.textContent = `Última actualización: error`;
    stopHeroRotation();
  }
}

async function loadUFM2() {
  try {
    const res = await fetch(`${UFM2_ENDPOINT}?_=${Date.now()}`);
    if (!res.ok) throw new Error('No se pudo obtener ufm2.json');
    const data = await res.json();
    renderUFM2(data.zones || []);
  } catch (err) {
    console.error(err);
    ufTableBody.innerHTML = '<tr><td colspan="3" class="empty">No se pudo cargar ufm2.json</td></tr>';
  }
}

function renderUFM2(zones) {
  if (!zones.length) {
    ufTableBody.innerHTML = '<tr><td colspan="3" class="empty">Sin datos de UF/m²</td></tr>';
    return;
  }

  const fragment = document.createDocumentFragment();
  zones.forEach((z) => {
    const tr = document.createElement('tr');

    const td1 = document.createElement('td');
    td1.textContent = safeText(z.zone);

    const td2 = document.createElement('td');
    td2.textContent = safeText(z.value);

    const td3 = document.createElement('td');
    td3.textContent = safeText(z.note || '');

    tr.append(td1, td2, td3);
    fragment.appendChild(tr);
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
  setInterval(() => loadNews(false), REFRESH_MS);
}

function init() {
  startClock();
  loadNews(true);
  loadUFM2();
  registerRefresh();
}

init();
