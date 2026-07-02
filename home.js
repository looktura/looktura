// home.js — LOOKTURA landing orchestration
// Lenis smooth scroll + GSAP ScrollTrigger pin/scrub driving the phone ring,
// synced captions + dots, nav, FAQ, waitlist, scroll reveals.
// Graceful fallback when reduced-motion is set or WebGL is unavailable.

import { createPhoneCarousel } from './phone.js?v=110';

const SCREENS = [
  { url: 'assets/screens/swipe.jpg',   focus: 'center', t: 'Каталог или Лента',   s: 'Свайпай или листай, как удобно' },
  { url: 'assets/screens/matches.jpg', focus: 'center', t: 'Твои мэтчи',           s: 'Всё, что зацепило, в одном месте' },
  { url: 'assets/screens/booking.jpg', focus: 'center', t: 'Бронь товара',         s: 'Бронируешь примерку прямо из карточки' },
  { url: 'assets/screens/catalog.jpg', focus: 'center', t: 'Каталог товаров',      s: 'Весь ассортимент магазина под рукой' },
  { url: 'assets/screens/route.jpg',   focus: 'center', t: 'Построение маршрута',  s: 'Шопинг-тур по нескольким бутикам', glow: true },
  { url: 'assets/screens/home.jpg',    focus: 'center', t: 'Всё в одном экране',   s: 'Лента, мэтчи, брони и маршруты' },
];

// 7th stop: the first phone re-skins to wishlists while it is turned away,
// so finishing the scroll reveals a new screen instead of repeating screen 1.
const WISHLISTS = { url: 'assets/screens/wishlists.jpg', focus: 'center', t: 'Вишлисты', s: 'Собирай и делись с друзьями' };
const CAPS = [...SCREENS.map((s) => ({ t: s.t, s: s.s, glow: s.glow })), { t: WISHLISTS.t, s: WISHLISTS.s }];

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasWebGL = (() => {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
})();

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

/* ---------------------------------------------------------------- nav */
function initNav() {
  const nav = $('#nav');
  const burger = $('#burger');
  const menu = $('#menu');
  let open = false;
  nav.classList.add('is-hidden');           // stay hidden until scrolled past the hero

  burger.addEventListener('click', () => {
    open = !open;
    menu.classList.toggle('open', open);
    nav.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
    if (window.__lenis) open ? window.__lenis.stop() : window.__lenis.start();
  });
  $$('#menu a').forEach((a) => a.addEventListener('click', () => {
    open = false; menu.classList.remove('open'); nav.classList.remove('menu-open');
    burger.setAttribute('aria-expanded', 'false'); document.body.style.overflow = '';
    if (window.__lenis) window.__lenis.start();
  }));

  return (y) => {
    if (open) return;
    const st = window.__heroST;
    const heroEnd = (st && st.end) ? st.end : window.innerHeight;
    nav.classList.toggle('is-hidden', y < heroEnd - 40);   // shows only below the hero
  };
}

/* --------------------------------------------------------------- faq */
function initFaq() {
  $$('.faq__item').forEach((item) => {
    const q = $('.faq__q', item);
    q.addEventListener('click', () => {
      const isOpen = item.classList.toggle('open');
      q.setAttribute('aria-expanded', String(isOpen));
    });
  });
}

/* ----------------------------------------------------------- waitlist */
function initWaitlist() {
  const form = $('#waitlist');
  if (!form) return;
  const input = $('#email', form);
  const msg = $('#waitMsg', form);
  const cfg = window.LK_CONFIG || {};
  const valid = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = input.value.trim();
    msg.classList.remove('err');
    if (!valid(email)) { msg.textContent = 'Похоже, в почте опечатка — проверь ещё раз.'; msg.classList.add('err'); input.focus(); return; }
    if (cfg.endpoint) {
      try {
        msg.textContent = 'Отправляем…';
        const r = await fetch(cfg.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
        if (!r.ok) throw new Error('bad');
        msg.textContent = 'Готово! Напишем за пару недель до старта.';
        form.reset();
      } catch (_) {
        msg.textContent = 'Не получилось отправить. Напишем вручную — открываем почту…';
        location.href = `mailto:${cfg.email}?subject=Ранний доступ LOOKTURA&body=Запишите меня: ${encodeURIComponent(email)}`;
      }
    } else {
      msg.textContent = 'Готово! Открываем почту, чтобы подтвердить.';
      location.href = `mailto:${cfg.email}?subject=Ранний доступ LOOKTURA&body=Запишите меня в ранний доступ: ${encodeURIComponent(email)}`;
      form.reset();
    }
  });
}

