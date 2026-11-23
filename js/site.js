// Shared behaviour for every page: top bar, mobile menu, tabs, copy buttons, and the late start of js/fx.js (motion).
// The contact buttons get their address at build time (tools/lib.py contact_link): no page asks for products.json for them.

// A phrase kept whole (.ph) that is wider than its column would strand words on lines of their own.
// Such a phrase is released to flow as normal text. A ResizeObserver hears each phrase's size after the browser has laid the
// page out, so the check never makes the page lay out an extra time, and a phrase in a part of the page that is not drawn yet
// (content-visibility) is checked when that part is drawn. Fonts arriving or a column changing width resize the phrase and
// bring it back here. A released phrase is inline (no box to observe): it is tried whole again when the window gets wider.
// Call it again with the new markup after drawing content from script.
let phrases = null;
const watched = new WeakSet();
export function settlePhrases(root = document) {
  if (!('ResizeObserver' in window)) return;
  phrases ||= new ResizeObserver((entries) => {
    const wide = entries.filter((en) => {
      const h = en.borderBoxSize?.[0]?.blockSize ?? en.contentRect.height;
      return h > 0 && h > 1.6 * parseFloat(getComputedStyle(en.target).lineHeight);
    });
    wide.forEach((en) => en.target.classList.add('is-flow'));
  });
  root.querySelectorAll('.ph').forEach((s) => {
    if (watched.has(s)) return;
    watched.add(s);
    phrases.observe(s);
  });
}
const retryPhrases = () => document.querySelectorAll('.ph.is-flow').forEach((s) => s.classList.remove('is-flow'));

// Resolves once the page has loaded, its first screen has been painted and the browser has a free moment: work the first screen
// does not need waits for this. On a fast line the load event can come before the first paint; a request started then would
// still compete with the first screen (Lighthouse counts every request that starts before the largest paint), so it waits for
// a frame as well: the timeout set in a frame callback runs after that frame is painted.
const painted = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
export const afterLoad = () => new Promise((resolve) => {
  const idle = () => painted().then(() => ('requestIdleCallback' in window ? requestIdleCallback(() => resolve(), { timeout: 2000 }) : setTimeout(resolve, 200)));
  if (document.readyState === 'complete') idle();
  else addEventListener('load', idle, { once: true });
});

// The first 12 hex digits of the SHA-256 of a data file as served. tools/shop_static.py and tools/content_pricing.py write the same
// digest into data-catalog when they build the list from that file, so a page can tell whether its list is still current.
// '' where the browser has no crypto.subtle (a page opened over plain http on a LAN address): the list is then drawn again.
export async function catalogHash(buf) {
  try {
    return [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
  } catch {
    return '';
  }
}

// A tab list (role=tablist) with arrow keys, Home and End. The chosen panel gets .is-in so CSS can play its entrance.
// onSelect also hears what chose the tab (by: 'click', 'key', or what the caller of select() passes).
export function initTabs(list, { onSelect } = {}) {
  const tabs = [...list.querySelectorAll('[role="tab"]')];
  function select(tab, { focus = false, motion = true, by = '' } = {}) {
    tabs.forEach((t, i) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(t.getAttribute('aria-controls'));
      panel.hidden = !on;
      panel.classList.remove('is-in');
      if (on) {
        if (motion) {
          void panel.offsetWidth; // restart the entrance
          panel.classList.add('is-in');
        }
        onSelect?.(t, i, panel, motion, by);
      }
    });
    if (focus) tab.focus({ preventScroll: true });
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => {
      if (tab.getAttribute('aria-selected') !== 'true') select(tab, { by: 'click' });
    });
    tab.addEventListener('keydown', (e) => {
      const next = (i + 1) % tabs.length;
      const prev = (i - 1 + tabs.length) % tabs.length;
      // a list laid out as a column (aria-orientation="vertical") also takes the up and down arrows
      const column = list.getAttribute('aria-orientation') === 'vertical' ? { ArrowDown: next, ArrowUp: prev } : {};
      const j = { ArrowRight: next, ArrowLeft: prev, ...column, Home: 0, End: tabs.length - 1 }[e.key];
      if (j === undefined) return;
      e.preventDefault();
      select(tabs[j], { focus: true, by: 'key' });
    });
  });
  return { tabs, select };
}

