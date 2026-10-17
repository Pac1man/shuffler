/* Shuffler · interactive demo. Behaviour lives in assets/liquid-app.js; this file picks the
 * per-screen pieces. Palette: «Закат» (sunset), dark only. All content is synthetic. */
// Dark only — ignore ?theme=, any stored choice and the system preference.
(() => {
  const T = window.Shuffler.theme;
  T.init = function () { this.pref = 'dark'; this.apply(); };
  T.set = function () { this.pref = 'dark'; this.apply(); };
  T.toggle = function () {};
})();

LiquidVariant({
  id: 'final',
  number: 'S',
  name: 'Shuffler · демо',
  stroke: 2,
  railIcon: 30,
  markSize: 21,
  slideRadius: 48,
  glass: {
    lens: { bezelK: 0.32, disp: 13, blur: 1.5, sat: 1.4, zoom: 0.1 },   // onboarding lens
    sheet: { bezel: 20, disp: 10, blur: 20, sat: 1.15 },               // settings + comments
  },
  ambient: {
    brand: ['#ff7a59', '#ffb547', '#7a2a6b'],
    card: ['#c2456b', '#ff8a5c', '#4a1640'],
  },
  visual(kind, { S, I }) {
    const R = S.REELS;
    // first load: three postcards dealt behind the logo
    if (kind === 'first') {
      const cards = [[6, -16, '-.6s'], [3, 0, '-1.4s'], [0, 16, '-2.2s']];
      return `<div class="vb-fan" data-morph>${cards.map(([i, r, d]) => `<i style="--c1:${R[i].palette[0]};--c2:${R[i].palette[1]};--r:${r}deg;--d:${d}"></i>`).join('')}${S.logo({ size: 60 })}</div>`;
    }
    // waiting: a contact sheet with the logo (lavender squircle + heart) stretched into a
    // card of the same 44×62 shape; live seconds underneath
    if (kind === 'wait') {
      const cell = (i, n) => `<i style="--c1:${R[i % R.length].palette[0]};--c2:${R[i % R.length].palette[1]};--n:${n}"></i>`;
      const logoCard = `<svg class="fx-logo" viewBox="0 0 64 90" width="44" height="62" aria-hidden="true">` +
        `<rect width="64" height="90" rx="11.6" fill="#D5C6FF"/><path d="${S.HEART_PATH}" transform="translate(0 13)" fill="#251B36"/></svg>`;
      return `<div class="fx-grid">${[0, 1, 2, 3].map((i) => cell(i, [0, 1, 2, 5][i])).join('')}${logoCard}` +
        `${[4, 5, 6, 0].map((i, k) => cell(i, [8, 7, 6, 3][k])).join('')}</div>` +
        `<p class="vb-count"><b data-counter>0</b><span>сек</span></p>`;
    }
    // pause (429): a glass tank that drains as the minute runs out
    if (kind === 'pause') {
      return `<div class="vc-tank"><span class="vc-water" style="--lvl:90%"></span>` +
        `<span class="vc-num"><b data-counter>1:00</b><small>пауза</small></span></div>`;
    }
    // error / all watched
    if (kind === 'error') return `<div class="vb-tile">${I('cloudOff', { size: 42, stroke: 1.7 })}</div>`;
    return `<div class="vb-sky done"><i class="vb-sun"></i><span class="vb-stars">${I('sparkles', { size: 16, stroke: 1.8 })}${I('sparkles', { size: 12, stroke: 1.8 })}</span>${S.logo({ size: 68 })}</div>`;
  },
  tick(s, vis, kind) {
    if (kind !== 'pause') return;   // the waiting grid animates in CSS
    const w = vis && vis.querySelector('.vc-water');
    if (w) w.style.setProperty('--lvl', (90 * (1 - Math.min(1, s / 60))).toFixed(1) + '%');
  },
});

/* Review dock (only with ?review=1): no theme switch, "back" leads to the site. */
(() => {
  const rv = document.querySelector('.rv');
  if (!rv) return;
  const themeBtn = rv.querySelector('[data-act="theme"]');
  if (themeBtn) themeBtn.hidden = true;   // kept in the DOM: the shared dock code still updates it
  const back = rv.querySelector('.rv-back');
  if (back) { back.href = '../index.html'; back.textContent = '← На сайт'; }
  // the feed's first onChange (queued as a microtask) marks «Лента» even when the welcome
  // screen is what is showing — re-mark the real screen once it has run
  setTimeout(() => { if (!document.querySelector('#onb').hidden) window.Shuffler.review.setActive('onboarding'); }, 0);
})();
