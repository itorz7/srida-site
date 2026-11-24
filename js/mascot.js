// บักสีดา moves. Every .disc[data-clip] holds her still picture (the clip's first pose); this lays the short loop over it.
// An extra, loaded at idle by site.js and not under Save-Data: without it the page shows the stills. It also runs under reduced motion:
// she moves in place (a short loop, a clip on tap or hover), which is not the parallax, tilt or scroll motion that setting is about (those are fx.js, off).
// Only a clip that is on screen plays; on a touch screen one clip plays at a time (the one nearest the middle of the screen);
// everything stops while the tab is hidden. data-hover names a clip that plays once on hover (mouse) or tap (touch).
// Chrome, Edge, Firefox and Android play WebM (VP9) clips with a transparent background. Safari and every browser on iPhone
// cannot show WebM alpha, so they get the same pose as an animated WebP with alpha, laid over her still the same way (no canvas, no WebGL).
// Only one layer of her is ever visible: the still goes the moment the first frame of a clip is up, and comes back if the clip fails.
// No clip is fetched while the page loads: the loops start after the load event and one idle moment. A hover or tap on her starts
// her clip at once. On a slow connection (effectiveType 2g / 3g) she stays still until she is tapped or hovered.
// Each clip comes in four widths (tools/enc_clips.py): the smallest that covers the disc as drawn (CSS width x DPR up to 2,
// x 0.8 on a touch screen), else the largest.
const SAFARI = /^((?!chrome|chromium|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent) || /iphone|ipad|ipod/i.test(navigator.userAgent);
const CAN_VP9 = !!document.createElement('video').canPlayType('video/webm; codecs="vp9"');
const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
const SLOW = /^(slow-2g|2g|3g)$/.test(navigator.connection?.effectiveType || '');
const SIZES = [240, 360, 480, 720];
const size = (el) => {
  const need = el.clientWidth * Math.min(window.devicePixelRatio || 1, 2) * (FINE ? 1 : 0.8);
  return SIZES.find((s) => s >= need) || SIZES[SIZES.length - 1];
};
const CLIPS = (name) => `/assets/mascot/clip/${name === 'mt' || name === 'asr' ? 'v4' : 'v3'}/baksida-`; // a new encode goes into a new folder: a clip's URL never changes content (v4: mt and asr keyed again)
const file = (name, el) => `${CLIPS(name)}${name}-${size(el)}.webm`;
const animFile = (name, el) => `${CLIPS(name)}${name}-anim-${size(el)}.webp`;
const seen = new Map(); // disc → share of it on screen
const clips = new WeakMap(); // disc → its looping <video>
const woken = new WeakSet(); // discs a hover or tap started before the loops start on their own (or on a slow connection)
let auto = false; // the loops start on their own: after load + idle, never on a slow connection

function layer(el, name, loop) {
  if (SAFARI) return anim(el, name, loop);
  const v = document.createElement('video');
  v.className = loop ? 'loop' : 'hit';
  v.muted = true;
  v.defaultMuted = true;
  v.loop = loop;
  v.playsInline = true;
  v.preload = 'none';
  v.disablePictureInPicture = true;
  v.tabIndex = -1;
  v.setAttribute('aria-hidden', 'true');
  v.addEventListener('playing', () => { v.classList.add('is-on'); if (loop) el.classList.add('is-live'); });
  if (loop) v.addEventListener('error', () => { v.remove(); clips.delete(el); el.classList.remove('is-live'); });
  v.src = file(name, el);
  el.append(v);
  return v;
}

const FRAMES = { idle: 7.6, wave: 7.6, llm: 7.6, asr: 7.6, tts: 7.6, mt: 3.3, vision: 7.6 };
function anim(el, name, loop) { // Safari: an animated WebP over the still; "playing" = loaded, "paused" = removed
  const v = document.createElement('img');
  v.className = (loop ? 'loop' : 'hit') + ' anim';
  v.alt = '';
  v.decoding = 'async';
  v.setAttribute('aria-hidden', 'true');
  v.paused = true;
  v.play = () => { v.paused = false; if (!v.src) v.src = animFile(name, el); return Promise.resolve(); };
  v.pause = () => { v.paused = true; v.removeAttribute('src'); v.classList.remove('is-on'); if (loop) el.classList.remove('is-live'); };
  v.addEventListener('load', () => { if (v.paused) return; v.classList.add('is-on'); if (loop) el.classList.add('is-live'); if (!loop) v.dispatchEvent(new Event('playing')); });
  let failing = false; // the error event is passed on to the hover handler below: not to this listener again
  v.addEventListener('error', () => { if (failing) return; failing = true; v.pause(); v.dispatchEvent(new Event('error')); failing = false; });
  if (!loop) setTimeout(() => v.dispatchEvent(new Event('ended')), (FRAMES[name] || 7) * 1000 + 300);
  el.append(v);
  return v;
}

function update() {
  const on = [...seen].filter(([el, share]) => (auto || woken.has(el)) && share >= (el.closest('.stage--hero') ? 0.2 : 0.35) && el.isConnected).map(([el]) => el);
  let play = on;
  if (!FINE && on.length > 1) {
    const mid = innerHeight / 2;
    const off = (el) => { const r = el.getBoundingClientRect(); return Math.abs((r.top + r.bottom) / 2 - mid); };
    play = [on.reduce((a, b) => (off(b) < off(a) ? b : a))];
  }
  for (const el of seen.keys()) {
    const want = !document.hidden && play.includes(el) && !el.dataset.busy;
    let v = clips.get(el);
    if (want) {
      if (!v) clips.set(el, (v = layer(el, el.dataset.clip, true)));
      if (v.paused) v.play().catch(() => {});
    } else if (v && !v.paused) v.pause();
  }
}

function once(el) { // the hover / tap clip: played once over the loop, then the loop shows again
  if (el.dataset.busy) return;
  el.dataset.busy = '1';
  const v = layer(el, el.dataset.hover, false);
  v.addEventListener('playing', () => { el.classList.add('is-hover'); clips.get(el)?.pause?.(); });
  const done = () => {
    if (!el.dataset.busy) return;
    delete el.dataset.busy;
    el.classList.remove('is-hover');
    v.remove();
    update();
  };
  v.addEventListener('ended', done);
  v.addEventListener('error', done);
  v.play().catch(done);
}

export function initMascot() {
  if (!(SAFARI || CAN_VP9) || navigator.connection?.saveData || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) seen.set(e.target, e.isIntersecting ? e.intersectionRatio : 0);
    update();
  }, { threshold: [0, 0.2, 0.35, 0.7] });
  document.querySelectorAll('.disc[data-clip]').forEach((el) => {
    seen.set(el, 0);
    io.observe(el);
    const wake = () => { woken.add(el); if (el.dataset.hover) once(el); else update(); };
    if (FINE) el.addEventListener('pointerenter', wake);
    else el.addEventListener('click', wake);
  });
  document.addEventListener('visibilitychange', update);
  addEventListener('scroll', () => { if (!FINE) requestAnimationFrame(update); }, { passive: true });
  if (!SLOW) {
    const start = () => { auto = true; update(); };
    const idle = () => ('requestIdleCallback' in window ? requestIdleCallback(start, { timeout: 2000 }) : setTimeout(start, 300));
    if (document.readyState === 'complete') idle();
    else addEventListener('load', idle, { once: true });
  }

  // moving parts that have left the screen stand still until they come back (the stylesheet pauses .is-away)
  const away = new IntersectionObserver((entries) => entries.forEach((e) => e.target.classList.toggle('is-away', !e.isIntersecting)));
  document.querySelectorAll('.scene, .mock, .bento').forEach((el) => away.observe(el));
}

