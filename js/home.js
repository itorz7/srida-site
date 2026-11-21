import { initSite, initTabs, settlePhrases, trackSections } from './site.js';
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
    // every line must fit the pinned screen, or the section stays as plain tabs
    const fits = () => {
      const cs = getComputedStyle(pin);
      const room = pin.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const was = panels.map((p) => p.hidden);
      const ok = panels.every((p) => {
        panels.forEach((q) => (q.hidden = q !== p));
        return pin.firstElementChild.offsetHeight <= room;
      });
      panels.forEach((p, i) => (p.hidden = was[i]));
      return ok;
    };
    const setMode = () => {
      const room = wide.matches && !book.matches;
      story.classList.toggle('is-story', room);
      pinned = room && fits();
      story.classList.toggle('is-story', pinned);
      show.setAttribute('aria-orientation', pinned ? 'vertical' : 'horizontal');
      if (pinned) place();
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
    setMode();
  }
}

/* ---------- top bar: mark the section in view ---------- */
trackSections(new Map([...document.querySelectorAll('.nav a[href^="/#"]')].map((a) => [a.getAttribute('href').slice(2), a])));

/* ---------- products from /data/products.json ---------- */
const featureSlot = document.querySelector('[data-featured]');
const grid = document.querySelector('[data-products]');
try {
  const { products, settings } = await loadCatalog();
  const featured = products.find((p) => p.featured) || products[0];
  if (featureSlot) {
    if (featured) featureSlot.querySelector('.wrap').replaceChildren(featureTile(featured, settings));
    else featureSlot.hidden = true;
  }
  if (grid) {
    const limit = Number(grid.dataset.limit) || products.length;
    grid.replaceChildren(...(products.length ? products.slice(0, limit).map((p) => card(p, settings)) : [stateNode('ยังไม่มีสินค้าในตอนนี้')]));
  }
} catch {
  if (featureSlot) featureSlot.hidden = true;
  grid?.replaceChildren(stateNode('โหลดรายการสินค้าไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง'));
}
settlePhrases();
