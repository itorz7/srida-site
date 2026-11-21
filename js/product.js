import { initSite, settlePhrases } from './site.js';
import { loadCatalog, actions, card, el, list, phrases, priceNode, productImage, prose, stateNode, PAGE_SIZES } from './shop.js';

initSite();

const root = document.querySelector('[data-product]');
const id = new URLSearchParams(location.search).get('id');
const backToShop = () => el('a', { class: 'btn btn--ghost', href: '/products/', text: 'ดูสินค้าทั้งหมด' });

function block(title, body) {
  return el('section', { class: 'pd-block' }, el('h2', { text: title }), body);
}

function render(p, settings, others) {
  document.title = p.name + ' — Srida.ai';
  const highlights = list(p.highlights);
  const description = list(p.description);
  const specs = list(p.specs).filter((s) => s && s.label && s.value);
  root.replaceChildren(
    el('nav', { class: 'crumb', 'aria-label': 'ตำแหน่งหน้า' },
      el('a', { href: '/products/', text: 'สินค้าและบริการ' }), p.category ? ' / ' + p.category : ''),
    el('article', { class: 'pd' },
      el('div', { class: 'pd-media' },
        productImage(p, null, false, PAGE_SIZES),
        p.sample && el('span', { class: 'tag', text: settings.sampleLabel })),
      el('div', { class: 'pd-info' },
        el('h1', { class: 't-h1', text: p.name }),
        p.tagline && el('p', { class: 'lead' }, phrases(p.tagline)),
        priceNode(p, 'pd-price'),
        el('div', { class: 'pd-actions' }, actions(p, settings, { other: { href: '/products/', text: 'ดูสินค้าทั้งหมด' } })),
        p.sample && settings.sampleNotice && el('p', { class: 'pd-hint' }, phrases(settings.sampleNotice)),
        highlights.length > 0 && block('จุดเด่น', el('ul', { class: 'checks' }, highlights.map((t) => el('li', {}, phrases(t))))),
        description.length > 0 && block('รายละเอียด', el('div', { class: 'prose' }, description.map((t) => el('p', {}, prose(t))))),
        specs.length > 0 && block('ข้อมูลจำเพาะ', el('dl', { class: 'specs' }, specs.flatMap((s) => [el('dt', { text: s.label }), el('dd', {}, phrases(s.value))]))))),
    others.length > 0 && el('section', { class: 'more', 'aria-labelledby': 'h-more' },
      el('div', { class: 'rule-head' }, el('h2', { class: 't-h3', id: 'h-more', text: 'สินค้าอื่น' }), el('a', { class: 'link', href: '/products/', text: 'ดูทั้งหมด' })),
      el('div', { class: 'p-grid' }, others.map((o) => card(o, settings)))));
  settlePhrases();
}

try {
  const { products, settings } = await loadCatalog();
  const product = products.find((p) => p.id === id);
  if (product) render(product, settings, products.filter((p) => p !== product).slice(0, 3));
  else root.replaceChildren(stateNode('ไม่พบสินค้านี้ อาจถูกนำออกจากร้านแล้ว', backToShop()));
} catch {
  root.replaceChildren(stateNode('โหลดข้อมูลสินค้าไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง', backToShop()));
}
