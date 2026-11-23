import { initSite, initTabs, settlePhrases, trackSections, afterLoad } from './site.js';
import { initRiskCheck } from './risk.js';
import { loadCatalog, card, featureTile, stateNode } from './shop.js';

initSite();
initRiskCheck();

/* ---------- the five product lines ----------
   Tabs swap the mascot pose and the mock screen. On a wide screen with motion allowed the section pins (.is-story)
   and the scroll walks through the five lines. A tab then moves the page to its line's stretch of the scroll,
   so the scroll position and the chosen tab never disagree. */
const show = document.querySelector('.show-tabs');
if (show) {
  const story = show.closest('.story');
  const track = story?.querySelector('.story-track');
  const pin = story?.querySelector('.story-pin');
  const progress = story?.querySelector('.story-prog i');
  const wide = matchMedia('(min-width: 1100px) and (min-height: 660px) and (prefers-reduced-motion: no-preference)');
  // a folding screen held like a book is wide, but the page reads in one half of it (styles.css): no pinning there
  const book = matchMedia('(horizontal-viewport-segments: 2)');
  let pinned = false;
  let index = 0;

  const { tabs, select } = initTabs(show, {
    onSelect: (t, i, panel, motion, by) => {
      index = i;
      if (pinned) {
        if (by !== 'click' && by !== 'key') return;
        const y = track.getBoundingClientRect().top + scrollY + ((i + 0.5) / tabs.length) * (track.offsetHeight - innerHeight);
        if (window.sridaScroll) window.sridaScroll(y); // set by js/fx.js while smooth scrolling runs
        else scrollTo({ top: y, behavior: 'instant' });
      } else if (motion) {
        // keep the chosen tab in view inside the scrolling row, without moving the page
        show.scrollTo({ left: t.offsetLeft - show.clientWidth / 2 + t.offsetWidth / 2, behavior: 'smooth' });
      }
    },
  });
  const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));
  select(tabs[0], { motion: false });

  if (track && pin) {
    // how far the page is through the track picks the line
    const place = () => {
      const r = track.getBoundingClientRect();
      const t = Math.min(1, Math.max(0, -r.top / (r.height - innerHeight)));
      if (progress) progress.style.transform = `scaleX(${t.toFixed(4)})`;
      const i = Math.min(tabs.length - 1, Math.floor(t * tabs.length));
      if (i !== index) select(tabs[i], { by: 'scroll' });
    };
    // Every line must fit the pinned screen, or the section stays as plain tabs. The check only writes classes: .is-measuring
    // lays the section out pinned with all five panels on top of each other, out of the flow (styles.css), and the
    // ResizeObserver reads their sizes from its entries after the browser's own layout, before that frame is painted. So no
    // script forces a layout, the measuring layout is never on screen, and a screen that will not pin never shows a pinned frame.
    const body = pin.querySelector('.story-body');
    const wrap = pin.firstElementChild;
    const parts = [pin, wrap, body, show, ...panels];
    const size = new Map();
    let measuring = false;
    const apply = (pin) => {
      measuring = false;
      pinned = pin;
      story.classList.remove('is-measuring');
      story.classList.toggle('is-story', pin);
      show.setAttribute('aria-orientation', pin ? 'vertical' : 'horizontal');
      if (pin) requestAnimationFrame(place); // the next frame: its layout is clean, so reading the track's place costs nothing
    };
    const sizes = new ResizeObserver((entries) => {
      for (const e of entries) size.set(e.target, { block: e.borderBoxSize[0].blockSize, content: e.contentBoxSize[0].blockSize });
      if (!measuring) return;
      // The wrap with line i shown = the wrap as measured (the body's one row as tall as the tabs) + what line i adds beyond
      // that row. Rounded like the offsetHeight and clientHeight the check used before, so the same screens pin.
      const row = size.get(body).content;
      const tallest = Math.max(...panels.map((p) => size.get(p)?.block || 0));
      const room = Math.round(size.get(pin).block) - (size.get(pin).block - size.get(pin).content);
      apply(Math.round(size.get(wrap).block + Math.max(0, tallest - row)) <= room);
    });
    const setMode = () => {
      if (!(wide.matches && !book.matches)) return apply(false);
      measuring = true;
      story.classList.add('is-story', 'is-measuring');
      // observing again makes every part report its size in this frame, even one that has not changed since the last check
      sizes.disconnect();
      parts.forEach((el) => sizes.observe(el));
    };
    let frame = 0;
    addEventListener('scroll', () => {
      if (!pinned || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        place();
      });
    }, { passive: true });
    let sizing = 0;
    addEventListener('resize', () => {
      cancelAnimationFrame(sizing);
      sizing = requestAnimationFrame(setMode);
    });
    wide.addEventListener('change', setMode);
    book.addEventListener?.('change', setMode);
    document.fonts?.ready.then(setMode);
    document.fonts?.addEventListener?.('loadingdone', setMode); // a face that arrives later still changes the lines' heights
    setMode();
  }
}

/* ---------- top bar: mark the section in view ---------- */
trackSections(new Map([...document.querySelectorAll('.nav a[href^="/#"]')].map((a) => [a.getAttribute('href').slice(2), a])));

/* ---------- products: built into the page; drawn again after load only when /data/products.json changed since the build ---------- */
const featureSlot = document.querySelector('[data-featured]');
const grid = document.querySelector('[data-products]');
await afterLoad();
try {
  const { products, settings, hash } = await loadCatalog();
  if (hash && hash === grid?.dataset.catalog) {
    window.sridaCatalog = 'same';
  } else {
    const featured = products.find((p) => p.featured) || products[0];
    if (featureSlot) {
      if (featured) featureSlot.querySelector('.wrap').replaceChildren(featureTile(featured, settings));
      featureSlot.hidden = !featured;
    }
    if (grid) {
      const limit = Number(grid.dataset.limit) || products.length;
      grid.replaceChildren(...(products.length ? products.slice(0, limit).map((p) => card(p, settings)) : [stateNode('ยังไม่มีสินค้าในตอนนี้')]));
    }
    settlePhrases();
    window.sridaCatalog = 'drawn';
  }
} catch {
  window.sridaCatalog = 'kept'; // the cards written at build time stay
}
dispatchEvent(new Event('srida:catalog'));