/* ------------------------------------------------------------ reveals */
function initReveals() {
  const els = $$('.rv');
  if (reduce || !('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
  els.forEach((e) => io.observe(e));
}

/* ------------------------------------------------------- caption/dots */
function initCaptionDots() {
  const cap = $('#ringCap');
  const capT = $('#ringCapT');
  const capS = $('#ringCapS');
  const dotsWrap = $('#ringDots');
  const pin = $('#heroPin');
  CAPS.forEach(() => dotsWrap.appendChild(document.createElement('span')));
  const dots = $$('span', dotsWrap);
  let cur = -1, to;

  function set(i) {
    if (i === cur) return;
    cur = i;
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
    const glow = !!CAPS[i].glow;               // route screen gets the iridescent highlight
    cap.classList.toggle('route', glow);
    if (pin) pin.classList.toggle('route-on', glow);
    cap.classList.remove('show');
    clearTimeout(to);
    to = setTimeout(() => { capT.textContent = CAPS[i].t; capS.textContent = CAPS[i].s; cap.classList.add('show'); }, 150);
  }
  // first paint immediately
  capT.textContent = CAPS[0].t; capS.textContent = CAPS[0].s;
  requestAnimationFrame(() => cap.classList.add('show'));
  cur = 0; dots[0].classList.add('on');
  return set;
}

/* --------------------------------------------------------------- 3D */
async function init3D() {
  const ring = $('#ring');
  const setCap = initCaptionDots();
  const car = createPhoneCarousel(ring, { screens: SCREENS, reducedMotion: reduce });
  window.__car = car;

  if (!reduce) {
    window.addEventListener('pointermove', (e) =>
      car.setMouse((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1), { passive: true });
  }

  // Lenis + GSAP
  const gsap = window.gsap;
  const ST = window.ScrollTrigger;
  let onScrollNav;

  if (window.Lenis && gsap && ST && !reduce) {
    gsap.registerPlugin(ST);
    const lenis = new Lenis({ lerp: 0.11, smoothWheel: true, wheelMultiplier: 1 });
    window.__lenis = lenis;
    lenis.on('scroll', ST.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);

    onScrollNav = initNav();
    lenis.on('scroll', ({ scroll }) => onScrollNav(scroll));

    const N = SCREENS.length;             // 6 phones / full 360° turn
    let wlTex = null, swTex = null, slot0WL = false;
    window.__heroST = ST.create({
      trigger: '#heroPin', start: 'top top', end: '+=320%',
      pin: true, pinSpacing: true, scrub: true, invalidateOnRefresh: true,
      onUpdate: (self) => {
        const p = self.progress;
        car.setProgress(p);
        // 7 stops: the 6 screens, then the first phone returns re-skinned as wishlists
        setCap(Math.max(0, Math.min(Math.round(p * N), CAPS.length - 1)));
        // swap the first phone to wishlists while it is turned away (back of the ring)
        const wantWL = p > 0.5;
        if (wlTex && wantWL !== slot0WL) { car.setSlotMap(0, wantWL ? wlTex : swTex); slot0WL = wantWL; }
      },
    });

    // ---- magnetic snap ------------------------------------------------------
    // Once a scroll settles inside the pinned hero, gently ease the ring to the
    // nearest phone so it's easy to stop with a screen dead-on. Driven through
    // Lenis (not ScrollTrigger.snap) so it never fights the smooth scroll.
    {
      const easeOut = (x) => 1 - Math.pow(1 - x, 3);
      let snapTimer, snapTarget = null;
      const trySnap = () => {
        const st = window.__heroST;
        if (!st) return;
        const cur = (lenis.scroll ?? window.scrollY);
        if (cur < st.start - 2 || cur > st.end + 2) { snapTarget = null; return; }  // only within the pinned hero
        const span = st.end - st.start;
        if (span <= 0) return;
        const step = span / N;
        const target = st.start + Math.round((cur - st.start) / step) * step;
        const dist = Math.abs(target - cur);
        if (dist < 2) { snapTarget = null; return; }                     // already resting on a phone
        if (target === snapTarget) return;                               // already easing to this phone
        snapTarget = target;
        // scale the glide with distance so a mid-position correction reads as a clear magnetic pull
        const dur = 0.3 + 0.4 * Math.min(1, dist / (step / 2));
        lenis.scrollTo(target, { duration: dur, easing: easeOut, force: true, lock: true });
      };
      // fire promptly once the scroll pauses (debounced), so it never fights an active swipe
      lenis.on('scroll', () => { clearTimeout(snapTimer); snapTimer = setTimeout(trySnap, 45); });
    }

    initAnchors(lenis);
    car.ready.then(async () => {
      swTex = car.screenTexture(0);
      wlTex = await car.loadTexture(WISHLISTS.url, WISHLISTS.focus);
      ST.refresh();
    });
  } else {
    // reduced motion: no pin/scrub, ring stays on first screen, native scroll
    onScrollNav = initNav();
    window.addEventListener('scroll', () => onScrollNav(window.scrollY), { passive: true });
    initAnchors(null);
  }
}

/* --------------------------------------------------- fallback (no WebGL) */
function initFallback() {
  document.documentElement.classList.add('no-webgl');
  const ring = $('#ring');
  ring.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'fallgrid';
  [...SCREENS, WISHLISTS].forEach((s) => {
    const fig = document.createElement('figure');
    fig.className = 'fallphone';
    const img = document.createElement('img');
    img.src = s.url; img.alt = s.t; img.loading = 'lazy';
    fig.appendChild(img);
    grid.appendChild(fig);
  });
  ring.appendChild(grid);
  $('#hero').style.height = 'auto';
  $('#heroPin').style.height = 'auto';
  $('#heroPin').style.minHeight = '100vh';
  $('#ringCap').style.display = 'none';
  $('#ringDots').style.display = 'none';

  const onScrollNav = initNav();
  window.addEventListener('scroll', () => onScrollNav(window.scrollY), { passive: true });
  initAnchors(null);
}

/* ----------------------------------------------------------- anchors */
function initAnchors(lenis) {
  $$('a[data-link]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (!id || !id.startsWith('#')) return;
      const el = $(id);
      if (!el) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(el, { offset: -8, duration: 1.1 });
      else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    });
  });
}

/* --------------------------------------------------------------- boot */
function boot() {
  initFaq();
  initWaitlist();
  initReveals();
  if (hasWebGL) init3D(); else initFallback();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
