// /pricing/: the rows are in the page from the build. After load the page asks for /data/pricing.json once and draws the rows
// again only when the file changed since that build (its digest differs from data-catalog), so a price or a package still
// changes by editing that one file. A file that cannot be read leaves the built rows.
// row() mirrors row() in tools/content_pricing.py: change both together. Text from the file is never parsed as HTML.
import { initSite, afterLoad, catalogHash } from './site.js';

initSite();

const DEFAULTS = { askLabel: 'สอบถามราคา', fromLabel: 'เริ่มต้น', draftLabel: '', showDraftLabel: false, ctaLabel: 'ปรึกษาฟรี', ctaUrl: '/#contact' };
const list = document.querySelector('[data-pricing]');
const tick = document.getElementById('price-icons')?.content.querySelector('[data-icon="check"]')?.firstElementChild; // the one icon a row uses
const icon = () => tick.cloneNode(true);
const safeUrl = (u) => (typeof u === 'string' && /^(https?:\/\/|mailto:|tel:|\/(?!\/))/i.test(u.trim()) ? u.trim() : '');

function h(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value == null) continue;
    if (key === 'class') node.className = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) node.append(kid);
  return node;
}

function row(p, s) {
  const has = typeof p.price === 'number' && Number.isFinite(p.price);
  const price = has
    ? [h('span', { class: 'price-from' }, s.fromLabel), h('p', { class: 'price-num' }, '฿' + p.price.toLocaleString('en-US'), p.unit && h('span', { class: 'price-unit' }, p.unit))]
    : [h('p', { class: 'price-num price-num--ask' }, s.askLabel)];
  const more = p.more && safeUrl(p.more.url) && p.more.label ? h('a', { class: 'link', href: safeUrl(p.more.url) }, p.more.label) : null;
  return h('li', { class: 'price-row', 'data-id': p.id },
    h('div', { class: 'price-what' }, h('h2', { class: 'price-name' }, p.name), h('p', {}, p.desc || ''), more),
    h('ul', { class: 'ticks price-points' }, (Array.isArray(p.points) ? p.points : []).filter(Boolean).map((t) => h('li', {}, icon(), String(t)))),
    h('div', { class: 'price-cell' },
      s.showDraftLabel && s.draftLabel && !p.final && h('span', { class: 'price-draft', 'data-draft': true }, s.draftLabel),
      price,
      p.note && h('span', { class: 'price-note' }, p.note),
      h('a', { class: 'btn btn--flesh btn--s', href: safeUrl(s.ctaUrl) || '/#contact' }, s.ctaLabel)));
}

if (list && tick) {
  await afterLoad();
  try {
    const res = await fetch('/data/pricing.json', { cache: 'no-cache' });
    const buf = res.ok ? await res.arrayBuffer() : null;
    const hash = buf && (await catalogHash(buf));
    window.sridaCatalog = !buf ? 'kept' : hash && hash === list.dataset.catalog ? 'same' : 'drawn';
    if (window.sridaCatalog === 'drawn') {
      const data = JSON.parse(new TextDecoder().decode(buf));
      const s = { ...DEFAULTS, ...(data.settings || {}) };
      const plans = (Array.isArray(data.plans) ? data.plans : []).filter((p) => p && p.id && p.name && !p.hidden);
      list.replaceChildren(...(plans.length ? plans.map((p) => row(p, s)) : [h('li', { class: 'state', role: 'status' }, 'ยังไม่มีแพ็กเกจในตอนนี้')]));
    }
  } catch {
    window.sridaCatalog = 'kept'; // the rows written at build time stay
  }
  dispatchEvent(new Event('srida:catalog'));
}
