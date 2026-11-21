// /brand/: the copy buttons (a colour code, the font-family line, a company text) and the "download all" button.
import { initSite } from './site.js';

initSite();

document.addEventListener('click', async (e) => {
  const btn = e.target instanceof Element ? e.target.closest('[data-copy]') : null;
  if (!btn) return;
  const label = btn.querySelector('[data-label]');
  let ok = false;
  try {
    await navigator.clipboard.writeText(btn.dataset.copy);
    ok = true;
  } catch {
    // no clipboard access: select the text so Ctrl+C works
    const range = document.createRange();
    range.selectNodeContents(label);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
  if (!ok) return;
  label.dataset.text ||= label.textContent;
  btn.dataset.name ||= btn.getAttribute('aria-label');
  label.textContent = 'คัดลอกแล้ว';
  btn.setAttribute('aria-label', 'คัดลอกแล้ว'); // the name a screen reader speaks follows the visible text
  btn.classList.add('done');
  clearTimeout(btn._t);
  btn._t = setTimeout(() => {
    label.textContent = label.dataset.text;
    btn.setAttribute('aria-label', btn.dataset.name);
    btn.classList.remove('done');
  }, 1400);
});
