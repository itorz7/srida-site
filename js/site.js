// Shared behaviour for every page: top bar, mobile menu, tabs, copy buttons, the contact link, and the late start of js/fx.js (motion).

// A phrase kept whole (.ph) that is wider than its column would strand words on lines of their own.
// Such a phrase is released to flow as normal text. Runs after text is drawn, when fonts arrive and on resize.
export function settlePhrases(root = document) {
  const kept = [...root.querySelectorAll('.ph')];
  kept.forEach((s) => s.classList.remove('is-flow'));
  kept
    .filter((s) => s.offsetHeight > 1.6 * parseFloat(getComputedStyle(s).lineHeight))
    .forEach((s) => s.classList.add('is-flow'));
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

// The contact buttons ([data-contact]) wait for an address in data/products.json → settings.contactUrl (or orderUrl).
async function wireContact() {
  const links = document.querySelectorAll('[data-contact]');
  if (!links.length) return;
  try {
    const res = await fetch('/data/products.json', { cache: 'no-cache' });
    if (!res.ok) return;
    const { settings = {} } = await res.json();
    const raw = String(settings.contactUrl || settings.orderUrl || '').trim();
    if (!/^(https?:\/\/|mailto:|tel:)/i.test(raw)) return;
    links.forEach((a) => {
      a.href = raw;
      a.removeAttribute('aria-disabled');
      a.textContent = settings.contactLabel || 'ติดต่อทีม Srida';
      if (/^https?:/i.test(raw)) {
        a.target = '_blank';
        a.rel = 'noopener';
      }
    });
  } catch {}
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
  const settle = () => {
    settlePhrases();
    clearFold();
  };
  settle();
  document.fonts?.ready.then(settle);
  let settling = 0;
  addEventListener('resize', () => {
    cancelAnimationFrame(settling);
    settling = requestAnimationFrame(settle);
  });
  tabletop.addEventListener?.('change', settle);
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
    const stuck = () => bar.classList.toggle('is-stuck', window.scrollY > 6);
    stuck();
    window.addEventListener('scroll', stuck, { passive: true });
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

  wireContact();

  // motion is an extra: it starts once the page is idle. บักสีดา's clips play in place (they are not the kind of motion reduced motion
  // is for), so they load under reduced motion too; pointer and scroll motion (fx.js) never runs under it.
  const start = () => {
    if (fx && !matchMedia('(prefers-reduced-motion: reduce)').matches) import('./fx.js').then((m) => m.initFx()).catch(() => {});
    import('./mascot.js').then((m) => m.initMascot()).catch(() => {});
  };
  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 1500 });
  else setTimeout(start, 300);
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
