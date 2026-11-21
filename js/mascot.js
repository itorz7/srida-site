// บักสีดา moves. Every .disc[data-clip] holds her still picture (the clip's first pose); this lays the short loop over it.
// An extra, loaded at idle by site.js and not under Save-Data: without it the page shows the stills. It also runs under reduced motion:
// she moves in place (a short loop, a clip on tap or hover), which is not the parallax, tilt or scroll motion that setting is about (those are fx.js, off).
// Only a clip that is on screen plays; on a touch screen one clip plays at a time (the one nearest the middle of the screen);
// everything stops while the tab is hidden. data-hover names a clip that plays once on hover (mouse) or tap (touch).
// Chrome, Edge, Firefox and Android play WebM (VP9) clips with a transparent background. Safari and every browser on iPhone
// cannot show WebM alpha, so they get the same pose as an animated WebP with alpha, laid over her still the same way (no canvas, no WebGL).
// Only one layer of her is ever visible: the still goes the moment the first frame of a clip is up, and comes back if the clip fails.
const SAFARI = /^((?!chrome|chromium|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent) || /iphone|ipad|ipod/i.test(navigator.userAgent);
const CAN_VP9 = !!document.createElement('video').canPlayType('video/webm; codecs="vp9"');
const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
const file = (name, el) => `/assets/mascot/clip/baksida-${name}-${el.clientWidth * Math.min(window.devicePixelRatio || 1, 2) > 520 ? 720 : 480}.webm`;
const seen = new Map(); // disc → share of it on screen
const clips = new WeakMap(); // disc → its looping <video>

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

// iPhone / iPad: a phone-sized animated WebP (160 / 240 / 360 px: the size shown x DPR 2, never more than 360). Desktop Safari keeps the 540 px file.
const ANIM_SIZES = [160, 240, 360];
const animFile = (name, el) => {
  if (FINE) return `/assets/mascot/clip/baksida-${name}-anim.webp`;
  const need = el.clientWidth * Math.min(window.devicePixelRatio || 1, 2) * 0.8;
  return `/assets/mascot/clip/baksida-${name}-anim-${ANIM_SIZES.find((s) => s >= need) || 360}.webp`;
};
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
  const on = [...seen].filter(([el, share]) => share >= (el.closest('.stage--hero') ? 0.2 : 0.35) && el.isConnected).map(([el]) => el);
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
    if (!el.dataset.hover) return;
    if (FINE) el.addEventListener('pointerenter', () => once(el));
    else el.addEventListener('click', () => once(el));
  });
  document.addEventListener('visibilitychange', update);
  addEventListener('scroll', () => { if (!FINE) requestAnimationFrame(update); }, { passive: true });

  // moving parts that have left the screen stand still until they come back (the stylesheet pauses .is-away)
  const away = new IntersectionObserver((entries) => entries.forEach((e) => e.target.classList.toggle('is-away', !e.isIntersecting)));
  document.querySelectorAll('.scene, .mock, .bento').forEach((el) => away.observe(el));
}

