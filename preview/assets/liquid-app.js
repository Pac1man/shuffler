/* Shuffler · interactive demo — shared behaviour.
 *
 * app.js calls LiquidVariant(cfg); cfg supplies the palette-dependent bits
 * (ambient colours, card visuals, glass presets, icon stroke).
 * The demo shows no platform logos: the corner holds one neutral «Открыть оригинал» control.
 */
window.LiquidVariant = function LiquidVariant(cfg) {
  'use strict';
  const S = window.Shuffler;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const SVGNS = 'http://www.w3.org/2000/svg';

  S.theme.init(cfg.defaultTheme || 'dark');
  root.dataset.variant = cfg.id;

  /* ======================================================================
     SPRINGS — damped-spring curves sampled into CSS linear() easing
     ====================================================================== */
  function spring({ stiffness = 200, damping = 22, mass = 1 } = {}) {
    const w0 = Math.sqrt(stiffness / mass);
    const zeta = damping / (2 * Math.sqrt(stiffness * mass));
    const x = (t) => {
      if (zeta < 1) {
        const wd = w0 * Math.sqrt(1 - zeta * zeta);
        return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
      }
      return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
    };
    let T = 0;
    for (let t = 0; t < 4; t += 1 / 240) if (Math.abs(x(t) - 1) > 0.0015) T = t;
    T += 1 / 60;
    const n = 48, pts = [];
    for (let i = 0; i <= n; i++) pts.push(+x((T * i) / n).toFixed(4));
    pts[n] = 1;
    return { easing: `linear(${pts.join(', ')})`, duration: Math.round(T * 1000) };
  }
  const supportsLinear = CSS.supports('transition-timing-function', 'linear(0, 1)');
  const SPR = {
    bouncy: spring(cfg.springs?.bouncy || { stiffness: 260, damping: 19 }),
    soft: spring(cfg.springs?.soft || { stiffness: 190, damping: 24 }),
    reel: spring({ stiffness: 230, damping: 29 }),
    snap: spring({ stiffness: 380, damping: 30 }),
  };
  if (supportsLinear) {
    root.style.setProperty('--spring', SPR.bouncy.easing);
    root.style.setProperty('--spring-soft', SPR.soft.easing);
    root.style.setProperty('--spring-d', SPR.soft.duration + 'ms');
  } else {
    for (const k in SPR) SPR[k].easing = 'cubic-bezier(.25,1.2,.4,1)';
  }

  /* ======================================================================
     LIQUID GLASS — per-element SVG displacement map used as backdrop-filter.
     Only big surfaces (sheets, the onboarding lens) refract; buttons stay flat.
     Chromium only (Safari/Firefox ignore SVG backdrop filters) → frosted fallback.
     ====================================================================== */
  const LG = (() => {
    const defs = $('#lg-defs');
    const brands = (navigator.userAgentData && navigator.userAgentData.brands) || [];
    const chromium = brands.some((b) => /Chromium|Google Chrome|Microsoft Edge|Opera|Brave/i.test(b.brand));
    const supported = chromium && S.params.get('glass') !== 'basic' && CSS.supports('backdrop-filter', 'url(#a)');
    const PRESET = Object.assign({
      default: { bezel: 14, disp: 10, blur: 6, sat: 1.3 },
      lens: { bezelK: 0.35, disp: 18, blur: 1.5, sat: 1.25, zoom: 0.12 },
      sheet: { bezel: 22, disp: 14, blur: 18, sat: 1.3 },
    }, cfg.glass || {});
    const cache = new Map();
    let n = 0;
    function mapURL(w, h, r, bezel, zoom) {
      const key = [w, h, r, bezel, zoom].join(':');
      if (cache.has(key)) return cache.get(key);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(w, h);
      const d = img.data;
      const hw = w / 2, hh = h / 2;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const px = x + 0.5 - hw, py = y + 0.5 - hh;
          const qx = Math.abs(px) - (hw - r), qy = Math.abs(py) - (hh - r);
          const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
          const out = Math.hypot(ox, oy);
          const depth = -(Math.min(Math.max(qx, qy), 0) + out - r);
          let dx = 0, dy = 0;
          if (depth > -1 && depth < bezel) {
            let nx, ny;
            if (qx > 0 && qy > 0) { nx = ox / (out || 1); ny = oy / (out || 1); }
            else if (qx > qy) { nx = 1; ny = 0; } else { nx = 0; ny = 1; }
            nx *= Math.sign(px) || 1; ny *= Math.sign(py) || 1;
            const s = 1 - Math.max(0, depth) / bezel;
            const m = s * s * (1.6 - 0.6 * s);
            dx = -nx * m; dy = -ny * m;
          }
          if (zoom) {
            const f = zoom * (1 - Math.min(1, Math.hypot(px / hw, py / hh)));
            dx -= (px / hw) * f; dy -= (py / hh) * f;
          }
          const i = (y * w + x) * 4;
          d[i] = 128 + Math.max(-1, Math.min(1, dx)) * 127;
          d[i + 1] = 128 + Math.max(-1, Math.min(1, dy)) * 127;
          d[i + 2] = 128;
          d[i + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      const url = c.toDataURL();
      cache.set(key, url);
      return url;
    }
    function build(el) {
      const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
      if (w < 8 || h < 8) return;
      const p = PRESET[el.dataset.lg] || PRESET.default;
      if (!p || p.off) return;
      const r = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, w / 2, h / 2);
      const bezel = Math.max(4, Math.min(p.bezelK ? r * p.bezelK : p.bezel, w / 2 - 1, h / 2 - 1));
      const id = el.dataset.lgId || (el.dataset.lgId = 'lg' + ++n);
      let f = document.getElementById(id);
      if (!f) { f = document.createElementNS(SVGNS, 'filter'); f.id = id; defs.append(f); }
      for (const [k, v] of Object.entries({ x: 0, y: 0, width: w, height: h, filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' })) f.setAttribute(k, v);
      f.innerHTML =
        `<feGaussianBlur in="SourceGraphic" stdDeviation="${p.blur}" result="b"/>` +
        `<feImage href="${mapURL(w, h, Math.round(r), Math.round(bezel), p.zoom || 0)}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="m"/>` +
        `<feDisplacementMap in="b" in2="m" scale="${p.disp * 2}" xChannelSelector="R" yChannelSelector="G" result="d"/>` +
        `<feColorMatrix in="d" type="saturate" values="${p.sat}"/>`;
      el.style.setProperty('--lg', `url(#${id})`);
      el.classList.add('lg-on');
    }
    const pending = new Set();
    let raf = 0;
    const flush = () => { raf = 0; pending.forEach(build); pending.clear(); };
    const ro = supported ? new ResizeObserver((es) => { es.forEach((e) => pending.add(e.target)); if (!raf) raf = requestAnimationFrame(flush); }) : null;
    return {
      supported,
      attach(scope = document) {
        if (!supported) return;
        const els = scope.matches && scope.matches('[data-lg]') ? [scope] : [];
        els.push(...scope.querySelectorAll('[data-lg]'));
        els.forEach((el) => { if (!el.dataset.lgWatch) { el.dataset.lgWatch = '1'; ro.observe(el); } });
      },
    };
  })();
  root.dataset.glass = LG.supported ? 'refract' : 'frost';

  /* ======================================================================
     STATIC CHROME
     ====================================================================== */
  const STROKE = cfg.stroke || 2;
  const I = (name, o = {}) => S.icon(name, { stroke: STROKE, ...o });
  const fill = (sel, html) => $$(sel).forEach((el) => (el.innerHTML = html));
  fill('.lens-logo', S.logo({ size: 120, title: 'Shuffler' }));
  fill('.onb-mark', S.logo({ size: 26 }));
  fill('.cta-ic', I('shuffle', { size: 20 }));
  $('#open-settings').innerHTML = I('sliders', { size: 21 });
  fill('[data-close]', I('x', { size: 18 }));
  fill('[data-back]', I('chevronRight', { size: 19 }).replace('<svg', '<svg style="transform:scaleX(-1)"'));
  fill('.yc-ic', I(cfg.yearIcon || 'heart', { size: 13, stroke: STROKE + 0.3 }));
  fill('.sound-ic', I('music', { size: 13 }));
  fill('.hint-ic', I('arrowUp', { size: 17 }));
  $('#like .rail-ic').innerHTML = I('heart', { size: cfg.railIcon || 26 });
  $('#comments .rail-ic').innerHTML = I('comment', { size: cfg.railIcon || 26 });
  $('#share .rail-ic').innerHTML = I('send', { size: (cfg.railIcon || 26) - 2 });
  $('#reshuffle .rail-ic').innerHTML = I('shuffle', { size: (cfg.railIcon || 26) - 2 });
  fill('.row-ic.lang', I('languages', { size: 18 }));
  fill('.row-ic.theme', I('moon', { size: 18 }));
  fill('.row-ic.report', I('alert', { size: 18 }));
  fill('.row-ic.support', I('heart', { size: 18 }));
  fill('.row-chev', I('chevronRight', { size: 18 }));
  $('[data-theme-pick="light"]').innerHTML = I('sun', { size: 17 });
  $('[data-theme-pick="dark"]').innerHTML = I('moon', { size: 17 });
  fill('.composer-emoji', I('smile', { size: 20 }));
  fill('.composer-send', I('send', { size: 18 }));
  $$('.kbd-hint').forEach((k) => (k.innerHTML = '<kbd>↑</kbd><kbd>↓</kbd> листать <kbd>L</kbd> лайк <kbd>S</kbd> перемешать'));

  const toasts = $('#toasts');
  const toast = (msg) => S.toast(msg, toasts, 'toast');

  /* ======================================================================
     ONBOARDING — reel thumbnails orbit a glass lens and keep swapping places
     ====================================================================== */
  const onb = $('#onb');
  const orbit = $('#orbit');
  const heartFill = I('heart', { size: 12 });
  orbit.innerHTML = S.REELS.map((r, i) => {
    const a = (360 / S.REELS.length) * i - 90;
    return `<div class="orb-card" style="--i:${i};--a:${a}deg;--c1:${r.palette[0]};--c2:${r.palette[1]};--c3:${r.palette[2]}">` +
      `<div class="orb-inner" style="--tilt:${(i % 2 ? 1 : -1) * (4 + i * 2)}deg"><span class="emo">${r.emoji}</span><span class="hrt">${heartFill}</span><span class="yr">${r.year}</span></div></div>`;
  }).join('');
  let swapTimer = 0;
  function startOnboarding() {
    clearInterval(swapTimer);
    onb.classList.remove('is-in');
    orbit.classList.remove('is-open');
    void onb.offsetWidth;
    requestAnimationFrame(() => {
      onb.classList.add('is-in');
      setTimeout(() => orbit.classList.add('is-open'), S.isReduced() ? 0 : 180);
    });
    LG.attach(onb);
    if (S.isReduced()) return;
    swapTimer = setInterval(() => {
      if (onb.hidden || document.hidden) return;
      const cards = $$('.orb-card', orbit);
      const i = Math.floor(Math.random() * cards.length);
      let j = Math.floor(Math.random() * (cards.length - 1)); if (j >= i) j++;
      const ai = getComputedStyle(cards[i]).getPropertyValue('--a');
      const aj = getComputedStyle(cards[j]).getPropertyValue('--a');
      [cards[i], cards[j]].forEach((c) => c.classList.add('is-moving'));
      cards[i].style.setProperty('--a', aj);
      cards[j].style.setProperty('--a', ai);
      setTimeout(() => [cards[i], cards[j]].forEach((c) => c.classList.remove('is-moving')), 900);
    }, 2400);
  }

  $('#onb-start').addEventListener('click', () => {
    const lens = $('#lens');
    const enter = () => { show('feed'); showCard('first', { auto: true }); S.review.setActive('first'); };
    if (!document.startViewTransition || S.isReduced()) { enter(); return; }
    root.classList.add('vt-full');
    lens.style.viewTransitionName = 'lens';
    lens.classList.add('vt-flat');
    const vt = document.startViewTransition(() => {
      lens.style.viewTransitionName = '';
      lens.classList.remove('vt-flat');
      enter();
      const target = feed.current.querySelector('[data-morph]');
      if (target) { target.style.viewTransitionName = 'lens'; target.classList.add('vt-flat'); }
    });
    vt.finished.finally(() => {
      root.classList.remove('vt-full');
      const target = feed.current.querySelector('[data-morph]');
      if (target) { target.style.viewTransitionName = ''; target.classList.remove('vt-flat'); }
    });
  });

  /* ======================================================================
     STATE CARDS — first load · waiting (live seconds) · error · all watched
     ====================================================================== */
  const COPY = {
    first: {
      title: 'Собираем твои лайки',
      body: 'Это нужно только в первый раз\u00a0— дальше лента будет открываться сразу.',
      steps: ['Instagram Reels', 'YouTube Shorts', 'Перемешиваем'],
    },
    wait: S.loadingCopy(0),
    error: {
      title: 'Не получается загрузить',
      body: 'Instagram или YouTube сейчас не отвечают, или пропал интернет. Лайки на месте\u00a0— попробуем ещё раз?',
      actions: [['retry', 'Попробовать снова', 'refresh'], ['report', 'Сообщить о проблеме']],
    },
    pause: {
      title: 'Небольшая пауза\u00a0— продолжим сами',
      body: 'Продолжим сами через минуту. Ничего делать не нужно\u00a0— просмотренное сохранено.',
      actions: [['report', 'Сообщить о проблеме', null, 'ghost']],
    },
    done: {
      title: 'Это были все твои лайки',
      body: 'Все рилсы и шортсы за выбранный период уже показаны. Начнём новый круг\u00a0— в другом порядке?',
      actions: [['restart', 'Начать заново', 'rotate'], ['period', 'Выбрать другой период']],
    },
  };
  let cardKind = null;          // null on a reel
  let cardFlow = null;          // timers/counters of the visible card

  function cardHTML(kind) {
    const c = COPY[kind];
    const visual = cfg.visual ? cfg.visual(kind, { S, I }) : '';
    const steps = c.steps ? `<ol class="steps">${c.steps.map((s, i) => `<li data-step="${i}" data-state="${i === 0 ? 'active' : 'todo'}"><span class="step-dot" aria-hidden="true">${I('check', { size: 12, stroke: 3 })}</span>${s}</li>`).join('')}</ol>` : '';
    const actions = c.actions ? `<div class="card-actions">${c.actions.map(([act, label, ic, kind], i) =>
      `<button type="button" class="card-btn ${kind || (i === 0 ? 'primary' : 'ghost')}" data-act="${act}">${ic ? I(ic, { size: 18 }) : ''}<span>${label}</span></button>`).join('')}</div>` : '';
    return `<div class="cardbg" aria-hidden="true"><i></i><i></i><i></i></div>` +
      `<div class="card card-${kind}" role="${kind === 'error' ? 'alert' : 'status'}">` +
      `<div class="card-visual" aria-hidden="true">${visual}</div>` +
      `<h2 class="card-title">${c.title}</h2><p class="card-body">${c.body}</p>${steps}${actions}</div>`;
  }

  function stopCardFlow() {
    if (!cardFlow) return;
    cardFlow.timers.forEach(clearTimeout);
    if (cardFlow.counter) cardFlow.counter.stop();
    cardFlow = null;
  }
  function startCardFlow(kind, { auto }) {
    stopCardFlow();
    const slide = feed.current;
    LG.attach(slide);
    const flow = (cardFlow = { timers: [], counter: null });
    if (kind === 'first') {
      const steps = $$('.steps li', slide);
      const setStep = (k) => steps.forEach((li, i) => (li.dataset.state = i < k ? 'done' : i === k ? 'active' : 'todo'));
      setStep(0);
      flow.timers.push(setTimeout(() => setStep(1), 1300), setTimeout(() => setStep(2), 2700));
      if (auto) flow.timers.push(setTimeout(() => { if (cardKind === 'first') leaveCard(); }, 4600));
    }
    if (kind === 'wait') {
      const num = slide.querySelector('[data-counter]');
      const title = slide.querySelector('.card-title');
      const body = slide.querySelector('.card-body');
      const vis = slide.querySelector('.card-visual');
      let phase = '';
      flow.counter = S.counter(num, {
        format: cfg.waitFormat || ((s) => String(s)),
        onTick(s) {
          if (num && !S.isReduced()) { num.classList.remove('tick'); void num.offsetWidth; num.classList.add('tick'); }
          if (cfg.tick) cfg.tick(s, vis);
          const c = S.loadingCopy(s);
          if (c.title !== phase) {
            phase = c.title;
            title.textContent = c.title;
            body.textContent = c.body;
            if (s > 0 && !S.isReduced()) [title, body].forEach((el) => { el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap'); });
          }
        },
      }).start();
      if (auto) flow.timers.push(setTimeout(() => { if (cardKind === 'wait') leaveCard(); }, 5600));
    }
    if (kind === 'pause') {
      // HTTP 429: wait a minute, then continue by itself
      const num = slide.querySelector('[data-counter]');
      const vis = slide.querySelector('.card-visual');
      flow.counter = S.counter(num, {
        format: (s) => S.fmtClock(Math.max(0, PAUSE_S - s)),
        onTick(s) {
          if (cfg.tick) cfg.tick(s, vis, 'pause');
          if (s >= PAUSE_S && cardKind === 'pause') leaveCard().then(() => toast('Продолжаем'));
        },
      }).start();
    }
  }
  const PAUSE_S = 60;
  /** Replace the current slide with a state card. */
  function showCard(kind, { auto = false } = {}) {
    if (feed.busy) { setTimeout(() => showCard(kind, { auto }), 250); return; }
    cardKind = kind;
    feedEl.dataset.card = kind;
    if (feed.loading && feed.current.dataset.kind === 'loading') {
      renderSlide({ type: 'loading' }, feed.current);
      onCardShown();
    } else {
      feed.showLoading();
    }
    startCardFlow(kind, { auto });
  }
  function onCardShown() {
    $('#like').setAttribute('aria-pressed', 'false');
    feedEl.classList.remove('is-paused');
    setAmbient({ type: 'loading' });
    $('#src-mark').classList.add('is-hidden');
  }
  /** Leave the card for the next reel (optionally with the shuffle transition). */
  function leaveCard({ shuffle = false } = {}) {
    if (!feed.loading) return Promise.resolve(false);
    stopCardFlow();
    cardKind = null;
    shuffleNext = shuffle && !S.isReduced();
    return feed.finishLoading();
  }

  /* ======================================================================
     FEED
     ====================================================================== */
  const feedEl = $('#feed');
  const frame = $('#frame');
  const stage = $('#stage');
  const unliked = new Set();
  let shuffleNext = false;

  function renderSlide(item, el) {
    if (item.type === 'loading') { el.innerHTML = cardHTML(cardKind || 'wait'); return; }
    el.innerHTML = S.reelArt(item);
  }

  function animateYear(item, dir) {
    const box = $('#yc-year');
    const text = String(item.year);
    const chip = $('#yearchip');
    chip.setAttribute('aria-label', S.likedLabel(item.year));
    const old = box.querySelector('b:last-child');
    if (old && old.textContent === text) return;
    const b = document.createElement('b');
    b.textContent = text;
    box.append(b);
    if (S.isReduced() || !old) { box.querySelectorAll('b').forEach((x) => x !== b && x.remove()); return; }
    const d = dir >= 0 ? 1 : -1;
    const o = { duration: SPR.bouncy.duration, easing: SPR.bouncy.easing, fill: 'both' };
    b.animate([{ transform: `translateY(${d * 110}%)`, opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], o);
    old.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: `translateY(${-d * 110}%)`, opacity: 0 }], { ...o, duration: 260, easing: 'ease-in' })
      .finished.then(() => old.remove(), () => old.remove());
  }

  /* Corner: one neutral «Открыть оригинал» control for every source (no platform logos).
     In the app it opens the current video where it was published; the demo has no links. */
  const original = $('#src-mark');
  original.innerHTML = I('external', { size: cfg.markSize || 21 });
  original.addEventListener('click', () => toast('В приложении здесь откроется оригинал ролика'));
  function setSource() {
    original.classList.remove('is-hidden');
  }

  function setMeta(item, animate) {
    const meta = $('#meta');
    const apply = () => {
      $('#author').textContent = '@' + item.author;
      $('#caption').textContent = item.caption;
      $('#sound-text').textContent = `${item.sound} · ${item.sound}`;
      const liked = !unliked.has(item.id);
      const like = $('#like');
      like.setAttribute('aria-pressed', String(liked));
      like.setAttribute('aria-label', liked ? 'Убрать лайк' : 'Вернуть лайк');
    };
    if (!animate || S.isReduced()) { apply(); return; }
    meta.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(6px)' }], { duration: 140, easing: 'ease-in', fill: 'forwards' })
      .finished.then(() => {
        apply();
        meta.animate([{ opacity: 0, transform: 'translateY(10px)', filter: 'blur(4px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
      });
  }

  const ambient = $('.ambient');
  function setAmbient(item) {
    if (item && !onb.hidden) return;
    const A = cfg.ambient || {};
    // palettes may be { dark: [...], light: [...] }
    const pick = (v) => (v && !Array.isArray(v) && typeof v === 'object' ? v[S.theme.effective] || v.dark : v);
    const brand = pick(A.brand) || ['#7b55ff', '#ff5fb8', '#2fb8ff'];
    let p;
    if (!item) p = brand;
    else if (item.type === 'loading') p = pick(A.card) || brand;
    else p = A.fromReel ? A.fromReel(item, S.theme.effective) : [item.palette[0], item.palette[1], brand[0]];
    ambient.style.setProperty('--a1', p[0]);
    ambient.style.setProperty('--a2', p[1]);
    ambient.style.setProperty('--a3', p[2]);
  }

  function restartProgress() {
    const p = $('#progress');
    p.classList.remove('run');
    void p.offsetWidth;
    p.classList.add('run');
  }

  const feed = S.createFeed({
    viewport: frame,
    stage,
    render: renderSlide,
    startWithLoading: false,
    locked: () => cardKind === 'error' || cardKind === 'done' || cardKind === 'pause',
    skip: (item) => igPaused && item.source === 'instagram' && S.settings.youtube,
    onBeforeChange(item, { dir }) {
      if (item.type !== 'loading') {
        delete feedEl.dataset.card;
        animateYear(item, dir);
        setSource(item, true);
        setMeta(item, true);
      }
      setAmbient(item);
    },
    onChange(item, { dir, slide, initial }) {
      LG.attach(slide);
      const loading = item.type === 'loading';
      if (loading) { feedEl.dataset.card = cardKind || 'wait'; onCardShown(); return; }
      delete feedEl.dataset.card;
      if (initial) { animateYear(item, dir); setSource(item, false); setMeta(item, false); setAmbient(item); }
      feedEl.classList.remove('is-paused');
      stopCardFlow();
      cardKind = null;
      restartProgress();
      if (S.review.el && !document.querySelector('dialog[open]')) S.review.setActive(igPaused ? 'pausechip' : 'feed');
    },
    commit({ from, to, dir, progress }) {
      const sp = SPR.reel;
      const dur = Math.max(260, sp.duration * (1 - progress * 0.5));
      const R = cfg.slideRadius || 44;
      if (shuffleNext) {
        shuffleNext = false;
        to.style.opacity = '0';
        to.style.transform = 'scale(1.18)';
        return S.finished([
          from.animate([{ transform: 'translate(-8%, -14%) scale(.72) rotate(-9deg)', opacity: 0, borderRadius: R + 'px' }], { duration: 520, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' }),
          to.animate([{ transform: 'scale(1)', opacity: 1 }], { duration: SPR.soft.duration, easing: SPR.soft.easing, delay: 120, fill: 'forwards' }),
        ]);
      }
      if (!progress) to.style.transform = `translateY(${dir * 100}%)`;
      return S.finished([
        from.animate([{ transform: `translateY(${-dir * 26}%) scale(.88)`, opacity: 0.35, borderRadius: R + 'px' }], { duration: dur, easing: sp.easing, fill: 'forwards' }),
        to.animate([{ transform: 'translateY(0) scale(1)', borderRadius: '0px' }], { duration: dur, easing: sp.easing, fill: 'forwards' }),
      ]);
    },
    drag({ from, to, dir, progress, edge }) {
      if (edge) { from.style.transform = `translateY(${-dir * progress * 100}%)`; return; }
      from.style.transform = `translateY(${-dir * progress * 26}%) scale(${1 - 0.12 * progress})`;
      from.style.opacity = String(1 - 0.65 * progress);
      from.style.borderRadius = `${progress * (cfg.slideRadius || 44)}px`;
      to.style.transform = `translateY(${dir * (1 - progress) * 100}%)`;
    },
    cancel({ from, to, dir }) {
      const o = { duration: SPR.snap.duration, easing: SPR.snap.easing, fill: 'forwards' };
      return S.finished([
        from.animate([{ transform: 'translateY(0) scale(1)', opacity: 1, borderRadius: '0px' }], o),
        to && to.animate([{ transform: `translateY(${dir * 100}%)` }], o),
      ]).then(() => { from.style.borderRadius = ''; });
    },
    onEdge(dir) {
      if (cardKind) return;
      if (dir < 0) toast('Это первый рилс — дальше только вперёд');
    },
    onDoubleTap(e) { likeBurst(e.clientX, e.clientY, true); },
    onTap() {
      if (feed.item.type === 'loading') return;
      const paused = feedEl.classList.toggle('is-paused');
      const ind = document.createElement('div');
      ind.className = 'pause-ind';
      ind.innerHTML = I(paused ? 'pause' : 'play', { size: 30 });
      frame.append(ind);
      const k = S.isReduced() ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 0, transform: 'scale(.7)' }, { opacity: 1, transform: 'scale(1)', offset: 0.3 }, { opacity: 1, offset: 0.7 }, { opacity: 0, transform: 'scale(1.05)' }];
      ind.animate(k, { duration: 800, easing: 'ease-out', fill: 'forwards' }).finished.then(() => ind.remove());
    },
    onLikeKey() { toggleLike(); },
  });

  // card buttons (retry / report / restart / period)
  stage.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'retry') {
      b.disabled = true;
      b.classList.add('is-busy');
      b.querySelector('span').textContent = 'Пробуем…';
      setTimeout(() => { leaveCard().then(() => toast('Получилось — продолжаем')); }, S.isReduced() ? 300 : 900);
    }
    if (act === 'report') openReport();
    if (act === 'restart') { toast('Новый круг — в другом порядке'); leaveCard({ shuffle: true }); }
    if (act === 'period') { openSheet(settings, $('#open-settings')); S.review.setActive('settings'); }
  });

  /* ---- short pause of one source while the other keeps playing: a quiet chip ---- */
  let igPaused = false, chipCounter = null;
  const chip = $('#pausechip');
  chip.querySelector('.pc-ic').innerHTML = I('history', { size: 14 });
  function startSourcePause() {
    igPaused = true;
    if (feed.item.type !== 'loading' && feed.item.source === 'instagram') feed.jump((r) => r.source !== 'instagram');
    chip.hidden = false;
    if (!S.isReduced()) chip.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
    if (chipCounter) chipCounter.stop();
    chipCounter = S.counter($('[data-countdown]', chip), {
      format: (s) => S.fmtClock(Math.max(0, PAUSE_S - s)),
      onTick(s) { if (s >= PAUSE_S) stopSourcePause(true); },
    }).start();
  }
  function stopSourcePause(announce) {
    if (chipCounter) { chipCounter.stop(); chipCounter = null; }
    if (!igPaused) return;
    igPaused = false;
    chip.hidden = true;
    if (announce) toast('Рилсы снова в ленте');
  }

  /* ---- like / share / shuffle ---- */
  function toggleLike(force) {
    const item = feed.item;
    if (item.type === 'loading') return;
    const liked = force === undefined ? unliked.has(item.id) : force;
    if (liked) unliked.delete(item.id); else unliked.add(item.id);
    setMeta(item, false);
    const btn = $('#like');
    btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop');
    if (!liked) toast('Лайк убран — только здесь, Instagram не трогаем');
  }
  function likeBurst(x, y, fromTap) {
    if (feed.item.type === 'loading') return;
    if (unliked.has(feed.item.id) || !fromTap) toggleLike(true);
    const r = frame.getBoundingClientRect();
    const b = document.createElement('div');
    b.className = 'burst';
    b.style.left = x - r.left + 'px';
    b.style.top = y - r.top + 'px';
    const heart = I('heart', { size: 24 });
    b.innerHTML = `<span class="big">${heart}</span>` + Array.from({ length: 7 }, () => `<span class="p">${heart}</span>`).join('');
    frame.append(b);
    if (S.isReduced()) { b.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 700 }).finished.then(() => b.remove()); return; }
    b.querySelector('.big').animate(
      [{ transform: 'scale(0) rotate(-18deg)', opacity: 0 }, { transform: 'scale(1.25) rotate(6deg)', opacity: 1, offset: 0.35 }, { transform: 'scale(1) rotate(0)', opacity: 1, offset: 0.6 }, { transform: 'translateY(-60px) scale(.9)', opacity: 0 }],
      { duration: 1000, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
    $$('.p', b).forEach((p, i) => {
      const a = (i / 7) * Math.PI * 2 - Math.PI / 2;
      const dist = 70 + Math.random() * 40;
      p.animate([{ transform: 'translate(0,0) scale(.4)', opacity: 1 }, { transform: `translate(${Math.cos(a) * dist}px, ${Math.sin(a) * dist}px) scale(${0.6 + Math.random() * 0.6}) rotate(${(Math.random() - 0.5) * 60}deg)`, opacity: 0 }],
        { duration: 760 + Math.random() * 200, easing: 'cubic-bezier(.1,.7,.3,1)', fill: 'forwards', delay: 80 });
    });
    setTimeout(() => b.remove(), 1200);
  }
  $('#like').addEventListener('click', () => toggleLike());
  $('#share').addEventListener('click', () => toast('Ссылка скопирована — в демо ничего не отправляется'));
  $('#reshuffle').addEventListener('click', reshuffle);
  document.addEventListener('keydown', (e) => {
    if ((e.key === 's' || e.key === 'S') && !feedEl.hidden && !document.querySelector('dialog[open]') && !e.metaKey && !e.ctrlKey && !(e.target.closest && e.target.closest('input, textarea'))) reshuffle();
  });
  function reshuffle() {
    if (feed.busy || feed.loading) return;
    const btn = $('#reshuffle');
    btn.classList.remove('is-spinning'); void btn.offsetWidth; btn.classList.add('is-spinning');
    shuffleNext = !S.isReduced();
    feed.next();
  }

  /* ======================================================================
     COMMENTS — preloaded with the reel; skeleton only if they are not ready yet
     ====================================================================== */
  const AV = ['#ff7a9c,#ffb36b', '#7f5cff,#36c9ff', '#43e97b,#38c9ff', '#f093fb,#f5576c', '#ffd86f,#fc6262', '#4facfe,#00f2fe', '#a18cd1,#fbc2eb'];
  const COMMENTS = [
    { author: 'kotiki.mood', creator: true, pinned: true, time: '4 г.', likes: 2140, text: 'спустя столько лет вы всё ещё тут\u00a0— спасибо 🐾', av: 0 },
    { author: 'lena.k', time: '4 г.', likes: 341, text: 'это было 5 лет назад?? помню, как смотрела это в автобусе', av: 1,
      replies: [
        { author: 'max_on_air', time: '4 г.', likes: 28, text: 'тот самый автобус 😭', av: 2 },
        { author: 'lena.k', time: '4 г.', likes: 6, text: '@max_on_air мы были там вместе', av: 1 },
      ], open: true },
    { author: 'dasha.png', time: '3 г.', likes: 87, text: 'пересматриваю раз в год, традиция', av: 3, media: { kind: 'gif', emoji: '😹', c: ['#ffd86f', '#fc6262'] } },
    { author: 'tim', time: '2 нед.', likes: 54, text: 'кто здесь из Shuffler — отметьтесь', av: 4,
      replies: [
        { author: 'olya_v', time: '2 нед.', likes: 9, text: 'я!! случайно попалось и не жалею', av: 5 },
        { author: 'sasha.mp4', time: '1 нед.', likes: 3, text: 'тоже тут', av: 6 },
        { author: 'kotiki.mood', time: '1 нед.', likes: 40, text: 'привет всем из 2026-го', av: 0, creator: true },
      ] },
    { author: 'olya_v', time: '4 г.', likes: 19, text: 'мой кот смотрит это вместе со мной', av: 5, media: { kind: 'photo', emoji: '🐈‍⬛', c: ['#a18cd1', '#fbc2eb'] } },
    { author: 'sasha.mp4', time: '3 г.', likes: 12, text: 'звук до сих пор в голове', av: 6 },
  ];
  const fmtLikes = (n) => S.compact(n);
  function commentHTML(c, reply = false) {
    const media = c.media ? `<div class="c-media c-${c.media.kind}" style="--m1:${c.media.c[0]};--m2:${c.media.c[1]}" role="img" aria-label="${c.media.kind === 'gif' ? 'GIF' : 'Фото'} в комментарии"><span>${c.media.emoji}</span>${c.media.kind === 'gif' ? '<b>GIF</b>' : ''}</div>` : '';
    const replies = c.replies && !reply
      ? `<button type="button" class="c-more" aria-expanded="${!!c.open}"><i aria-hidden="true"></i><span>${c.open ? 'Скрыть ответы' : `Показать ${c.replies.length} ${S.plural(c.replies.length, 'ответ', 'ответа', 'ответов')}`}</span></button>` +
        `<ul class="c-replies"${c.open ? '' : ' hidden'}>${c.replies.map((r) => commentHTML(r, true)).join('')}</ul>`
      : '';
    return `<li class="c${reply ? ' is-reply' : ''}${c.pinned ? ' is-pinned' : ''}">` +
      `<span class="avatar" style="background:linear-gradient(135deg,${AV[c.av]})" aria-hidden="true">${c.author[0].toUpperCase()}</span>` +
      `<div class="c-main">` +
      (c.pinned ? `<p class="c-pin">${I('pin', { size: 12 })}Закреплён автором</p>` : '') +
      `<p class="c-head"><b class="c-name">${c.author}</b>${c.creator ? '<span class="c-badge">автор</span>' : ''}</p>` +
      `<p class="c-text">${S.esc(c.text)}</p>${media}` +
      `<div class="c-actions"><span class="c-time">${c.time}</span><button type="button" class="c-reply">Ответить</button></div>` +
      replies +
      `</div>` +
      `<button type="button" class="c-like" aria-pressed="false" aria-label="Нравится">${I('heart', { size: 15 })}<span>${fmtLikes(c.likes)}</span></button>` +
      `</li>`;
  }
  const skeletonHTML = () => Array.from({ length: 6 }, (_, i) =>
    `<li class="c is-skeleton" aria-hidden="true"><span class="avatar sk"></span><div class="c-main"><i class="sk sk-line" style="width:${[38, 30, 44, 26, 34, 40][i]}%"></i><i class="sk sk-line" style="width:${[86, 70, 92, 64, 80, 58][i]}%"></i>${i % 3 === 1 ? '<i class="sk sk-line" style="width:48%"></i>' : ''}</div></li>`).join('');
  const commentList = $('#comment-list');
  const commentsSheet = $('#comments-sheet');
  function renderComments(loading) {
    commentList.setAttribute('aria-busy', String(!!loading));
    commentList.innerHTML = loading ? skeletonHTML() : COMMENTS.map((c) => commentHTML(c)).join('');
  }
  renderComments(S.params.get('comments') === 'loading');
  commentList.addEventListener('click', (e) => {
    const more = e.target.closest('.c-more');
    if (more) {
      const list = more.nextElementSibling;
      const open = more.getAttribute('aria-expanded') !== 'true';
      more.setAttribute('aria-expanded', String(open));
      list.hidden = !open;
      const n = list.children.length;
      more.querySelector('span').textContent = open ? 'Скрыть ответы' : `Показать ${n} ${S.plural(n, 'ответ', 'ответа', 'ответов')}`;
      if (open && !S.isReduced()) list.animate([{ opacity: 0, transform: 'translateY(-4px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'ease-out' });
    }
    const like = e.target.closest('.c-like');
    if (like) {
      const on = like.getAttribute('aria-pressed') !== 'true';
      like.setAttribute('aria-pressed', String(on));
      if (!S.isReduced()) like.querySelector('svg').animate([{ transform: 'scale(1)' }, { transform: 'scale(.7)' }, { transform: 'scale(1)' }], { duration: 380, easing: 'ease-out' });
    }
    const reply = e.target.closest('.c-reply');
    if (reply) {
      const name = reply.closest('.c').querySelector('.c-name').textContent;
      const input = $('#composer input');
      input.value = `@${name} `;
      input.focus();
      input.dispatchEvent(new Event('input'));
    }
  });
  const composer = $('#composer');
  const composerInput = $('input', composer);
  const composerSend = $('.composer-send', composer);
  composerInput.addEventListener('input', () => { composerSend.disabled = !composerInput.value.trim(); });
  composer.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!composerInput.value.trim()) return;
    composerInput.value = '';
    composerSend.disabled = true;
    toast('В демо комментарии не публикуются');
  });
  $('.composer-emoji', composer).addEventListener('click', () => { composerInput.value += '😹'; composerInput.dispatchEvent(new Event('input')); });
  // comments open over a playing video: no morph, no pause
  $('#comments').addEventListener('click', () => { openSheet(commentsSheet, null); S.review.setActive('comments'); });

  /* ======================================================================
     SETTINGS
     ====================================================================== */
  const settings = $('#settings');
  const seg = $('#period');
  seg.insertAdjacentHTML('beforeend', S.PERIODS.map((p, i) =>
    `<button type="button" role="radio" data-i="${i}" data-period="${p.id}" aria-checked="${p.id === S.settings.period}">${p.short}</button>`).join(''));
  const thumb = $('.seg-thumb', seg);
  function setPeriod(id, animate = true) {
    const i = S.PERIODS.findIndex((p) => p.id === id);
    const prev = Number(getComputedStyle(seg).getPropertyValue('--i')) || 0;
    S.settings.period = id;
    seg.style.setProperty('--i', i);
    $$('button', seg).forEach((b) => { b.setAttribute('aria-checked', String(b.dataset.period === id)); b.tabIndex = b.dataset.period === id ? 0 : -1; });
    $('#period-hint').textContent = S.PERIODS[i].hint;
    $('#range').hidden = id !== 'custom';
    if (animate && !S.isReduced() && prev !== i) {
      const dist = Math.abs(i - prev);
      thumb.animate([{ scale: '1 1' }, { scale: `${1 + 0.12 * dist} .9` }, { scale: '1 1' }], { duration: 520, easing: 'ease-out' });
    }
  }
  seg.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setPeriod(b.dataset.period); });
  seg.addEventListener('keydown', (e) => {
    const i = S.PERIODS.findIndex((p) => p.id === S.settings.period);
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const ni = (i + d + S.PERIODS.length) % S.PERIODS.length;
    setPeriod(S.PERIODS[ni].id);
    $(`[data-period="${S.PERIODS[ni].id}"]`, seg).focus();
  });
  setPeriod(S.settings.period, false);

  // custom period: full month names, no "С"/"По" — order and the dash say it
  const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
  const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  function syncRange() {
    const [fy, fm] = $('#range-from').value.split('-').map(Number);
    const [ty, tm] = $('#range-to').value.split('-').map(Number);
    S.PERIODS[3].hint = `Лайки с начала ${MONTHS_GEN[fm - 1]} ${fy} до конца ${MONTHS_GEN[tm - 1]} ${ty}`;
    if (S.settings.period === 'custom') $('#period-hint').textContent = S.PERIODS[3].hint;
  }
  $$('.range-field').forEach((f) => {
    const input = $('input', f);
    const sync = () => {
      const [y, m] = input.value.split('-').map(Number);
      $('.rf-month', f).textContent = MONTHS[m - 1];
      $('.rf-year', f).textContent = String(y);
      input.setAttribute('aria-label', `${f.dataset.label}: ${MONTHS[m - 1]} ${y}`);
      syncRange();
    };
    input.addEventListener('change', sync);
    input.addEventListener('click', (e) => { if (input.showPicker) { e.preventDefault(); try { input.showPicker(); } catch (_) {} } });
    sync();
  });

  ['ig', 'yt'].forEach((k) => {
    const input = $('#src-' + k);
    input.addEventListener('change', () => {
      const other = $('#src-' + (k === 'ig' ? 'yt' : 'ig'));
      if (!input.checked && !other.checked) {
        input.checked = true;
        toast('Нужен хотя бы один источник');
        return;
      }
      S.settings[k === 'ig' ? 'instagram' : 'youtube'] = input.checked;
    });
  });

  // language popover (inside the dialog so it stays interactive); closes when the list scrolls
  const langMenu = $('#lang-menu');
  langMenu.innerHTML = S.LANGS.map((l) => `<button type="button" role="menuitemradio" data-lang="${l.id}" aria-checked="${l.id === S.settings.lang}">${l.label}${I('check', { size: 18, stroke: 2.6 })}</button>`).join('');
  langMenu.addEventListener('toggle', (e) => {
    if (e.newState !== 'open') return;
    const r = $('#lang-row').getBoundingClientRect();
    const sr = settings.getBoundingClientRect();
    const head = $('.pane-main .sheet-head', settings).getBoundingClientRect();
    const w = langMenu.offsetWidth || 210;
    langMenu.style.left = Math.max(sr.left + 12, Math.min(r.right - w - 12, innerWidth - w - 12)) + 'px';
    const h = langMenu.offsetHeight || 240;
    const below = r.bottom + 6;
    const fitsBelow = below + h <= Math.min(innerHeight, sr.bottom) - 8;
    const top = fitsBelow ? below : Math.max(head.bottom + 6, r.top - h - 6);
    langMenu.style.top = Math.max(8, top) + 'px';
  });
  langMenu.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lang]');
    if (!b) return;
    S.settings.lang = b.dataset.lang;
    $$('[data-lang]', langMenu).forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    $('#lang-value').textContent = b.textContent;
    langMenu.hidePopover();
    if (b.dataset.lang !== 'ru') toast('В макете интерфейс остаётся на русском');
  });

  // theme
  const syncThemeSeg = () => $$('[data-theme-pick]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.themePick === S.theme.effective)));
  $('#theme-seg').addEventListener('click', (e) => {
    const b = e.target.closest('[data-theme-pick]');
    if (!b) return;
    const apply = () => S.theme.set(b.dataset.themePick);
    if (document.startViewTransition && !S.isReduced() && b.dataset.themePick !== S.theme.effective) {
      root.classList.add('vt-full');
      document.startViewTransition(apply).finished.finally(() => root.classList.remove('vt-full'));
    } else apply();
  });
  document.addEventListener('shuffler:theme', () => { syncThemeSeg(); setAmbient(onb.hidden ? feed.item : null); });
  syncThemeSeg();

  // header state follows each scroll area: hairline + compact title once content moves under it
  $$('.pane').forEach((pane) => {
    const body = $('.pane-body', pane);
    if (!body) return;
    let raf = 0;
    const sync = () => {
      raf = 0;
      const y = body.scrollTop;
      pane.classList.toggle('is-scrolled', y > 1);
      pane.style.setProperty('--sp', Math.min(1, y / (cfg.titleCollapse || 52)).toFixed(3));
    };
    body.addEventListener('scroll', () => {
      if (langMenu.matches(':popover-open')) langMenu.hidePopover();
      if (!raf) raf = requestAnimationFrame(sync);
    }, { passive: true });
    sync();
  });

  // detail pane: report a problem
  const detailBody = $('#detail-body');
  const REPORT_TEMPLATE = 'Что случилось: \n\nЧто было перед этим: ';
  const PANES = {
    report: {
      title: 'Сообщить о проблеме',
      html: `<div class="detail report">
        <p>Расскажи коротко, что пошло не так. Технический отчёт уже приложен.</p>
        <textarea class="field" id="report-text" rows="6" aria-label="Описание проблемы">${REPORT_TEMPLATE}</textarea>
        <div class="attach" role="group" aria-label="Приложенный файл">
          <span class="attach-ic">${I('fileText', { size: 20 })}</span>
          <span class="attach-text"><b>shuffler-report.txt</b><small>Отчёт для диагностики · 14 КБ</small></span>
          <span class="attach-ok" aria-label="Приложен">${I('paperclip', { size: 17 })}</span>
        </div>
        <p class="detail-note">В отчёте только версии Shuffler и браузера и журнал ошибок — без cookies, паролей и истории лайков.</p>
        <button type="button" class="wide-btn cta" data-send="report">${I('send', { size: 18 })}<span>Отправить</span></button>
      </div>`,
      after() {
        const ta = $('#report-text');
        ta.addEventListener('focus', () => { if (ta.value === REPORT_TEMPLATE) { const p = 'Что случилось: '.length; ta.setSelectionRange(p, p); } }, { once: true });
      },
    },
  };
  function openPane(id, { instant = false } = {}) {
    const p = PANES[id];
    $('#detail-title').textContent = p.title;
    detailBody.innerHTML = p.html;
    detailBody.scrollTop = 0;
    if (p.after) p.after();
    if (instant) { settings.classList.add('no-pane-anim'); requestAnimationFrame(() => requestAnimationFrame(() => settings.classList.remove('no-pane-anim'))); }
    settings.dataset.pane = 'detail';
    detailBody.dispatchEvent(new Event('scroll'));
    setTimeout(() => $('#detail-title').focus({ preventScroll: true }), 50);
  }
  function openReport() {
    openSheet(settings, null);
    openPane('report', { instant: true });
    S.review.setActive('settings');
  }
  settings.addEventListener('click', (e) => {
    const open = e.target.closest('[data-open-pane]');
    if (open) openPane(open.dataset.openPane);
    if (e.target.closest('[data-back]')) { settings.dataset.pane = 'main'; setTimeout(() => $('[data-open-pane]', settings).focus({ preventScroll: true }), 50); }
    const pick = e.target.closest('.pick');
    if (pick) $$('.pick', pick.parentElement).forEach((b) => b.setAttribute('aria-pressed', String(b === pick)));
    const send = e.target.closest('[data-send]');
    if (send) { toast(send.dataset.send === 'report' ? 'Спасибо! Отчёт готов (в демо не отправляется)' : 'Спасибо! Платежи появятся позже'); settings.dataset.pane = 'main'; }
  });

  /* ---- open / close (settings: View Transition morph from the gear; comments: plain slide-up) ---- */
  function supportsTopLayerExit() {
    if (!(window.CSS && CSS.supports('overlay', 'auto') && CSS.supports('transition-behavior', 'allow-discrete'))) return false;
    const p = document.createElement('div');
    p.style.cssText = 'transition: display 1s allow-discrete !important; display: block;';
    document.body.append(p);
    getComputedStyle(p).display;
    p.style.display = 'none';
    const ok = getComputedStyle(p).display === 'block';
    p.remove();
    return ok;
  }
  let topLayerExit = null;
  function openSheet(dlg, origin) {
    if (dlg.open) return;
    feed.setEnabled(false);
    dlg.dataset.pane = 'main';
    $$('.pane-body', dlg).forEach((b) => { b.scrollTop = 0; b.dispatchEvent(new Event('scroll')); });
    const useVT = document.startViewTransition && !S.isReduced() && origin;
    // focus the sheet title rather than the first button (no stray focus ring on the close button)
    const focusTitle = () => { const t = $('.pane-main .head-title', dlg); if (t) t.focus({ preventScroll: true }); };
    if (!useVT) { dlg.showModal(); focusTitle(); LG.attach(dlg); return; }
    origin.style.viewTransitionName = 'settings-morph';
    dlg.classList.add('vt-morph');
    const vt = document.startViewTransition(() => {
      origin.style.viewTransitionName = '';
      dlg.style.viewTransitionName = 'settings-morph';
      dlg.showModal();
      focusTitle();
    });
    vt.finished.finally(() => { dlg.style.viewTransitionName = ''; dlg.classList.remove('vt-morph'); LG.attach(dlg); });
  }
  async function closeSheet(dlg) {
    if (!dlg.open) return;
    if (langMenu.matches(':popover-open')) langMenu.hidePopover();
    if (topLayerExit === null) topLayerExit = supportsTopLayerExit();
    if (!topLayerExit) {
      dlg.setAttribute('data-closing', '');
      const anims = dlg.getAnimations({ subtree: false });
      await Promise.race([Promise.allSettled(anims.map((a) => a.finished)), S.wait(650)]);
      dlg.removeAttribute('data-closing');
    }
    dlg.close();
  }
  [settings, commentsSheet].forEach((dlg) => {
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); closeSheet(dlg); });
    dlg.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) closeSheet(dlg);
      else if (e.target === dlg) {
        const r = dlg.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeSheet(dlg);
      }
    });
    dlg.addEventListener('close', () => {
      feed.setEnabled(!feedEl.hidden);
      if (!feedEl.hidden) S.review.setActive(cardKind ? ({ wait: 'loading' }[cardKind] || cardKind) : igPaused ? 'pausechip' : 'feed');
    });
    const grab = $('.sheet-grab', dlg);
    if (grab) {
      let y0 = null;
      grab.addEventListener('pointerdown', (e) => { y0 = e.clientY; grab.setPointerCapture(e.pointerId); dlg.style.transition = 'none'; });
      grab.addEventListener('pointermove', (e) => { if (y0 == null) return; dlg.style.translate = `0 ${Math.max(0, e.clientY - y0)}px`; });
      const end = (e) => {
        if (y0 == null) return;
        const dy = e.clientY - y0; y0 = null;
        dlg.style.transition = ''; dlg.style.translate = '';
        if (dy > 120) closeSheet(dlg);
      };
      grab.addEventListener('pointerup', end);
      grab.addEventListener('pointercancel', end);
    }
  });
  $('#open-settings').addEventListener('click', () => { openSheet(settings, $('#open-settings')); S.review.setActive('settings'); });

  /* ======================================================================
     SCREENS
     ====================================================================== */
  function show(screen) {
    const isOnb = screen === 'onboarding';
    onb.hidden = !isOnb;
    feedEl.hidden = isOnb;
    root.dataset.screen = isOnb ? 'onboarding' : 'feed';
    feed.setEnabled(!isOnb);
    setAmbient(isOnb ? null : feed.item);
    if (isOnb) startOnboarding(); else { clearInterval(swapTimer); LG.attach(feedEl); LG.attach(feed.current); }
  }
  let hintShown = false;
  function showHint() {
    if (hintShown || S.isReduced()) return;
    hintShown = true;
    setTimeout(() => $('#hint').classList.add('show'), 700);
  }
  const CARD_STATES = { first: 'first', loading: 'wait', pause: 'pause', error: 'error', done: 'done' };
  function setState(id) {
    [settings, commentsSheet].forEach((d) => { if (d.open) d.close(); });
    if (id !== 'pausechip') stopSourcePause(false);
    if (id === 'onboarding') { stopCardFlow(); show('onboarding'); return; }
    show('feed');
    if (CARD_STATES[id]) { showCard(CARD_STATES[id]); return; }
    if (feed.loading) { stopCardFlow(); cardKind = null; feed.finishLoading(); }
    if (id === 'feed') showHint();
    const later = (fn) => setTimeout(fn, feed.busy ? 560 : 30);
    if (id === 'pausechip') later(startSourcePause);
    if (id === 'settings') later(() => openSheet(settings, null));
    if (id === 'comments') later(() => openSheet(commentsSheet, null));
  }

  LG.attach(document);
  S.review.mount({ number: cfg.number, name: cfg.name, current: S.initialState(), onSelect: setState });
  const first = S.initialState();
  if (first === 'onboarding') show('onboarding');
  else {
    show('feed');
    if (CARD_STATES[first]) showCard(CARD_STATES[first]);
    else {
      if (first === 'feed') showHint();
      if (first === 'settings') openSheet(settings, null);
      if (first === 'comments') openSheet(commentsSheet, null);
      if (first === 'pausechip') queueMicrotask(() => queueMicrotask(startSourcePause));
    }
  }
  if (S.params.get('pane') && PANES[S.params.get('pane')] && settings.open) openPane(S.params.get('pane'), { instant: true });

  // read-only hook for automated checks
  window.__liquid = { feed, get cardKind() { return cardKind; }, openSheet: (id) => openSheet($('#' + id), null), openPane, settings, commentsSheet };
};
