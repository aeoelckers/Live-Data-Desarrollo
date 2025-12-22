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
  title.textContent = item.title || 'Titula