// A folding screen held like a laptop (tabletop): the fold runs across the screen, one viewport segment above the other.
// At the top of the page nothing to read or tap may sit on the fold, so the first block that would cross it starts just
// below it instead (a row of buttons moves as one). Further down the page scrolls across the fold like any page.
const tabletop = matchMedia('(vertical-viewport-segments: 2)');
const moved = new Map();
function clearFold() {
  if (!tabletop.matches && !moved.size) return;
  moved.forEach((was, el) => (el.style.marginTop = was));
  moved.clear();
  const segs = window.viewport?.segments;
  if (!tabletop.matches || !segs || segs.length < 2) return;
  const [a, b] = [segs[0].y + segs[0].height - 8, segs[1].y + 8]; // page position of the fold at the top of the page, the hinge and 8px either side
  const main = document.getElementById('main');
  if (!main) return;
  // the block to move: the nearest ancestor that does not share its row with a sibling (a button beside a button)
  const block = (el) => {
    for (let e = el; e && e !== main; e = e.parentElement) {
      const cs = getComputedStyle(e);
      const p = e.parentElement;
      if (/^inline|contents/.test(cs.display) || /absolute|fixed/.test(cs.position) || /^inline/.test(getComputedStyle(p).display)) continue;
      const r = e.getBoundingClientRect();
      const shared = p && /flex|grid/.test(getComputedStyle(p).display) && [...p.children].some((s) => {
        if (s === e) return false;
        const q = s.getBoundingClientRect();
        return q.width && q.height && q.top < r.bottom - 1 && q.bottom > r.top + 1;
      });
      if (!shared) return e;
    }
    return null;
  };
  const range = document.createRange();
  const across = (r) => r.bottom + scrollY > a && r.top + scrollY < b;
  for (let round = 0; round < 4; round++) {
    // the highest line of text or control on the fold
    let first = null;
    let top = Infinity;
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    for (let n; (n = walker.nextNode()); ) {
      const el = n.parentElement;
      if (!n.data.trim() || el.closest('[aria-hidden="true"], .sr-only') || !el.checkVisibility()) continue;
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) {
        if (r.top + scrollY > b) break;
        if (across(r) && r.top < top) [first, top] = [el, r.top];
      }
    }
    for (const el of main.querySelectorAll('.btn, button, input, select, textarea, [role="tab"]')) {
      const r = el.getBoundingClientRect();
      if (el.checkVisibility() && across(r) && r.top < top) [first, top] = [el, r.top];
    }
    if (!first) return;
    const el = block(first);
    if (!el) return;
    const at = el.getBoundingClientRect().top + scrollY;
    if (!moved.has(el)) moved.set(el, el.style.marginTop);
    el.style.marginTop = `${parseFloat(getComputedStyle(el).marginTop) + Math.ceil(b - at)}px`;
  }
}

// Looping scenes (the hero mascot floating, its halo breathing, the drifting cards, a typing caret) stop while they are off
// screen: a running animation makes the compositor draw a new frame every 1/60 s even where nobody can see it, and on a
// phone those frames compete with the finger's scroll. styles.css pauses everything inside .is-off. (t-5342)
const LOOPS = '.scene, .stage, .caret';
function pauseOffscreen() {
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => entries.forEach((en) => en.target.classList.toggle('is-off', !en.isIntersecting)));
  document.querySelectorAll(LOOPS).forEach((el) => { if (!el.parentElement?.closest(LOOPS)) io.observe(el); });
}

