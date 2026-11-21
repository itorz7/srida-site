import { initSite, settlePhrases } from './site.js';
import { loadCatalog, card, el, phrases, stateNode } from './shop.js';

initSite();

const grid = document.querySelector('[data-products]');
const filters = document.querySelector('[data-filters]');
const count = document.querySelector('[data-count]');
const notice = document.querySelector('[data-sample-notice]');
const ALL = 'ทั้งหมด';

try {
  const { products, settings } = await loadCatalog();
  // the page ships with the notice, chips and count drawn from the file at build time; redraw them from the live file
  notice.hidden = !(settings.sampleNotice && products.some((p) => p.sample));
  if (!notice.hidden) notice.replaceChildren(...phrases(settings.sampleNotice));
  filters.replaceChildren();
  count.textContent = '';
  if (!products.length) {
    grid.replaceChildren(stateNode('ยังไม่มีสินค้าในตอนนี้'));
  } else {
    const categories = [...new Set(products.map((p) => p.category).filter(Boolean))];
    let current = ALL;

    const draw = () => {
      const shown = products.filter((p) => current === ALL || p.category === current);
      grid.replaceChildren(...shown.map((p) => card(p, settings, { full: true })));
      count.textContent = shown.length.toLocaleString('th-TH') + ' รายการ';
      filters.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.category === current)));
      settlePhrases();
    };

    if (categories.length > 1) {
      filters.replaceChildren(...[ALL, ...categories].map((c) => el('button', { class: 'chip', type: 'button', 'data-category': c, 'aria-pressed': 'false', text: c })));
      filters.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip');
        if (!chip || chip.dataset.category === current) return;
        current = chip.dataset.category;
        draw();
      });
    }
    draw();
  }
} catch {
  notice.hidden = true;
  filters.replaceChildren();
  count.textContent = '';
  grid.replaceChildren(stateNode('โหลดรายการสินค้าไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง'));
}
