// /products/: the cards, chips and count are in the page from the build (tools/shop_static.py, tools/build.py).
// The chips filter the cards that are there. After load the page asks for /data/products.json once: when the file is the one
// the page was built from (same digest as data-catalog) nothing on the page is touched; when it changed, the list is drawn
// again from it; when it cannot be read, the built list stays.
import { initSite, settlePhrases, afterLoad } from './site.js';
import { loadCatalog, card, el, phrases, stateNode } from './shop.js';

initSite();

const grid = document.querySelector('[data-products]');
const filters = document.querySelector('[data-filters]');
const count = document.querySelector('[data-count]');
const notice = document.querySelector('[data-sample-notice]');
const ALL = 'ทั้งหมด';
let current = ALL;

function show() {
  const cards = [...grid.querySelectorAll('.p-card')];
  let shown = 0;
  for (const c of cards) {
    const on = current === ALL || c.dataset.category === current;
    c.hidden = !on;
    shown += on;
  }
  count.textContent = cards.length ? shown.toLocaleString('th-TH') + ' รายการ' : '';
  filters.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.category === current)));
}

filters.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip || chip.dataset.category === current) return;
  current = chip.dataset.category;
  show();
});

await afterLoad();
try {
  const { products, settings, hash } = await loadCatalog();
  if (hash && hash === grid.dataset.catalog) {
    window.sridaCatalog = 'same';
  } else {
    notice.hidden = !(settings.sampleNotice && products.some((p) => p.sample));
    if (!notice.hidden) notice.replaceChildren(...phrases(settings.sampleNotice));
    current = ALL;
    grid.replaceChildren(...(products.length ? products.map((p, i) => card(p, settings, { full: true, eager: i === 0 })) : [stateNode('ยังไม่มีสินค้าในตอนนี้')]));
    // the chips come from the cards on the page
    const categories = [...new Set([...grid.querySelectorAll('.p-card')].map((c) => c.dataset.category).filter(Boolean))];
    filters.replaceChildren(...(categories.length > 1 ? [ALL, ...categories].map((c) => el('button', { class: 'chip', type: 'button', 'data-category': c, 'aria-pressed': String(c === ALL), text: c })) : []));
    show();
    settlePhrases();
    window.sridaCatalog = 'drawn';
  }
} catch {
  window.sridaCatalog = 'kept';
}
dispatchEvent(new Event('srida:catalog'));
