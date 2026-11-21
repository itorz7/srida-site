// Motion that follows the pointer or the scroll. site.js loads this file once the page is idle:
// nothing here is needed to read or use the page, and none of it runs under prefers-reduced-motion.
// GSAP + ScrollTrigger (scroll-linked movement) and Lenis (smooth wheel scrolling) are for mouse and trackpad users
// only, fetched from /vendor/ on their first scroll so they never weigh on the first paint. On a touch screen the finger
// moves the page natively and momentum scrolling runs off the main thread: transforms set from script each frame would
// trail behind it and judder, so phones and tablets keep the CSS motion (reveals, drifting cards) and skip the libraries.
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

// glossy surfaces that carry a rim light (styles.css draws it at --mx / --my)
const RIM = '.rail a, .bento-cell a, .p-card, .steps4 li, .uses-grid li, .ind > li, .quiz, .vs, .risk-row, .price-row, .asset, .swatch, .type-card, .dont, .feature-tile';
// what rises into place when it scrolls into view
const REVEAL = '.sec-head, .say, .rule-head, .risk-row, .risk-next, .vs, .memo, .quiz, .ind > li, .steps4 li, .posts li, .qa-list, .cta-band, .uses-grid li, .price-row, .asset, .swatch, .type-card, .dont, .rules, [data-featured] > .wrap, .p-grid, .refs, .line-mock';

function rimLight() {
  addEventListener('pointermove', (e) => {
    const card = e.target instanceof Element ? e.target.closest(RIM) : null;
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${Math.round(e.clientX - r.left)}px`);
    card.style.setProperty('--my', `${Math.round(e.clientY - r.top)}px`);
  }, { passive: true });
}

// The hero scene leans toward the pointer. The pose eases to its target each frame, so it has weight instead of sticking to the cursor.
function heroTilt() {
  const scene = document.querySelector('.scene');
  const hero = scene?.closest('.hero');
  if (!hero) return;
  let tx = 0, ty = 0, x = 0, y = 0, frame = 0;
  const step = () => {
    x += (tx - x) * 0.07;
    y += (ty - y) * 0.07;
    scene.style.transform = `rotateX(${(-y * 5).toFixed(3)}deg) rotateY(${(x * 8).toFixed(3)}deg)`;
    frame = Math.abs(tx - x) + Math.abs(ty - y) > 0.002 ? requestAnimationFrame(step) : 0;
  };
  const aim = (nx, ny) => {
    tx = nx;
    ty = ny;
    frame ||= requestAnimationFrame(step);
  };
  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    aim(((e.clientX - r.left) / r.width - 0.5) * 2, ((e.clientY - r.top) / r.height - 0.5) * 2);
  }, { passive: true });
  hero.addEventListener('pointerleave', () => aim(0, 0));
}

// Only what starts below the first screen is hidden, so the first paint is never held back.
function reveals() {
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      io.unobserve(el);
      el.classList.add('is-in');
      setTimeout(() => {
        el.classList.remove('rv', 'is-in');
        el.style.removeProperty('--d');
      }, 1700);
    });
  }, { rootMargin: '0px 0px -7% 0px', threshold: 0.04 });
  // read every position first, then write: one layout pass for the page, not one per element
  const below = [...document.querySelectorAll(REVEAL)].filter((el) => !el.closest('[hidden]') && el.getBoundingClientRect().top >= innerHeight * 0.94);
  const count = new Map();
  below.forEach((el) => {
    if (el.parentElement.closest('.rv')) return;
    const n = count.get(el.parentElement) || 0;
    count.set(el.parentElement, n + 1);
    if (n) el.style.setProperty('--d', `${Math.min(n, 5) * 70}ms`);
    el.classList.add('rv');
    io.observe(el);
  });
}

// Figures count up once, when they are read. Screen readers get the final number, not the count.
function counters() {
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      io.unobserve(el);
      const to = Number(el.dataset.count);
      const t0 = performance.now();
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / 1100);
        el.textContent = Math.round(to * (1 - (1 - p) ** 4));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.6 });
  const below = [...document.querySelectorAll('[data-count]')].filter((el) => Number.isFinite(Number(el.dataset.count)) && el.getBoundingClientRect().top >= innerHeight);
  below.forEach((el) => {
    const real = document.createElement('span');
    real.className = 'sr-only';
    real.textContent = el.textContent;
    el.after(real);
    el.setAttribute('aria-hidden', 'true');
    el.textContent = '0';
    io.observe(el);
  });
}

const load = (src) => new Promise((ok, no) => {
  const s = document.createElement('script');
  s.src = src;
  s.onload = ok;
  s.onerror = no;
  document.head.append(s);
});

// Smooth wheel scrolling for mouse users. Lenis moves the real scroll position, so sticky sections, anchors and find-in-page keep working.
function smooth(gsap, ScrollTrigger) {
  const lenis = new window.Lenis({ lerp: 0.11, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  window.sridaScroll = (y) => lenis.scrollTo(y, { immediate: true, force: true });
  // in-page links glide for a mouse click; a key press and the footnotes keep the browser's own jump (focus order, :target)
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || !e.detail || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target instanceof Element ? e.target.closest('a[href*="#"]') : null;
    if (!a || a.target === '_blank' || a.classList.contains('fn-a')) return;
    const to = new URL(a.href);
    if (to.origin !== location.origin || to.pathname !== location.pathname || to.hash.length < 2) return;
    const target = document.getElementById(decodeURIComponent(to.hash.slice(1)));
    if (!target) return;
    e.preventDefault();
    history.pushState(null, '', to.hash);
    lenis.scrollTo(target, { offset: -92, duration: 1.1 });
  });
}

let asked = false;
async function scrollMotion() {
  if (asked) return;
  asked = true;
  try {
    await load('/vendor/gsap.min.js');
    await load('/vendor/ScrollTrigger.min.js');
    const { gsap, ScrollTrigger } = window;
    gsap.registerPlugin(ScrollTrigger);
    const each = (sel, fn) => document.querySelectorAll(sel).forEach(fn);
    // every tween below starts from the resting pose at the top of the page, so nothing jumps when the library arrives
    each('.hero-bg', (bg) => gsap.to(bg, { y: 90, ease: 'none', scrollTrigger: { trigger: bg.parentElement, start: 'top top', end: 'bottom top', scrub: 0.6 } }));
    each('.line-hero .stage', (s) => gsap.to(s, { y: 48, ease: 'none', scrollTrigger: { trigger: s, start: 'top 20%', end: 'bottom top', scrub: 0.6 } }));
    each('.feature-media img:not(.is-fallback)', (img) => gsap.fromTo(img, { yPercent: -5, scale: 1.1 }, { yPercent: 5, scale: 1.1, ease: 'none', scrollTrigger: { trigger: img.closest('.feature-tile'), start: 'top bottom', end: 'bottom top', scrub: 0.6 } }));
    if (fine) {
      await load('/vendor/lenis.min.js');
      smooth(gsap, ScrollTrigger);
    }
  } catch {
    // the page reads and works the same without scroll-linked motion
  }
}

export function initFx() {
  if (still) return;
  if (fine) {
    rimLight();
    heroTilt();
  }
  reveals();
  counters();
  if (!fine) return;
  const go = () => {
    ['scroll', 'wheel', 'touchmove'].forEach((t) => removeEventListener(t, go));
    scrollMotion();
  };
  if (scrollY > 0) go();
  else ['scroll', 'wheel', 'touchmove'].forEach((t) => addEventListener(t, go, { passive: true }));
}
