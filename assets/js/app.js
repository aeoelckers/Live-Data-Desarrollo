const NEWS_ENDPOINT = 'data/news.json';
const UFM2_ENDPOINT = 'data/ufm2.json';

const REFRESH_MS = 60 * 1000;     // refresco de pantalla (lee el json)
const ROTATE_MS  = 60 * 1000;     // rota el titular grande

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

function safeText(s) {
  return (s || '').toString().replace(/\s+/g, ' ').trim();
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
  heroMeta.textContent = item.pubDate ? `Publicado: ${formatDate(item.pubDate)} · PortalPortuario` : 'PortalPortuario';

  const img = safeText(item.image);
  if (img) {
    heroImage.style.backgroundImage = `url("${img}")`;
  } else {
    // fallback elegante si no hay imagen
    heroImage.style.backgroundImage =
      'linear-gradient(135deg, rgba(31,182,255,.35), rgba(58,123,213,.25))';
  }
}

function renderList(items, heroIndex = 0) {
  listEl.innerHTML = '';

  if (!items.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Sin noticias';
    listEl.appendChild(li);
    return;
  }

  items.forEach((it, idx) => {
    if (idx === heroIndex) return;

    const li = document.createElement('li');
    li.className = 'news-item';

    const thumb = document.createElement('div');
    thumb.className = 'news-thumb';
