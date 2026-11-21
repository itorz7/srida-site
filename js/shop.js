// The shop: everything here is drawn from /data/products.json. Add, remove or edit a product in that file only.
const LOGO = '/assets/logo-224.webp';
const DEFAULTS = {
  orderUrl: '',
  orderLabel: 'สั่งซื้อ / สอบถาม',
  pendingLabel: 'ช่องทางสั่งซื้อเปิดเร็ว ๆ นี้',
  sampleLabel: 'ตัวอย่าง',
  sampleOrderLabel: 'ยังไม่เปิดขาย',
  sampleNotice: '',
  keepTogether: [],
};

// from settings.keepTogether: words and names a line break must never split
let keepTogether = null; // all of them, as one pattern
let spacedNames = null; // the ones written with a space inside ("LM Studio")
const NBSP = '\u00a0';
const escapeRe = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pattern = (words) => (words.length ? new RegExp(words.map(escapeRe).join('|'), 'g') : null);

export async function loadCatalog() {
  const res = await fetch('/data/products.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('products.json: HTTP ' + res.status);
  const data = await res.json();
  const settings = { ...DEFAULTS, ...(data.settings || {}) };
  const products = (Array.isArray(data.products) ? data.products : []).filter((p) => p && p.id && p.name && !p.hidden);
  const words = list(settings.keepTogether).filter((w) => typeof w === 'string' && w.trim()).map((w) => w.trim()).sort((a, b) => b.length - a.length);
  spacedNames = pattern(words.filter((w) => w.includes(' ')));
  keepTogether = pattern(words.map((w) => w.replaceAll(' ', NBSP)));
  return { settings, products };
}

// Build DOM nodes without ever parsing product text as HTML.
export function el(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value == null) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) node.append(kid);
  return node;
}

export const safeUrl = (u) => (typeof u === 'string' && /^(https?:\/\/|mailto:|tel:|\/(?!\/))/i.test(u.trim()) ? u.trim() : '');
export const productUrl = (p) => '/product/?id=' + encodeURIComponent(p.id);
export const list = (v) => (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean);

// Thai puts spaces between phrases, not between words, and a browser guesses the word breaks from a dictionary.
// So a line of product text breaks where the writer left a space: every phrase up to SHORT_PHRASE letters is kept whole
// (settlePhrases() in site.js releases one that turns out wider than its column). A longer phrase flows as normal text.
// Either way the words listed in settings.keepTogether are never split.
// A connective never ends a line: it travels with the phrase after it.
const SHORT_PHRASE = 30;
const LEAD_INS = new Set(['และ', 'หรือ', 'กับ', 'แต่', 'สำหรับ']);
const visibleLength = (s) => s.replace(/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g, '').length;

