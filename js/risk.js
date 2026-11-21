// The self-check "องค์กรคุณเสี่ยงข้อมูลรั่วแค่ไหน". It counts the "yes" answers in this page and shows one of three results.
// It stores nothing (no cookie, no localStorage) and sends nothing: there is no network call in this file.
export function initRiskCheck(form = document.querySelector('[data-quiz]')) {
  if (!form) return;
  const out = form.querySelector('.quiz-out');
  const progress = form.querySelector('[data-progress]');
  const done = form.querySelector('[data-done]');
  const levels = [...form.querySelectorAll('.level')];
  const groups = [...form.querySelectorAll('.yn')];
  const n = groups.length;
  const update = () => {
    const picked = groups.map((g) => g.querySelector('input:checked'));
    const answered = picked.filter(Boolean).length;
    const yes = picked.filter((i) => i && i.value === '1').length;
    const complete = answered === n;
    // 0–1 yes = low, 2–3 = mid, 4 or more = high (the rule is printed beside the questions)
    const level = !complete ? '' : yes <= 1 ? 'low' : yes <= 3 ? 'mid' : 'high';
    out.dataset.result = level;
    progress.textContent = complete ? `ตอบครบ ${n} ข้อ · ตอบ “ใช่” ${yes} ข้อ` : `ตอบแล้ว ${answered} จาก ${n} ข้อ`;
    levels.forEach((l) => (l.hidden = l.dataset.level !== level));
    done.hidden = !complete;
  };
  form.addEventListener('change', update);
  form.addEventListener('reset', () => setTimeout(update));
  form.addEventListener('submit', (e) => e.preventDefault());
  update();
}