export function initSite({ fx = true } = {}) {
  settlePhrases();
  clearFold();
  document.fonts?.ready.then(clearFold);
  let settling = 0;
  let width = 0; // not innerWidth here: reading it while the first layout is pending forces that layout (Lighthouse: forced reflow)
  addEventListener('resize', () => {
    cancelAnimationFrame(settling);
    settling = requestAnimationFrame(() => {
      const w = innerWidth;
      if (w > width) retryPhrases(); // the first resize re-checks every phrase once: harmless, the observer marks them again
      width = w;
      clearFold();
    });
  });
  tabletop.addEventListener?.('change', () => {
    retryPhrases();
    clearFold();
  });
  // content drawn after load (a product page reads the data file) can land on the fold: check again when main changes size
  const main = document.getElementById('main');
  if (main && 'ResizeObserver' in window) {
    let again = 0;
    let last = 0;
    new ResizeObserver(([entry]) => {
      const h = Math.round(entry.contentRect.height);
      if (!tabletop.matches || h === last) return;
      last = h;
      cancelAnimationFrame(again);
      again = requestAnimationFrame(clearFold);
    }).observe(main);
  }

  pauseOffscreen();

  const bar = document.getElementById('bar');
  if (bar) {
    // .is-stuck once the page has moved more than 6 px: a 6 px marker at the top of the page says so without reading scrollY on every scroll
    if ('IntersectionObserver' in window) {
      const mark = document.createElement('div');
      mark.setAttribute('aria-hidden', 'true');
      mark.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:6px;pointer-events:none;visibility:hidden';
      document.body.append(mark);
      new IntersectionObserver(([en]) => bar.classList.toggle('is-stuck', !en.isIntersecting)).observe(mark);
    } else {
      const stuck = () => bar.classList.toggle('is-stuck', window.scrollY > 6);
      stuck();
      window.addEventListener('scroll', stuck, { passive: true });
    }
    const btn = bar.querySelector('.menu-btn');
    const nav = bar.querySelector('.nav');
    if (btn && nav) {
      const set = (open) => {
        nav.classList.toggle('is-open', open);
        btn.setAttribute('aria-expanded', String(open));
        btn.setAttribute('aria-label', open ? 'ปิดเมนู' : 'เปิดเมนู');
      };
      btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
      nav.addEventListener('click', (e) => e.target.closest('a') && set(false));
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') {
          set(false);
          btn.focus();
        }
      });
    }
  }

  // copy a command or a code block (without the "$ " prompt)
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.copy');
    if (!btn) return;
    const code = btn.closest('.cmd, .code').querySelector('code');
    const text = [...code.childNodes]
      .filter((n) => !(n.nodeType === 1 && n.classList.contains('p')))
      .map((n) => n.textContent)
      .join('')
      .trim();
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      const range = document.createRange();
      range.selectNodeContents(code);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      ok = !!(document.execCommand && document.execCommand('copy'));
    }
    btn.dataset.label ||= btn.textContent;
    btn.textContent = ok ? 'คัดลอกแล้ว' : 'กด Ctrl+C';
    btn.classList.add('done');
    clearTimeout(btn._t);
    btn._t = setTimeout(() => {
      btn.textContent = btn.dataset.label;
      btn.classList.remove('done');
    }, 1600);
  });

  // links that have no address yet
  document.addEventListener('click', (e) => {
    if (e.target.closest('a[aria-disabled="true"]')) e.preventDefault();
  });

  // motion is an extra: it starts once the page is idle. บักสีดา's clips play in place (they are not the kind of motion reduced motion
  // is for), so they load under reduced motion too; pointer and scroll motion (fx.js) never runs under it.
  const start = () => {
    if (fx && !matchMedia('(prefers-reduced-motion: reduce)').matches) import('./fx.js').then((m) => m.initFx()).catch(() => {});
    import('./mascot.js').then((m) => m.initMascot()).catch(() => {});
  };
  afterLoad().then(start); // after load and the first paint: motion and clips never compete with the first screen
}

// Mark the link whose section is in view (top-bar anchors on the home page, the contents list of an article).
export function trackSections(links) {
  if (!('IntersectionObserver' in window) || !links.size) return;
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        links.forEach((a) => a.removeAttribute('aria-current'));
        links.get(en.target.id)?.setAttribute('aria-current', 'true');
      });
    },
    { rootMargin: '-40% 0px -55% 0px' }
  );
  links.forEach((_, id) => {
    const target = document.getElementById(id);
    if (target) io.observe(target);
  });
}