function flow(text) {
  if (!keepTogether) return [text];
  const out = [];
  let last = 0;
  for (const m of text.matchAll(keepTogether)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(el('span', { class: 'nw', text: m[0] }));
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const joinNames = (text) => (spacedNames ? String(text).replace(spacedNames, (m) => m.replaceAll(' ', NBSP)) : String(text));

// Running text (a description paragraph) wraps like any paragraph; only the keepTogether words are protected.
export const prose = (text) => flow(joinNames(text));

// Short text (a tagline, a highlight, a price line): phrase by phrase.
export function phrases(text) {
  const raw = joinNames(text).split(' ').filter(Boolean);
  const parts = [];
  for (let i = 0; i < raw.length; i++) {
    let part = raw[i];
    while (i + 1 < raw.length && LEAD_INS.has(part.slice(part.lastIndexOf(NBSP) + 1))) part += NBSP + raw[++i];
    parts.push(part);
  }
  return parts.flatMap((part, i) => {
    const nodes = visibleLength(part) <= SHORT_PHRASE ? [el('span', { class: 'ph' }, flow(part))] : flow(part);
    return i ? [' ', ...nodes] : nodes;
  });
}

export function priceNode(p, cls) {
  const node = el('p', { class: cls });
  if (typeof p.price === 'number' && isFinite(p.price)) {
    node.append('฿' + p.price.toLocaleString('th-TH'));
    if (p.priceNote) node.append(' ', el('small', { text: p.priceNote }));
  } else {
    node.append(...phrases(p.priceText || 'สอบถามราคา'));
  }
  return node;
}

// The actions under a product: one primary button, and never a button that leads nowhere.
// A product that can be ordered gets the order link first; a sample, or a shop with no order channel yet, says so in words.
export function actions(p, settings, { small = false, other }) {
  const size = small ? ' btn--s' : '';
  const more = (cls) => el('a', { class: cls + size, href: other.href, 'aria-label': other.label, text: other.text });
  const url = !p.sample && (safeUrl(p.orderUrl) || safeUrl(settings.orderUrl));
  if (!url) return [more('btn'), el('span', { class: 'status', 'data-order': p.sample ? 'sample' : 'pending', text: p.sample ? settings.sampleOrderLabel : settings.pendingLabel })];
  const external = /^https?:/i.test(url);
  return [
    el('a', { class: 'btn' + size, href: url, 'data-order': 'live', target: external && '_blank', rel: external && 'noopener', text: p.orderLabel || settings.orderLabel }),
    more('btn btn--ghost'),
  ];
}

// A product picture. A failed load is tried once more; after that, or when a product has no usable picture, the logo stands in.
export const CARD_SIZES = '(min-width: 1100px) 300px, (min-width: 640px) 46vw, 92vw';
const WIDE_SIZES = '(min-width: 860px) 50vw, 100vw';
// the picture on a product's own page: half the column on a wide screen, the full width once the page stacks
export const PAGE_SIZES = '(min-width: 1300px) 600px, (min-width: 861px) 48vw, 100vw';
export function productImage(p, src, lazy = true, sizes = src ? WIDE_SIZES : CARD_SIZES) {
  const url = safeUrl(src || p.image);
  // imageSmall / imageFeaturedSmall: the same picture 800 px wide, for phones; imageLarge / imageFeaturedLarge: 2400 px, for 3x screens
  const small = url ? safeUrl(src ? p.imageFeaturedSmall : p.imageSmall) : '';
  const large = small ? safeUrl(src ? p.imageFeaturedLarge : p.imageLarge) : '';
  const img = el('img', { class: url ? null : 'is-fallback', src: url || LOGO, srcset: small && `${small} 800w, ${url} 1600w${large ? `, ${large} 2400w` : ''}`, sizes: small && sizes, alt: p.imageAlt || p.name, loading: lazy && 'lazy', decoding: 'async', width: 1200, height: 1200 });
  let retried = false;
  img.addEventListener('error', () => {
    if (img.classList.contains('is-fallback')) return;
    img.removeAttribute('srcset');
    img.removeAttribute('sizes');
    if (url && !retried) {
      retried = true;
      img.src = url + (url.includes('?') ? '&' : '?') + 'retry=1';
      return;
    }
    img.className = 'is-fallback';
    img.src = LOGO;
  });
  return img;
}

function media(p, settings, src) {
  return [productImage(p, src), p.sample && el('span', { class: 'tag', text: settings.sampleLabel })];
}

export function card(p, settings, { full = false } = {}) {
  const url = productUrl(p);
  return el('article', { class: full ? 'p-card p-card--full' : 'p-card', 'data-id': p.id, 'data-category': p.category || '' },
    el('div', { class: 'p-media' }, media(p, settings)),
    el('div', { class: 'p-body' },
      el('h3', { class: 'p-name' }, el('a', { href: url, text: p.name })),
      p.tagline && el('p', { class: 'p-tagline' }, phrases(p.tagline)),
      full && list(p.highlights).length > 0 && el('ul', { class: 'p-hl dash' }, list(p.highlights).map((t) => el('li', {}, phrases(t)))),
      priceNode(p, 'p-price'),
      full && el('div', { class: 'p-actions' }, actions(p, settings, { small: true, other: { href: url, text: 'ดูรายละเอียด', label: 'ดูรายละเอียด ' + p.name } }))));
}

export function featureTile(p, settings) {
  // facts on one line with a dot between them (drawn in CSS, so a wrapped line never starts or ends with a dot)
  const meta = [p.sample && settings.sampleLabel, p.sample && settings.sampleOrderLabel, typeof p.price === 'number' ? '฿' + p.price.toLocaleString('th-TH') : p.priceText].filter(Boolean);
  return el('div', { class: 'feature-tile on-black' },
    el('div', { class: 'feature-copy' },
      el('h2', { class: 't-h2', id: 'h-featured', text: p.name }),
      p.tagline && el('p', { class: 'lead' }, phrases(p.tagline)),
      meta.length > 0 && el('p', { class: 'feature-meta' }, el('span', { class: 'meta-items' }, meta.flatMap((t, i) => [i > 0 && ' ', el('span', {}, phrases(t))]))),
      el('div', { class: 'feature-actions' },
        el('a', { class: 'btn', href: productUrl(p), text: 'ดูรายละเอียด' }),
        el('a', { class: 'btn btn--ghost', href: '/products/', text: 'ดูสินค้าทั้งหมด' }))),
    el('div', { class: 'feature-media' }, media(p, settings, p.imageFeatured)));
}

export function stateNode(text, action) {
  return el('p', { class: 'state', role: 'status' }, text, action && el('br'), action);
}
