/*
 * Shuffler · interactive demo — shared core (classic script, works from file://).
 * Provides: logo + Lucide icons (ISC, see ../../assets/LICENSE-lucide.txt), synthetic reel data,
 * feed engine (swipe / wheel / keys), loading counter, theme + reduced-motion handling,
 * review dock (?review=1). No network access, no real accounts. All data below is fictional.
 */
(function () {
  'use strict';

  const S = (window.Shuffler = {});
  const root = document.documentElement;
  S.params = new URLSearchParams(location.search);
  /* ?embed=1 — the demo inside the site's phone frame. Until the visitor touches the demo,
     programmatic focus is ignored so it never pulls focus (or scroll) away from the page;
     afterwards focus works as usual, without scrolling. */
  if (S.params.get('embed') === '1') {
    root.classList.add('is-embed');
    const nativeFocus = HTMLElement.prototype.focus;
    let engaged = false;
    const engage = () => { engaged = true; };
    addEventListener('pointerdown', engage, { capture: true, once: true });
    addEventListener('keydown', engage, { capture: true, once: true });
    HTMLElement.prototype.focus = function (opts) {
      if (engaged) nativeFocus.call(this, Object.assign({}, opts, { preventScroll: true }));
    };
  }
  /* ?review=1 — show the screen switcher used for design review */
  S.reviewMode = S.params.get('review') === '1';
  if (S.reviewMode) root.classList.add('is-review');

  /* ------------------------------------------------------------------ store
   * The public demo keeps nothing in the browser: preferences live in memory only. */
  const mem = new Map();
  const store = {
    get(k) { return mem.has(k) ? mem.get(k) : null; },
    set(k, v) { mem.set(k, String(v)); },
  };
  S.store = store;

  /* ----------------------------------------------------------- reduced motion
   * The OS preference is mirrored onto <html data-motion="reduced"> so that the
   * review dock can also simulate it. Concept CSS targets [data-motion="reduced"]. */
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  let motionOverride = S.params.get('motion') || null; // 'reduced' | 'full' | null
  function applyMotion() {
    const reduced = motionOverride ? motionOverride === 'reduced' : mqReduce.matches;
    root.dataset.motion = reduced ? 'reduced' : 'full';
    document.dispatchEvent(new CustomEvent('shuffler:motion', { detail: { reduced } }));
  }
  mqReduce.addEventListener('change', applyMotion);
  applyMotion();
  S.isReduced = () => root.dataset.motion === 'reduced';
  S.setMotion = (mode) => { motionOverride = mode; applyMotion(); };

  /* ------------------------------------------------------------------ theme */
  const mqDark = matchMedia('(prefers-color-scheme: dark)');
  S.theme = {
    key: 'shuffler-liquid:theme',
    pref: 'system',
    init(fallback) {
      const fromUrl = S.params.get('theme');
      this.pref = fromUrl || store.get(this.key) || fallback || 'system';
      this.apply();
      mqDark.addEventListener('change', () => this.pref === 'system' && this.apply());
    },
    get effective() { return this.pref === 'system' ? (mqDark.matches ? 'dark' : 'light') : this.pref; },
    apply() {
      const t = this.effective;
      root.dataset.theme = t;
      root.style.colorScheme = t;
      document.dispatchEvent(new CustomEvent('shuffler:theme', { detail: { theme: t } }));
    },
    set(pref) { this.pref = pref; store.set(this.key, pref); this.apply(); },
    toggle() { this.set(this.effective === 'dark' ? 'light' : 'dark'); },
  };

  /* ------------------------------------------------------------------- logo */
  S.HEART_PATH = 'M32 49 15.7 33.2a11.1 11.1 0 0 1 0-15.7 11.1 11.1 0 0 1 15.7 0l.6.6.6-.6a11.1 11.1 0 0 1 15.7 15.7L32 49Z';
  /** The Shuffler mark: lavender squircle + aubergine heart. */
  S.logo = ({ size = 40, cls = '', title = '' } = {}) =>
    `<svg class="sh-logo ${cls}" width="${size}" height="${size}" viewBox="0 0 64 64" ${title ? `role="img" aria-label="${title}"` : 'aria-hidden="true"'}>` +
    `<rect class="sh-logo-bg" width="64" height="64" rx="16" fill="var(--logo-bg, #D5C6FF)"/>` +
    `<path class="sh-logo-heart" d="${S.HEART_PATH}" fill="var(--logo-heart, #251B36)"/></svg>`;

  /* ------------------------------------------------------------------ icons
   * Lucide (ISC) geometry, 24×24 grid, stroke 2. */
  const ICONS = {
    heart: '<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/>',
    comment: '<path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/>',
    send: '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
    sliders: '<path d="M10 5H3"/><path d="M12 19H3"/><path d="M14 3v4"/><path d="M16 17v4"/><path d="M21 12h-9"/><path d="M21 19h-5"/><path d="M21 5h-7"/><path d="M8 10v4"/><path d="M8 12H3"/>',
    shuffle: '<path d="m18 14 4 4-4 4"/><path d="m18 2 4 4-4 4"/><path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-7.6a4 4 0 0 1 3.3-1.7H22"/><path d="M2 6h1.972a4 4 0 0 1 3.6 2.2"/><path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
    languages: '<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    lifebuoy: '<circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/><circle cx="12" cy="12" r="4"/>',
    calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
    history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    chevronUp: '<path d="m18 15-6-6-6 6"/>',
    arrowUp: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
    arrowDown: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    volume: '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    play: '<polygon points="6 3 20 12 6 21 6 3"/>',
    pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
    more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    rotate: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    coffee: '<path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/>',
    user: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
    menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
    fileText: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    paperclip: '<path d="m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551"/>',
    wifiOff: '<path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M19 12.859a10 10 0 0 0-2.007-1.523"/><path d="M2 8.82a15 15 0 0 1 4.177-2.643"/><path d="M22 8.82a15 15 0 0 0-11.288-3.764"/><path d="m2 2 20 20"/>',
    cloudOff: '<path d="m2 2 20 20"/><path d="M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193"/><path d="M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    sparkles: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.563.563 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.563.563 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>',
    circleCheck: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
    smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/>',
    image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    arrowUpRight: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
  };
  S.ICONS = ICONS;
  S.icon = (name, { size = 24, stroke = 2, cls = '' } = {}) =>
    `<svg class="ic ic-${name} ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  /* ------------------------------------------------------------- reel data
   * Synthetic examples only. Visuals are CSS gradients + emoji, no media. */
  S.NOW_YEAR = 2026;
  S.REELS = [
    { id: 'r1', source: 'instagram', author: 'kotiki.mood', caption: 'когда пятница наступила, а ты ещё на созвоне', top: 'КОГДА ПЯТНИЦА', bottom: 'А ТЫ ЕЩЁ НА СОЗВОНЕ', emoji: '😼', scene: 'bounce', year: 2020, likes: 128400, comments: 1326, sound: 'оригинальный звук · kotiki.mood', palette: ['#ff9a8b', '#ff6a88', '#ffd3a5'], ink: '#3b0d1c' },
    { id: 'r2', source: 'youtube', author: 'dance.archive', caption: 'этот звук играл из каждого окна', top: 'ЛЕТО 2021', bottom: 'ЭТОТ ЗВУК БЫЛ ВЕЗДЕ', emoji: '🕺', scene: 'dance', year: 2021, likes: 2140000, comments: 18700, sound: 'summer loop · dance.archive', palette: ['#7f5cff', '#00d4ff', '#ff4fd8'], ink: '#140a3a' },
    { id: 'r3', source: 'instagram', author: 'meme.vault', caption: 'POV: открыл свои старые лайки', top: 'POV:', bottom: 'ОТКРЫЛ СТАРЫЕ ЛАЙКИ', emoji: '🦖', scene: 'stomp', year: 2022, likes: 56300, comments: 942, sound: 'оригинальный звук · meme.vault', palette: ['#a8ff78', '#2bd2a3', '#f9f871'], ink: '#0b2d22' },
    { id: 'r4', source: 'youtube', author: 'kitchen.chaos', caption: 'рецепт, который я так и не приготовил', top: 'РЕЦЕПТ НА 5 МИНУТ', bottom: '(ПРОШЛО 3 ГОДА)', emoji: '🍳', scene: 'spin', year: 2023, likes: 342000, comments: 4105, sound: 'кухонный бит · kitchen.chaos', palette: ['#ffd86f', '#fc6262', '#ffb199'], ink: '#3a1405' },
    { id: 'r5', source: 'instagram', author: 'skate.or.cry', caption: 'попытка №47. мама, я почти смог', top: 'ПОПЫТКА №47', bottom: 'ПОЧТИ ПОЛУЧИЛОСЬ', emoji: '🛹', scene: 'kickflip', year: 2021, likes: 91200, comments: 2310, sound: 'оригинальный звук · skate.or.cry', palette: ['#4facfe', '#00f2fe', '#c471f5'], ink: '#06243d' },
    { id: 'r6', source: 'youtube', author: 'frog.daily', caption: 'лягушка дня. сегодня — в шляпе', top: 'ЛЯГУШКА ДНЯ', bottom: 'СЕГОДНЯ В ШЛЯПЕ', emoji: '🐸', scene: 'float', year: 2024, likes: 777000, comments: 9999, sound: 'ква-ремикс · frog.daily', palette: ['#43e97b', '#38f9d7', '#fee140'], ink: '#073320' },
    { id: 'r7', source: 'instagram', author: 'bus.stop.cat', caption: 'он ждёт автобус с самого утра', top: 'ЖДЁТ АВТОБУС', bottom: 'С САМОГО УТРА', emoji: '🐈', scene: 'wobble', year: 2020, likes: 410000, comments: 5120, sound: 'оригинальный звук · bus.stop.cat', palette: ['#f093fb', '#f5576c', '#ffd1ff'], ink: '#3a0a2c' },
  ];

  S.SOURCES = {
    instagram: { label: 'Instagram Reels', short: 'Instagram', count: 2431 },
    youtube: { label: 'YouTube Shorts', short: 'YouTube', count: 868 },
  };
  S.PERIODS = [
    { id: 'all', label: 'Всё время', short: 'Всё время', hint: 'Все лайки — с самого первого' },
    { id: 'year', label: 'Последний год', short: 'Год', hint: 'С октября 2025 года по сегодня' },
    { id: 'month', label: 'Месяц', short: 'Месяц', hint: 'Лайки за последний месяц' },
    { id: 'custom', label: 'Свой период', short: 'Свой', hint: 'Выбери начало и конец периода' },
  ];
  S.LANGS = [
    { id: 'ru', label: 'Русский' },
    { id: 'en', label: 'English' },
    { id: 'de', label: 'Deutsch' },
    { id: 'es', label: 'Español' },
    { id: 'fr', label: 'Français' },
  ];
  S.settings = { instagram: true, youtube: true, period: 'all', lang: 'ru', sound: true };

  /* --------------------------------------------------------------- formats */
  S.compact = (n) => {
    if (n < 1000) return String(n);
    const fmt = (v, s) => (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10).toString().replace('.', ',') + s;
    return n < 1e6 ? fmt(n / 1e3, 'K') : fmt(n / 1e6, 'M');
  };
  S.plural = (n, one, few, many) => {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  };
  S.ago = (year) => {
    const d = S.NOW_YEAR - year;
    return d <= 0 ? 'в этом году' : `${d} ${S.plural(d, 'год', 'года', 'лет')} назад`;
  };
  S.likedLabel = (year) => `Лайкнуто в ${year}`;
  S.fmtClock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  S.fmtSec = (s) => `${s} с`;
  S.loadingCopy = (sec, source = 'Instagram') => {
    if (sec < 8) return { title: `${source} немного тормозит`, body: 'Загружаем твои рилсы… Обычно это занимает несколько секунд.' };
    if (sec < 16) return { title: 'Ещё чуть-чуть', body: 'Перемешиваем самые старые лайки — они грузятся дольше всего.' };
    return { title: `${source} сегодня не спешит`, body: 'Можно ничего не делать: лента продолжит сама, как только рилсы приедут.' };
  };

  /* ------------------------------------------------------------- reel art */
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  S.esc = esc;
  /** Looping placeholder "video": moving gradient blobs + emoji subject + classic meme caption. */
  S.reelArt = (r, { meme = true } = {}) =>
    `<div class="ra" data-scene="${r.scene}" style="--c1:${r.palette[0]};--c2:${r.palette[1]};--c3:${r.palette[2]};--ink:${r.ink}" aria-hidden="true">` +
    `<i class="ra-blob ra-b1"></i><i class="ra-blob ra-b2"></i><i class="ra-blob ra-b3"></i>` +
    `<div class="ra-subject"><span class="ra-shadow"></span><span class="ra-emoji">${r.emoji}</span></div>` +
    (meme ? `<p class="ra-meme ra-top">${esc(r.top)}</p><p class="ra-meme ra-bottom">${esc(r.bottom)}</p>` : '') +
    `<i class="ra-grain"></i></div>`;

  /* --------------------------------------------------------------- counter */
  S.counter = function (el, { format = S.fmtSec, onTick } = {}) {
    let t0 = 0, timer = 0, last = -1;
    const tick = () => {
      const s = Math.floor((performance.now() - t0) / 1000);
      if (s === last) return;
      last = s;
      if (el) el.textContent = format(s);
      if (onTick) onTick(s);
    };
    return {
      start() { this.stop(); t0 = performance.now(); last = -1; tick(); timer = setInterval(tick, 200); return this; },
      stop() { clearInterval(timer); timer = 0; return this; },
      get running() { return !!timer; },
      get seconds() { return Math.max(0, last); },
    };
  };

  /* ----------------------------------------------------------------- toast */
  S.toast = function (msg, container = document.body, cls = 'toast') {
    const t = document.createElement('div');
    t.className = cls;
    t.setAttribute('role', 'status');
    t.textContent = msg;
    container.append(t);
    setTimeout(() => t.classList.add('is-leaving'), 1900);
    setTimeout(() => t.remove(), 2400);
    return t;
  };

  /* ------------------------------------------------------------ helpers */
  S.wait = (ms) => new Promise((r) => setTimeout(r, ms));
  S.finished = (anims) => Promise.all([].concat(anims).filter(Boolean).map((a) => a.finished.catch(() => {})));
  /** Remove WAAPI animations (not CSS ones) and inline motion styles left by drag/commit. */
  S.clearMotion = (el) => {
    if (!el) return;
    el.getAnimations().forEach((a) => { if (a.constructor === Animation) a.cancel(); });
    ['transform', 'translate', 'scale', 'rotate', 'opacity', 'filter', 'clipPath', 'zIndex', 'transformOrigin'].forEach((p) => (el.style[p] = ''));
  };
  S.fade = (from, to) => {
    to.style.opacity = '0';
    return S.finished([
      from.animate([{ opacity: 0 }], { duration: 160, fill: 'forwards' }),
      to.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, fill: 'forwards' }),
    ]);
  };
  function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  S.shuffle = (arr, rnd = Math.random) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  /* ============================================================ FEED ENGINE
   * opts: {
   *   viewport,             element receiving pointer/wheel input (gets touch-action:none)
   *   stage,                element slides are appended to (defaults to viewport)
   *   render(item, el),     fill a slide; item.type === 'loading' for the loading card
   *   commit({from,to,dir,progress,velocity}) => Promise   custom transition (optional)
   *   drag({from,to,dir,progress,edge})                    live drag styling (optional)
   *   cancel({from,to,dir,progress}) => Promise            snap back (optional)
   *   onChange(item, {pos,dir,slide,initial})              update chrome after settle
   *   onBeforeChange(item, {dir,slide})                    fires as a transition starts
   *   onEdge(dir), onTap(e), onDoubleTap(e), onLikeKey()
   *   startWithLoading: bool, seed: number, slideClass: string
   *   locked() => bool       true while a blocking card (error / all watched) must not be swiped away
   * }
   * Shuffle is a seeded permutation; rounds never repeat a reel and history allows going back. */
  S.createFeed = function (o) {
    const viewport = o.viewport;
    const stage = o.stage || viewport;
    const reels = o.reels || S.REELS;
    const rnd = mulberry32(o.seed != null ? o.seed : Number(S.params.get('seed') || 11));
    const order = [];
    const extend = () => {
      const ids = S.shuffle(reels.map((_, i) => i), rnd);
      if (order.length && ids[0] === order[order.length - 1]) ids.push(ids.shift());
      order.push(...ids);
    };
    extend();
    const reelAt = (p) => { while (p >= order.length) extend(); return reels[order[p]]; };
    const LOADING = { type: 'loading', id: 'loading' };

    let pos = 0, loading = !!o.startWithLoading, busy = false, enabled = true, queued = 0, drag = null;

    viewport.style.touchAction = 'none';

    function makeSlide(item) {
      const el = document.createElement('article');
      el.className = o.slideClass || 'slide';
      el.dataset.kind = item.type === 'loading' ? 'loading' : 'reel';
      if (item.id) el.dataset.reel = item.id;
      o.render(item, el);
      return el;
    }
    const currentItem = () => (loading ? LOADING : reelAt(pos));
    let current = makeSlide(currentItem());
    current.classList.add('is-current');
    stage.append(current);
    queueMicrotask(() => o.onChange && o.onChange(currentItem(), { pos, dir: 0, slide: current, initial: true }));

    /** Next position in a direction, stepping over reels the app wants skipped (e.g. a paused source). */
    const nextPos = (from, dir) => {
      let p = from + dir;
      while (p >= 0 && o.skip && o.skip(reelAt(p)) && Math.abs(p - from) < 60) p += dir;
      return p;
    };
    const itemFor = (dir) => {
      if (loading) return dir > 0 && !(o.locked && o.locked()) ? reelAt(pos) : null;
      const p = nextPos(pos, dir);
      return p >= 0 ? reelAt(p) : null;
    };

    function defaultCommit({ from, to, dir, progress }) {
      const d = Math.max(200, 460 * (1 - progress));
      const ease = 'cubic-bezier(.2,.8,.2,1)';
      if (!progress) to.style.transform = `translateY(${dir * 100}%)`;
      return S.finished([
        from.animate([{ transform: `translateY(${-dir * 100}%)` }], { duration: d, easing: ease, fill: 'forwards' }),
        to.animate([{ transform: 'translateY(0)' }], { duration: d, easing: ease, fill: 'forwards' }),
      ]);
    }
    function defaultDrag({ from, to, dir, progress, edge }) {
      from.style.transform = `translateY(${-dir * progress * 100}%)`;
      if (to && !edge) to.style.transform = `translateY(${dir * (1 - progress) * 100}%)`;
    }
    function defaultCancel({ from, to, dir }) {
      const opts = { duration: 280, easing: 'cubic-bezier(.3,1.4,.5,1)', fill: 'forwards' };
      return S.finished([
        from.animate([{ transform: 'translateY(0)' }], opts),
        to && to.animate([{ transform: `translateY(${dir * 100}%)` }], opts),
      ]);
    }
    function edgeBounce(dir) {
      if (S.isReduced()) return;
      current.animate(
        [{ transform: 'translateY(0)' }, { transform: `translateY(${dir > 0 ? -2.5 : 2.5}%)` }, { transform: 'translateY(0)' }],
        { duration: 380, easing: 'cubic-bezier(.3,.7,.4,1)' }
      );
    }

    async function go(dir, from = {}) {
      if (!enabled || !dir) return false;
      if (busy) { queued = dir; return false; }
      const item = itemFor(dir);
      if (!item) {
        if (from.slide) from.slide.remove();
        edgeBounce(dir);
        if (o.onEdge) o.onEdge(dir);
        return false;
      }
      busy = true;
      const target = loading ? pos : nextPos(pos, dir);
      const next = from.slide || makeSlide(item);
      if (!next.isConnected) stage.append(next);
      next.classList.add('is-incoming');
      if (o.onBeforeChange) o.onBeforeChange(item, { dir, slide: next });
      try {
        if (S.isReduced()) await S.fade(current, next);
        else await (o.commit || defaultCommit)({ from: current, to: next, dir, progress: from.progress || 0, velocity: from.velocity || 0 });
      } catch (err) { console.warn(err); }
      current.remove();
      S.clearMotion(next);
      next.classList.remove('is-incoming');
      next.classList.add('is-current');
      current = next;
      if (loading) loading = false; else pos = target;
      busy = false;
      if (o.onChange) o.onChange(item, { pos, dir, slide: current });
      if (queued) { const q = queued; queued = 0; go(q); }
      return true;
    }

    /* ---- pointer drag (touch + mouse) ---- */
    const NO_DRAG = 'button, a, input, select, textarea, label, dialog, [data-no-drag]';
    let lastTap = { t: 0, x: 0, y: 0 }, tapTimer = 0;
    viewport.addEventListener('pointerdown', (e) => {
      if (!enabled || busy || e.button > 0 || e.target.closest(NO_DRAG)) return;
      drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dy: 0, active: false, dir: 0, neighbor: null, samples: [] };
    });
    viewport.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      if (!drag.active) {
        if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy)) { drag = null; return; }
        if (Math.abs(dy) < 8) return;
        drag.active = true;
        try { viewport.setPointerCapture(e.pointerId); } catch (_) {}
        viewport.classList.add('is-dragging');
        clearTimeout(tapTimer);
      }
      drag.dy = dy;
      drag.samples.push([e.timeStamp, dy]);
      while (drag.samples.length > 2 && e.timeStamp - drag.samples[0][0] > 90) drag.samples.shift();
      const dir = dy < 0 ? 1 : -1;
      if (dir !== drag.dir) {
        if (drag.neighbor) drag.neighbor.remove();
        S.clearMotion(current);
        drag.dir = dir;
        const item = itemFor(dir);
        drag.neighbor = item ? makeSlide(item) : null;
        if (drag.neighbor) { drag.neighbor.classList.add('is-incoming'); stage.append(drag.neighbor); }
      }
      const h = viewport.clientHeight || 1;
      let progress = Math.min(1, Math.abs(dy) / h);
      const edge = !drag.neighbor;
      if (edge) progress = 0.12 * (1 - 1 / (1 + progress * 3)); // rubber band
      if (S.isReduced()) { // no live follow for reduced motion; commit decides on release
        if (drag.neighbor) drag.neighbor.style.opacity = '0';
        return;
      }
      (o.drag || defaultDrag)({ from: current, to: drag.neighbor, dir, progress, edge });
    });
    const endDrag = (e, cancelled) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag;
      drag = null;
      viewport.classList.remove('is-dragging');
      if (!d.active) {
        if (cancelled) return;
        // tap / double tap
        const now = e.timeStamp;
        if (now - lastTap.t < 300 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 40) {
          clearTimeout(tapTimer);
          lastTap.t = 0;
          if (o.onDoubleTap) o.onDoubleTap(e);
        } else {
          lastTap = { t: now, x: e.clientX, y: e.clientY };
          const ev = e;
          tapTimer = setTimeout(() => o.onTap && o.onTap(ev), 300);
        }
        return;
      }
      const h = viewport.clientHeight || 1;
      const progress = Math.min(1, Math.abs(d.dy) / h);
      const s = d.samples;
      const v = s.length > 1 ? (s[s.length - 1][1] - s[0][1]) / Math.max(1, s[s.length - 1][0] - s[0][0]) : 0;
      const flick = Math.abs(v) > 0.45 && Math.sign(-v) === d.dir;
      if (!cancelled && d.neighbor && (progress > 0.18 || flick)) {
        go(d.dir, { slide: d.neighbor, progress: S.isReduced() ? 0 : progress, velocity: v });
      } else {
        busy = true;
        const done = () => { if (d.neighbor) d.neighbor.remove(); S.clearMotion(current); busy = false; };
        if (S.isReduced()) return done();
        Promise.resolve((o.cancel || defaultCancel)({ from: current, to: d.neighbor, dir: d.dir, progress })).catch(() => {}).then(done);
        if (!d.neighbor && o.onEdge) o.onEdge(d.dir);
      }
    };
    viewport.addEventListener('pointerup', (e) => endDrag(e, false));
    viewport.addEventListener('pointercancel', (e) => endDrag(e, true));

    /* ---- wheel / trackpad: one step per gesture ---- */
    let wheelAcc = 0, wheelLocked = false, wheelIdle = 0;
    viewport.addEventListener('wheel', (e) => {
      if (!enabled || e.ctrlKey || e.target.closest('[data-scroll]')) return;
      e.preventDefault();
      clearTimeout(wheelIdle);
      wheelIdle = setTimeout(() => { wheelAcc = 0; wheelLocked = false; }, 170);
      if (wheelLocked) return;
      wheelAcc += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      if (Math.abs(wheelAcc) > 36) { wheelLocked = true; go(Math.sign(wheelAcc)); wheelAcc = 0; }
    }, { passive: false });

    /* ---- keyboard ---- */
    document.addEventListener('keydown', (e) => {
      if (!enabled || e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey) return;
      if (document.querySelector('dialog[open]')) return;
      const t = e.target;
      if (t && t.closest && t.closest('input, textarea, select, [contenteditable="true"], .rv')) return;
      const k = e.key;
      if (k === 'ArrowDown' || k === 'PageDown' || k === 'j' || k === 'J' || (k === ' ' && !(t && t.closest && t.closest('button')))) { e.preventDefault(); go(1); }
      else if (k === 'ArrowUp' || k === 'PageUp' || k === 'k' || k === 'K') { e.preventDefault(); go(-1); }
      else if ((k === 'l' || k === 'L') && o.onLikeKey) { e.preventDefault(); o.onLikeKey(); }
    });

    return {
      next: () => go(1),
      prev: () => go(-1),
      go,
      get current() { return current; },
      get item() { return currentItem(); },
      get pos() { return pos; },
      get loading() { return loading; },
      get busy() { return busy; },
      /** Look ahead without navigating: peek(1) is the reel a forward swipe will show. */
      peek(offset = 1) { const p = (loading ? pos - 1 : pos) + offset; return p >= 0 ? reelAt(p) : null; },
      setEnabled(v) { enabled = !!v; },
      /** Instantly swap the current slide for the loading card (used by the review dock). */
      showLoading() {
        if (busy) return;
        loading = true;
        const el = makeSlide(LOADING);
        el.classList.add('is-current');
        current.replaceWith(el);
        current = el;
        if (o.onChange) o.onChange(LOADING, { pos, dir: 0, slide: current, initial: true });
      },
      /** Animate from the loading card to the first reel. */
      finishLoading() { return loading ? go(1) : Promise.resolve(false); },
      /** Instantly show the first reel at/after the current one that matches pred (no animation). */
      jump(pred) {
        if (busy) return false;
        let p = pos;
        while (!pred(reelAt(p)) && p - pos < 60) p++;
        pos = p;
        loading = false;
        const el = makeSlide(reelAt(pos));
        el.classList.add('is-current');
        current.replaceWith(el);
        current = el;
        if (o.onChange) o.onChange(reelAt(pos), { pos, dir: 0, slide: current, initial: true });
        return true;
      },
      /** Re-render the current slide in place (e.g. after a like). */
      rerender() { o.render(currentItem(), current); },
    };
  };

  /* ============================================================ REVIEW DOCK
   * Presentation-only control (not part of the app's UI), mounted only with ?review=1:
   * switch screens and motion. Desktop: fixed bottom-left card. Phone: slim edge tab. */
  S.STATES = [
    { id: 'onboarding', label: 'Первый запуск' },
    { id: 'first', label: 'Первая загрузка' },
    { id: 'feed', label: 'Лента' },
    { id: 'loading', label: 'Ожидание' },
    { id: 'pause', label: 'Пауза' },
    { id: 'pausechip', label: 'Пауза в ленте' },
    { id: 'comments', label: 'Комментарии' },
    { id: 'settings', label: 'Меню' },
    { id: 'error', label: 'Ошибка' },
    { id: 'done', label: 'Всё просмотрено' },
  ];
  S.review = {
    el: null,
    mount({ number, name, onSelect, current = 'onboarding' }) {
      if (!S.reviewMode) return this;
      const nav = document.createElement('nav');
      nav.className = 'rv';
      nav.setAttribute('aria-label', 'Экраны макета');
      nav.dataset.open = 'false';
      nav.innerHTML =
        `<button class="rv-tab" type="button" aria-expanded="false" aria-controls="rv-panel" title="Экраны макета"><span>${number}</span></button>` +
        `<div class="rv-panel" id="rv-panel">` +
        `<a class="rv-back" href="../index.html">← На сайт</a>` +
        `<p class="rv-title"><b>${number}</b>${esc(name)}</p>` +
        `<div class="rv-states" role="group" aria-label="Экран">` +
        S.STATES.map((s, i) => `<button type="button" data-state="${s.id}" aria-pressed="${s.id === current}"><kbd>${(i + 1) % 10}</kbd>${s.label}</button>`).join('') +
        `</div><div class="rv-row">` +
        `<button type="button" data-act="theme"></button><button type="button" data-act="motion"></button>` +
        `</div><p class="rv-hint">↑ ↓ · колесо · свайп — листать<br>двойной тап или L — лайк</p></div>`;
      document.body.append(nav);
      this.el = nav;
      const tab = nav.querySelector('.rv-tab');
      const setOpen = (v) => { nav.dataset.open = String(v); tab.setAttribute('aria-expanded', String(v)); };
      tab.addEventListener('click', () => setOpen(nav.dataset.open !== 'true'));
      nav.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.state) { onSelect(b.dataset.state); this.setActive(b.dataset.state); if (matchMedia('(max-width: 1099px)').matches) setOpen(false); }
        if (b.dataset.act === 'theme') S.theme.toggle();
        if (b.dataset.act === 'motion') S.setMotion(S.isReduced() ? 'full' : 'reduced');
        this.syncToggles();
      });
      document.addEventListener('keydown', (e) => {
        if (e.altKey || e.metaKey || e.ctrlKey) return;
        if (e.target.closest && e.target.closest('input, textarea, select')) return;
        const i = e.key === '0' ? 9 : Number(e.key) - 1;
        if (i >= 0 && i < S.STATES.length && !document.querySelector('dialog[open]')) { onSelect(S.STATES[i].id); this.setActive(S.STATES[i].id); }
      });
      document.addEventListener('shuffler:theme', () => this.syncToggles());
      document.addEventListener('shuffler:motion', () => this.syncToggles());
      this.syncToggles();
      return this;
    },
    setActive(id) {
      if (!this.el) return;
      this.el.querySelectorAll('[data-state]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.state === id)));
    },
    syncToggles() {
      if (!this.el) return;
      const t = this.el.querySelector('[data-act="theme"]');
      const m = this.el.querySelector('[data-act="motion"]');
      t.textContent = S.theme.effective === 'dark' ? '☾ Тёмная' : '☀ Светлая';
      m.textContent = S.isReduced() ? '◌ Меньше движения' : '◉ Полное движение';
      m.setAttribute('aria-pressed', String(S.isReduced()));
    },
  };

  /** Initial screen from ?state=… (onboarding by default). */
  S.initialState = () => {
    const s = S.params.get('state');
    return S.STATES.some((x) => x.id === s) ? s : 'onboarding';
  };
})();
