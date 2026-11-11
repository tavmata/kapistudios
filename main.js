/**
 * Kapi Studios — interaction layer, storm effects (lightning, loot chests) and the live
 * procedural monster and character engines
 */
import {
  createMonster,
  updateMonster,
  drawMonster,
  triggerMonsterAttack,
} from './assets/js/monster-renderer.js';
import {
  CHARACTER_PRESETS,
  CharacterController,
} from './assets/js/character-renderer.js';

(function kapi() {
  'use strict';

  const doc = document.documentElement;
  const body = document.body;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  // -------------------------------------------------------------------------
  // Spring primitive + one shared animation loop
  // -------------------------------------------------------------------------
  function createSpring(stiffness, damping) {
    return {
      x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0,
      step() {
        this.vx = (this.vx + (this.tx - this.x) * stiffness) * damping;
        this.vy = (this.vy + (this.ty - this.y) * stiffness) * damping;
        this.x += this.vx;
        this.y += this.vy;
      },
      settled() {
        return Math.abs(this.tx - this.x) < 0.05 && Math.abs(this.ty - this.y) < 0.05 &&
          Math.abs(this.vx) < 0.05 && Math.abs(this.vy) < 0.05;
      },
    };
  }

  const tickers = new Set();
  function loop() {
    tickers.forEach((fn) => fn());
    requestAnimationFrame(loop);
  }
  if (!reduced) requestAnimationFrame(loop);

  // -------------------------------------------------------------------------
  // 1. Page-load curtain
  // -------------------------------------------------------------------------
  const loaderCount = document.querySelector('.loader-count');
  const loaderBar = document.querySelector('.loader-bar i');
  const loadedQueue = [];
  let isLoaded = false;
  function finishLoading() {
    body.classList.add('is-loaded');
    isLoaded = true;
    loadedQueue.splice(0).forEach((fn) => fn());
  }
  function whenLoaded(fn) { if (isLoaded) fn(); else loadedQueue.push(fn); }

  if (reduced) {
    finishLoading();
  } else {
    const start = performance.now();
    const duration = 650;
    const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    let fontsDone = false;
    fontsReady.then(() => { fontsDone = true; });
    setTimeout(() => { fontsDone = true; }, 1800);

    (function count(now) {
      const t = clamp((now - start) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      if (loaderCount) loaderCount.textContent = String(Math.round(eased * 100));
      if (loaderBar) loaderBar.style.setProperty('--p', eased.toFixed(3));
      if (t < 1 || !fontsDone) requestAnimationFrame(count);
      else setTimeout(finishLoading, 80);
    })(start);
  }

  // -------------------------------------------------------------------------
  // 2. Button label roll (duplicate text slides up on hover)
  // -------------------------------------------------------------------------
  document.querySelectorAll('.btn-text').forEach((label) => {
    const roll = document.createElement('span');
    roll.className = 'roll';
    roll.textContent = label.textContent.trim();
    label.textContent = '';
    label.appendChild(roll);
  });

  // -------------------------------------------------------------------------
  // 3. Fluid cursor (spring ring, contextual states)
  // -------------------------------------------------------------------------
  const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2, nx: 0, ny: 0 };
  window.addEventListener('pointermove', (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.nx = e.clientX / window.innerWidth - 0.5;
    pointer.ny = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });

  const cursor = document.querySelector('.cursor');
  if (cursor && finePointer && !reduced) {
    doc.classList.add('has-cursor');
    const dot = cursor.querySelector('.cursor-dot');
    const ring = cursor.querySelector('.cursor-ring');
    const label = cursor.querySelector('.cursor-label');
    const ringSpring = createSpring(0.16, 0.7);
    const labels = { play: 'assistir', open: 'abrir' };
    ringSpring.x = ringSpring.tx = pointer.x;
    ringSpring.y = ringSpring.ty = pointer.y;

    tickers.add(() => {
      ringSpring.tx = pointer.x;
      ringSpring.ty = pointer.y;
      ringSpring.step();
      dot.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0)`;
      const speed = Math.min(Math.hypot(ringSpring.vx, ringSpring.vy), 40);
      const angle = Math.atan2(ringSpring.vy, ringSpring.vx);
      const stretch = 1 + speed / 120;
      ring.style.transform =
        `translate3d(${ringSpring.x}px, ${ringSpring.y}px, 0) rotate(${angle}rad) scale(${stretch}, ${1 / stretch}) rotate(${-angle}rad)`;
    });

    document.addEventListener('pointerover', (e) => {
      const target = e.target.closest('[data-cursor], a, button');
      const state = target ? (target.dataset.cursor || 'link') : '';
      cursor.dataset.state = state;
      label.textContent = labels[state] || '';
    });
    document.addEventListener('pointerdown', () => cursor.classList.add('is-down'));
    document.addEventListener('pointerup', () => cursor.classList.remove('is-down'));
    document.addEventListener('mouseleave', () => cursor.classList.add('is-hidden'));
    document.addEventListener('mouseenter', () => cursor.classList.remove('is-hidden'));
  }

  // -------------------------------------------------------------------------
  // 4. Magnetic controls (spring back to rest)
  // -------------------------------------------------------------------------
  if (finePointer && !reduced) {
    document.querySelectorAll('.magnetic').forEach((el) => {
      const s = createSpring(0.14, 0.68);
      let active = false;
      const pull = 0.3;

      function tick() {
        s.step();
        el.style.transform = `translate3d(${s.x}px, ${s.y}px, 0)`;
        if (!active && s.settled()) {
          el.style.transform = '';
          tickers.delete(tick);
        }
      }
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        s.tx = (e.clientX - (r.left + r.width / 2)) * pull;
        s.ty = (e.clientY - (r.top + r.height / 2)) * pull;
        active = true;
        tickers.add(tick);
      });
      el.addEventListener('pointerleave', () => {
        active = false;
        s.tx = 0;
        s.ty = 0;
      });
    });
  }

  // -------------------------------------------------------------------------
  // 5. Header: hide on the way down, return on the way up + scroll-spy
  // -------------------------------------------------------------------------
  const header = document.getElementById('site-header');
  const navToggle = document.getElementById('nav-toggle');
  const mainNav = document.getElementById('main-nav');
  const navLinks = document.querySelectorAll('.main-nav .nav-link[href^="#"]');
  let lastY = window.scrollY;
  let scrollVelocity = 0;

  function onScroll() {
    const y = window.scrollY;
    const delta = y - lastY;
    scrollVelocity = delta;
    if (header && !(mainNav && mainNav.classList.contains('is-open'))) {
      if (y > 160 && delta > 4) header.classList.add('is-hidden');
      else if (delta < -4 || y < 160) header.classList.remove('is-hidden');
    }
    lastY = y;
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  function setNav(open) {
    if (!navToggle || !mainNav) return;
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Fechar o menu' : 'Abrir o menu');
    mainNav.classList.toggle('is-open', open);
    body.style.overflow = open ? 'hidden' : '';
  }
  if (navToggle && mainNav) {
    navToggle.addEventListener('click', () => setNav(navToggle.getAttribute('aria-expanded') !== 'true'));
    mainNav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setNav(false)));
  }

  const sections = document.querySelectorAll('main section[id]');
  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = entry.target.id;
        navLinks.forEach((link) => link.classList.toggle('is-active', link.getAttribute('href') === `#${id}`));
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    sections.forEach((s) => spy.observe(s));
  }

  // -------------------------------------------------------------------------
  // 6. Staggered scroll reveals
  // -------------------------------------------------------------------------
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduced) {
    const revealer = new IntersectionObserver((entries) => {
      entries
        .filter((e) => e.isIntersecting)
        .forEach((entry, i) => {
          entry.target.style.setProperty('--d', `${i * 0.08}s`);
          entry.target.classList.add('is-visible');
          revealer.unobserve(entry.target);
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    reveals.forEach((el) => revealer.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-visible'));
  }

  // -------------------------------------------------------------------------
  // 7. Manifesto: words ink in as you read
  // -------------------------------------------------------------------------
  const manifesto = document.querySelector('.scrub');
  if (manifesto && !reduced) {
    const words = [];
    Array.from(manifesto.childNodes).forEach((node) => {
      if (node.nodeType !== Node.TEXT_NODE || !node.textContent.trim()) return;
      const frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
        const span = document.createElement('span');
        span.className = 'w';
        span.textContent = part;
        words.push(span);
        frag.appendChild(span);
      });
      node.replaceWith(frag);
    });

    let lastLit = -1;
    tickers.add(() => {
      const r = manifesto.getBoundingClientRect();
      const vh = window.innerHeight;
      if (r.bottom < -100 || r.top > vh + 100) return;
      const progress = clamp((vh * 0.82 - r.top) / (r.height + vh * 0.3), 0, 1);
      const lit = progress * (words.length + 3);
      if (Math.abs(lit - lastLit) < 0.02) return;
      lastLit = lit;
      words.forEach((w, i) => { w.style.opacity = String(clamp(lit - i, 0.16, 1)); });
    });
  }

  // -------------------------------------------------------------------------
  // 8. Hero depth: pointer parallax + scroll drift, marquee skew by velocity
  // -------------------------------------------------------------------------
  const depthLayers = Array.from(document.querySelectorAll('.hero [data-depth]')).map((el) => ({
    el, depth: parseFloat(el.dataset.depth) || 1, s: createSpring(0.06, 0.82),
  }));
  const hero = document.querySelector('.hero');
  const marquee = document.querySelector('.marquee');
  const skew = createSpring(0.1, 0.75);

  if (!reduced) {
    tickers.add(() => {
      const inHero = hero && window.scrollY < hero.offsetHeight;
      if (inHero) {
        const allowPointer = finePointer;
        depthLayers.forEach((l) => {
          l.s.tx = allowPointer ? pointer.nx * -18 * l.depth : 0;
          l.s.ty = (allowPointer ? pointer.ny * -12 * l.depth : 0) - window.scrollY * 0.05 * l.depth;
          l.s.step();
          l.el.style.transform = `translate3d(${l.s.x.toFixed(2)}px, ${l.s.y.toFixed(2)}px, 0)`;
        });
      }

      if (marquee) {
        skew.tx = clamp(scrollVelocity * -0.35, -10, 10);
        scrollVelocity *= 0.85;
        skew.step();
        marquee.style.setProperty('--skew', `${skew.x.toFixed(2)}deg`);
      }
    });
  }

  // -------------------------------------------------------------------------
  // 9. Editorial index: image follows the cursor with momentum
  // -------------------------------------------------------------------------
  const indexList = document.querySelector('.index-list');
  const preview = document.querySelector('.index-preview');
  const previewCanvas = document.getElementById('index-preview-canvas');
  let activePreviewIdx = 0;
  const previewActors = [
    { kind: 'monster', ent: createMonster('boss_samba_king', { facingAngle: Math.PI / 2, moving: true, showAttackZone: false }), scale: 2.35, yOff: 18 },
    { kind: 'monster', ent: createMonster('fire_salamander', { facingAngle: 0.72, moving: true, showAttackZone: false }), scale: 2.1, yOff: 8 },
    { kind: 'hero', ctrl: new CharacterController(CHARACTER_PRESETS.find((p) => p.id === 'prismatic_rainbow_archmage')), scale: 4.5, yOff: 18 },
    { kind: 'hero', ctrl: new CharacterController(CHARACTER_PRESETS.find((p) => p.id === 'sun_paladin')), scale: 4.5, yOff: 18 },
    { kind: 'monster', ent: createMonster('boss_wolf', { facingAngle: 0.72, moving: true, showAttackZone: false }), scale: 1.95, yOff: 6 },
    { kind: 'monster', ent: createMonster('boss_goblin_chieftain', { facingAngle: Math.PI / 2, moving: true, showAttackZone: false }), scale: 2.4, yOff: 18 },
  ];

  function renderPreviewCanvas(dt) {
    if (!previewCanvas) return;
    const ctx = previewCanvas.getContext('2d');
    if (!ctx) return;
    const w = previewCanvas.width;
    const h = previewCanvas.height;
    ctx.clearRect(0, 0, w, h);
    const actor = previewActors[activePreviewIdx] || previewActors[0];
    ctx.save();
    ctx.translate(w / 2, h / 2 + (actor.yOff || 0));
    if (actor.kind === 'monster') {
      actor.ent.x = 0;
      actor.ent.y = 0;
      updateMonster(actor.ent, dt, { autoFace: false });
      ctx.scale(actor.scale, actor.scale);
      drawMonster(ctx, 0, 0, actor.ent);
    } else if (actor.kind === 'hero') {
      actor.ctrl.update(dt);
      actor.ctrl.draw(ctx, 0, 0, actor.scale);
    }
    ctx.restore();
  }
  renderPreviewCanvas(0.016);

  if (indexList && preview && finePointer) {
    const ps = createSpring(0.09, 0.76);
    let hovering = false;
    ps.x = ps.tx = pointer.x;
    ps.y = ps.ty = pointer.y;

    function show(i) {
      activePreviewIdx = clamp(i || 0, 0, previewActors.length - 1);
      const actor = previewActors[activePreviewIdx];
      if (actor && actor.kind === 'hero') actor.ctrl.triggerAttack();
      else if (actor && actor.kind === 'monster') {
        actor.ent.x = 0;
        actor.ent.y = 0;
        triggerMonsterAttack(actor.ent, 'strike', 900);
      }
      renderPreviewCanvas(0.016);
    }

    indexList.querySelectorAll('.index-row').forEach((row) => {
      row.addEventListener('pointerenter', () => {
        hovering = true;
        preview.classList.add('is-active');
        show(parseInt(row.dataset.preview, 10));
      });
    });
    indexList.addEventListener('pointerleave', () => {
      hovering = false;
      preview.classList.remove('is-active');
    });

    tickers.add(() => {
      if (hovering) renderPreviewCanvas(0.016);
      if (!hovering && ps.settled()) return;
      ps.tx = pointer.x;
      ps.ty = pointer.y;
      ps.step();
      const tilt = clamp(ps.vx * 0.6, -14, 14);
      preview.style.transform = `translate3d(${ps.x}px, ${ps.y}px, 0) rotate(${tilt}deg)`;
    });
  }

  // -------------------------------------------------------------------------
  // 10. Class switcher (accessible tabs, accent colour morph)
  // -------------------------------------------------------------------------
  const classesSection = document.getElementById('classes');
  const tabs = Array.from(document.querySelectorAll('.class-tab'));
  function activateTab(tab, focus) {
    if (!tab || tab.classList.contains('is-active')) { if (focus && tab) tab.focus(); return; }
    tabs.forEach((t) => {
      const on = t === tab;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(t.getAttribute('aria-controls'));
      if (!panel) return;
      panel.classList.remove('is-active');
      panel.hidden = !on;
      if (on) { void panel.offsetWidth; panel.classList.add('is-active'); }
    });
    if (classesSection) classesSection.style.setProperty('--accent', tab.dataset.accent);
    if (focus) tab.focus();
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => activateTab(tab));
    if (finePointer) {
      let intent;
      tab.addEventListener('pointerenter', () => { intent = setTimeout(() => activateTab(tab), 140); });
      tab.addEventListener('pointerleave', () => clearTimeout(intent));
    }
    tab.addEventListener('keydown', (e) => {
      const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
      if (e.key in keys) {
        e.preventDefault();
        activateTab(tabs[(i + keys[e.key] + tabs.length) % tabs.length], true);
      } else if (e.key === 'Home') { e.preventDefault(); activateTab(tabs[0], true); }
      else if (e.key === 'End') { e.preventDefault(); activateTab(tabs[tabs.length - 1], true); }
    });
  });

  // -------------------------------------------------------------------------
  // 12. Living clock (Brasília time, with a mood)
  // -------------------------------------------------------------------------
  const clockTime = document.getElementById('clock-time');
  const clockMood = document.getElementById('clock-mood');
  function moodFor(h) {
    if (h < 5) return 'madrugada de farm';
    if (h < 12) return 'manhã de missão';
    if (h < 18) return 'tarde de masmorra';
    return 'noite de chefe';
  }
  function tickClock() {
    if (!clockTime) return;
    try {
      const parts = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' }).formatToParts(new Date());
      const h = parts.find((p) => p.type === 'hour').value;
      const m = parts.find((p) => p.type === 'minute').value;
      clockTime.textContent = `${h}:${m}`;
      if (clockMood) clockMood.textContent = moodFor(parseInt(h, 10) % 24);
    } catch (_) {
      const d = new Date();
      clockTime.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
  }
  tickClock();
  setInterval(tickClock, 30000);

  // -------------------------------------------------------------------------
  // 13. Storm sparks (charged motes rising, paused off-screen)
  // -------------------------------------------------------------------------
  document.querySelectorAll('.sparks').forEach((canvas) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let visible = true;
    function resize() {
      w = canvas.offsetWidth;
      h = canvas.offsetHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    const palette = [[255, 214, 10], [76, 201, 255], [190, 215, 255], [76, 201, 255]];
    const flies = Array.from({ length: parseInt(canvas.dataset.count || '24', 10) }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.3 + 0.6,
      c: palette[Math.floor(Math.random() * palette.length)],
      vx: (Math.random() - 0.5) * 0.4,
      vy: -Math.random() * 0.7 - 0.2,
      p: Math.random() * Math.PI * 2,
      ps: Math.random() * 0.05 + 0.02,
      a: Math.random() * 0.6 + 0.3,
    }));

    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; }).observe(canvas);
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      flies.forEach((f) => {
        if (!reduced) {
          f.p += f.ps;
          f.x += f.vx + Math.sin(f.p * 0.7) * 0.15;
          f.y += f.vy;
        }
        if (f.x < -20) f.x = w + 20;
        if (f.x > w + 20) f.x = -20;
        if (f.y < -20) f.y = h + 20;
        const alpha = Math.max(0.05, Math.sin(f.p) * f.a);
        const [r, g, b] = f.c;
        const glow = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 7);
        glow.addColorStop(0, `rgba(${r},${g},${b},${alpha * 0.7})`);
        glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(245, 250, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    if (reduced) draw();
    else tickers.add(() => { if (visible) draw(); });
  });

  // -------------------------------------------------------------------------
  // 14. Trailer modal (focus managed)
  // -------------------------------------------------------------------------
  const modal = document.getElementById('trailer-modal');
  const modalVideo = document.getElementById('modal-video');
  const closeBtn = document.getElementById('trailer-close');
  const backdrop = document.getElementById('trailer-backdrop');
  let lastTrigger = null;

  function openTrailer(e) {
    if (!modal) return;
    lastTrigger = e ? e.currentTarget : document.activeElement;
    modal.classList.add('is-active');
    modal.setAttribute('aria-hidden', 'false');
    body.style.overflow = 'hidden';
    if (closeBtn) closeBtn.focus();
    if (modalVideo) {
      modalVideo.currentTime = 0;
      modalVideo.play().catch(() => {});
    }
  }
  function closeTrailer() {
    if (!modal || !modal.classList.contains('is-active')) return;
    modal.classList.remove('is-active');
    modal.setAttribute('aria-hidden', 'true');
    body.style.overflow = '';
    if (modalVideo) modalVideo.pause();
    if (lastTrigger && lastTrigger.focus) lastTrigger.focus();
  }
  ['btn-open-trailer', 'btn-world-trailer', 'btn-inline-trailer'].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', openTrailer);
  });
  if (closeBtn) closeBtn.addEventListener('click', closeTrailer);
  if (backdrop) backdrop.addEventListener('click', closeTrailer);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeTrailer(); setNav(false); }
    if (e.key === 'Tab' && modal && modal.classList.contains('is-active')) {
      const focusables = modal.querySelectorAll('a, button, video[controls]');
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // -------------------------------------------------------------------------
  // 15. Field notes: screenshot pins and legend light each other up
  // -------------------------------------------------------------------------
  const shot = document.getElementById('shot-frame');
  if (shot) {
    const pins = Array.from(shot.querySelectorAll('.pin'));
    const legendItems = Array.from(document.querySelectorAll('.legend-list li'));
    let cycleIndex = -1;
    let cycleTimer = null;
    let userPointing = false;

    function highlight(id) {
      pins.forEach((p) => p.classList.toggle('is-active', p.dataset.pin === id));
      legendItems.forEach((l) => l.classList.toggle('is-active', l.dataset.pin === id));
    }
    function cycle() {
      if (userPointing || !pins.length) return;
      cycleIndex = (cycleIndex + 1) % pins.length;
      highlight(pins[cycleIndex].dataset.pin);
    }
    function startCycle() {
      if (cycleTimer || reduced) return;
      cycle();
      cycleTimer = setInterval(cycle, 2600);
    }
    function stopCycle() {
      clearInterval(cycleTimer);
      cycleTimer = null;
    }

    pins.concat(legendItems).forEach((el) => {
      el.addEventListener('pointerenter', () => { userPointing = true; highlight(el.dataset.pin); });
      el.addEventListener('pointerleave', () => { userPointing = false; });
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) startCycle();
        else { stopCycle(); highlight(null); }
      }, { threshold: 0.35 }).observe(shot);
    }
  }

  // -------------------------------------------------------------------------
  // 16. Live Procedural Monster & Character Canvases
  // -------------------------------------------------------------------------
  // 16a. Hero Boss Dragon Canvas
  const heroDragonCanvas = document.getElementById('hero-dragon-canvas');
  if (heroDragonCanvas) {
    const hCtx = heroDragonCanvas.getContext('2d');
    const heroDragon = createMonster('boss_dragon', {
      x: 0,
      y: 0,
      facingAngle: 0.86,
      moving: true,
      isFlying: true,
      showAttackZone: false,
    });
    let heroVisible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        heroVisible = entries[0].isIntersecting;
      }).observe(heroDragonCanvas);
    }
    function drawHeroDragon(dt) {
      if (!hCtx) return;
      const w = heroDragonCanvas.width;
      const h = heroDragonCanvas.height;
      hCtx.clearRect(0, 0, w, h);
      heroDragon.x = 0;
      heroDragon.y = 0;
      const targetAngle = 0.86 + pointer.nx * 0.28 + pointer.ny * 0.16;
      heroDragon.facingAngle += (targetAngle - heroDragon.facingAngle) * 0.08;
      updateMonster(heroDragon, dt, { autoFace: false });
      hCtx.save();
      hCtx.translate(w * 0.48, h * 0.47);
      hCtx.scale(1.22, 1.22);
      drawMonster(hCtx, 0, 0, heroDragon);
      hCtx.restore();
    }
    drawHeroDragon(0.016);
    tickers.add(() => { if (heroVisible) drawHeroDragon(0.016); });

    const triggerHeroBreath = () => {
      heroDragon.dragonAttackType = 'breath';
      triggerMonsterAttack(heroDragon, 'breath', 1500);
      if (reduced) drawHeroDragon(0.35);
    };
    ['hero-dragon-wrap', 'hero-boss-chip'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('click', triggerHeroBreath);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); triggerHeroBreath(); }
      });
    });
  }

  // 16b. Bestiary Monster Canvases
  const SCALE_BY_VARIANT = {
    boss_dragon: 1.18,
    fire_drake: 1.55,
    frost_wyrm: 1.48,
    void_drake: 1.48,
    emerald_drake: 1.55,
    boss_wolf: 1.85,
    dire_wolf: 2.05,
    arctic_wolf: 2.1,
    frost_troll: 2.15,
    boss_frost_giant: 1.25,
    frost_tempest: 1.85,
    boss_goblin_chieftain: 2.15,
    goblin_warrior: 2.5,
    boss_goblin_king: 1.75,
    boss_samba_king: 2.05,
    elite_knight: 2.35,
    skeleton: 2.45,
    fire_salamander: 1.85,
    salamander_frost: 1.85,
    salamander_void: 1.85,
    boss_void_terror: 1.08,
    boss_slime: 1.55,
    spider_broodmother: 1.45,
  };

  document.querySelectorAll('.beast-canvas').forEach((canvas) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const card = canvas.closest('.beast');
    const baseAngle = parseFloat(canvas.dataset.angle || '1.5708');
    const defaultAtk = canvas.dataset.attack || 'strike';
    let curScale = parseFloat(canvas.dataset.scale || '1.6');
    const isFlying = canvas.dataset.flying === 'true';

    const ent = createMonster(canvas.dataset.monster || 'boss_dragon', {
      x: 0,
      y: 0,
      facingAngle: baseAngle,
      moving: true,
      isFlying,
      showAttackZone: false,
    });

    let visible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting;
      }).observe(canvas);
    }

    function renderBeast(dt) {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ent.x = 0;
      ent.y = 0;
      updateMonster(ent, dt, { autoFace: false });
      ctx.save();
      const yCenter = ent.type.includes('goblin') || ent.type.includes('samba') || ent.type.includes('skeleton') || ent.type.includes('knight')
        ? h * 0.56
        : h * 0.51;
      ctx.translate(w * 0.5, yCenter);
      ctx.scale(curScale, curScale);
      drawMonster(ctx, 0, 0, ent);
      ctx.restore();
    }
    renderBeast(0.08);
    tickers.add(() => { if (visible) renderBeast(0.016); });

    function doAttack(mode) {
      const atk = mode || defaultAtk;
      ent.dragonAttackType = atk;
      triggerMonsterAttack(ent, atk, 1350);
      if (reduced) renderBeast(0.35);
    }

    const artBox = canvas.closest('.beast-art');
    if (artBox) {
      artBox.addEventListener('click', () => doAttack());
      artBox.addEventListener('pointerenter', () => {
        if (!ent.isAttacking) doAttack();
      });
    }

    if (card) {
      card.querySelectorAll('[data-variant]').forEach((btn) => {
        btn.addEventListener('click', () => {
          card.querySelectorAll('[data-variant]').forEach((b) => b.classList.toggle('is-active', b === btn));
          const v = btn.dataset.variant;
          ent.type = v;
          ent.isFlying = v.includes('dragon') || v.includes('drake') || v.includes('wyrm');
          curScale = SCALE_BY_VARIANT[v] || curScale;
          if (btn.dataset.glow) card.style.setProperty('--glow', btn.dataset.glow);
          doAttack();
        });
      });
      card.querySelectorAll('[data-trigger-attack]').forEach((btn) => {
        btn.addEventListener('click', () => doAttack(btn.dataset.triggerAttack));
      });
    }
  });

  // 16c. Class Hero Canvases (CharacterController + CHARACTER_PRESETS)
  document.querySelectorAll('.hero-canvas').forEach((canvas) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const panel = canvas.closest('.class-panel');
    const presetId = canvas.dataset.preset || 'sun_paladin';
    const initialPreset = CHARACTER_PRESETS.find((p) => p.id === presetId) || CHARACTER_PRESETS[0];
    const heroCtrl = new CharacterController(initialPreset);

    let visible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting;
      }).observe(canvas);
    }

    function renderHero(dt) {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      heroCtrl.update(dt);
      heroCtrl.draw(ctx, w * 0.5, h * 0.54, 5.4);
    }
    renderHero(0.016);
    tickers.add(() => {
      if (visible && (!panel || !panel.hidden)) renderHero(0.016);
    });

    canvas.addEventListener('click', () => {
      heroCtrl.triggerAttack();
      if (reduced) renderHero(0.2);
    });

    if (panel) {
      panel.querySelectorAll('[data-hero-preset]').forEach((btn) => {
        btn.addEventListener('click', () => {
          panel.querySelectorAll('[data-hero-preset]').forEach((b) => b.classList.toggle('is-active', b === btn));
          heroCtrl.setPreset(btn.dataset.heroPreset);
          heroCtrl.triggerAttack();
          renderHero(0.05);
        });
      });
      panel.querySelectorAll('[data-hero-action]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (btn.dataset.heroAction === 'roll') heroCtrl.triggerRoll();
          else heroCtrl.triggerAttack();
          renderHero(0.18);
        });
      });
    }
  });

  // Ambient videos: only play when visible, never under reduced motion
  const ambient = document.querySelectorAll('.inline-clip video, #world-video');
  if (reduced) {
    ambient.forEach((v) => { v.removeAttribute('autoplay'); v.pause(); });
  } else if ('IntersectionObserver' in window) {
    const vo = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.play().catch(() => {});
        else entry.target.pause();
      });
    }, { threshold: 0.1 });
    ambient.forEach((v) => vo.observe(v));
  }

  // Scene videos: full-bleed gameplay behind the dark stretches.
  // Each clip loads only when its scene gets close, plays while on screen and
  // pauses when it leaves. Tall screens get the portrait cut. Reduced motion and
  // data saver keep the still poster.
  const sceneVideos = Array.from(document.querySelectorAll('.scene-bg video[data-clip]'));
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  if (sceneVideos.length && !reduced && !saveData && 'IntersectionObserver' in window) {
    const orientation = () => (window.innerHeight > window.innerWidth * 1.1 ? 'port' : 'land');
    const srcFor = (v) => `assets/video/bg-${v.dataset.clip}-${orientation()}.mp4`;
    const onScreen = new Set();

    const load = (v) => {
      const src = srcFor(v);
      if (v.dataset.src === src) return;
      const t = v.currentTime || 0;
      v.dataset.src = src;
      v.src = src;
      v.load();
      if (t) v.addEventListener('loadedmetadata', () => { v.currentTime = t % (v.duration || 1); }, { once: true });
      if (onScreen.has(v)) v.play().catch(() => {});
    };

    const loader = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        load(entry.target);
        loader.unobserve(entry.target);
      });
    }, { rootMargin: '80% 0px' });

    const player = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const v = entry.target;
        if (entry.isIntersecting) {
          onScreen.add(v);
          if (!v.dataset.src) load(v);
          v.play().catch(() => {});
        } else {
          onScreen.delete(v);
          v.pause();
        }
      });
    }, { threshold: 0 });

    sceneVideos.forEach((v) => {
      v.muted = true;
      loader.observe(v);
      player.observe(v);
    });

    let lastOrientation = orientation();
    window.addEventListener('resize', () => {
      const o = orientation();
      if (o === lastOrientation) return;
      lastOrientation = o;
      sceneVideos.forEach((v) => { if (v.dataset.src) load(v); });
    }, { passive: true });
  }

  // -------------------------------------------------------------------------
  // 17. Storm: lightning, loot bursts and sparks on one overlay canvas
  // -------------------------------------------------------------------------
  // Everything is drawn on #fx, fixed above the page. Bolts and loot keep page
  // coordinates (they scroll with the content); orbs flying to the header meter
  // keep viewport coordinates. The loop only runs while something is alive.
  const RARITY_RGB = {
    common: '148,163,184',
    uncommon: '34,197,94',
    rare: '59,130,246',
    epic: '168,85,247',
    legendary: '245,158,11',
    mythic: '239,68,68',
  };
  const ARC_RGB = '120,200,255';
  const VOLT_RGB = '255,214,10';
  const rand = (a, b) => a + Math.random() * (b - a);

  const fx = (function createFx() {
    const canvas = document.getElementById('fx');
    const ctx = canvas && canvas.getContext('2d');
    if (!ctx || reduced) {
      const off = () => {};
      return { enabled: false, bolt: off, sparks: off, burst: off, orbs: off };
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    const bolts = [];
    const parts = [];
    let last = 0;
    let running = false;

    // Midpoint displacement: split every segment and push the midpoint sideways.
    function jagged(x1, y1, x2, y2, rough) {
      let pts = [[x1, y1], [x2, y2]];
      let d = Math.hypot(x2 - x1, y2 - y1) * rough;
      for (let i = 0; i < 6; i++) {
        const next = [pts[0]];
        for (let j = 1; j < pts.length; j++) {
          const a = pts[j - 1];
          const b = pts[j];
          const nx = -(b[1] - a[1]);
          const ny = b[0] - a[0];
          const len = Math.hypot(nx, ny) || 1;
          const o = (Math.random() - 0.5) * d;
          next.push([(a[0] + b[0]) / 2 + (nx / len) * o, (a[1] + b[1]) / 2 + (ny / len) * o], b);
        }
        pts = next;
        d *= 0.52;
      }
      return pts;
    }

    function start() {
      if (running) return;
      running = true;
      last = performance.now();
      tickers.add(frame);
    }

    function bolt(x1, y1, x2, y2, o) {
      const opts = o || {};
      const width = opts.width || 3;
      const main = jagged(x1, y1, x2, y2, opts.rough || 0.26);
      const paths = [{ pts: main, w: width }];
      const branches = opts.branches == null ? 3 : opts.branches;
      const span = Math.hypot(x2 - x1, y2 - y1);
      const heading = Math.atan2(y2 - y1, x2 - x1);
      for (let i = 0; i < branches; i++) {
        const p = main[Math.floor(main.length * rand(0.15, 0.75))];
        const a = heading + rand(-0.9, 0.9);
        const len = span * rand(0.14, 0.4);
        paths.push({ pts: jagged(p[0], p[1], p[0] + Math.cos(a) * len, p[1] + Math.sin(a) * len, 0.34), w: width * 0.45 });
      }
      bolts.push({
        paths, t: 0, life: opts.life || 0.36, rgb: opts.rgb || ARC_RGB,
        flash: opts.flash == null ? 0.14 : opts.flash, fxp: x2, fyp: y2, sy: window.scrollY,
      });
      start();
    }

    function sparks(x, y, n, rgb, power) {
      const p = power || 1;
      for (let i = 0; i < n; i++) {
        const a = rand(0, Math.PI * 2);
        const v = rand(120, 520) * p;
        parts.push({
          type: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80 * p, g: 700,
          t: 0, life: rand(0.25, 0.6), size: rand(1.2, 2.6), rgb: Math.random() < 0.4 ? '255,255,255' : (rgb || VOLT_RGB),
          sy: window.scrollY,
        });
      }
      start();
    }

    // Coins, gems and sparks thrown out of a chest.
    function burst(x, y, rgb, scale) {
      const s = scale || 1;
      sparks(x, y, Math.round(18 * s), rgb, 1.1);
      for (let i = 0; i < Math.round(13 * s); i++) {
        const a = rand(-Math.PI * 0.86, -Math.PI * 0.14);
        const v = rand(320, 760);
        parts.push({
          type: 'coin', x: x + rand(-14, 14), y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 1500,
          t: 0, life: rand(0.9, 1.5), size: rand(4, 6.5), rot: rand(0, 6), vr: rand(8, 18), sy: window.scrollY,
        });
      }
      for (let i = 0; i < Math.round(6 * s); i++) {
        const a = rand(-Math.PI * 0.8, -Math.PI * 0.2);
        const v = rand(280, 640);
        parts.push({
          type: 'gem', x: x + rand(-10, 10), y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 1300,
          t: 0, life: rand(1, 1.5), size: rand(6, 9), rot: rand(0, 6), vr: rand(-6, 6), rgb, sy: window.scrollY,
        });
      }
      start();
    }

    // Glowing orbs that leave the chest and home in on a target element.
    function orbs(x, y, rgb, target, onArrive) {
      let arrived = false;
      for (let i = 0; i < 9; i++) {
        const a = rand(-Math.PI, 0);
        const v = rand(180, 420);
        parts.push({
          type: 'orb', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0,
          hold: rand(0.22, 0.4), life: rand(0.85, 1.15), size: rand(3, 5), rgb, target, fixed: true,
          done() { if (!arrived) { arrived = true; if (onArrive) onArrive(); } },
        });
      }
      start();
    }

    function drawBolt(b, dy) {
      const k = 1 - b.t / b.life;
      const a = k * (b.t < b.life * 0.5 ? rand(0.55, 1) : 1);
      if (b.flash) {
        const r = Math.max(w, h) * 0.55;
        const g = ctx.createRadialGradient(b.fxp, b.fyp + dy, 0, b.fxp, b.fyp + dy, r);
        g.addColorStop(0, `rgba(190,225,255,${b.flash * k * k})`);
        g.addColorStop(1, 'rgba(190,225,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      b.paths.forEach((p) => {
        ctx.beginPath();
        p.pts.forEach((pt, i) => { if (i) ctx.lineTo(pt[0], pt[1] + dy); else ctx.moveTo(pt[0], pt[1] + dy); });
        ctx.strokeStyle = `rgba(${b.rgb},${a * 0.22})`;
        ctx.lineWidth = p.w * 6;
        ctx.stroke();
        ctx.strokeStyle = `rgba(${b.rgb},${a * 0.6})`;
        ctx.lineWidth = p.w * 2.4;
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${a})`;
        ctx.lineWidth = p.w;
        ctx.stroke();
      });
    }

    function drawPart(p, dy) {
      const k = 1 - p.t / p.life;
      const y = p.y + dy;
      if (p.type === 'spark') {
        ctx.strokeStyle = `rgba(${p.rgb},${k})`;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, y);
        ctx.lineTo(p.x - p.vx * 0.035, y - p.vy * 0.035);
        ctx.stroke();
      } else if (p.type === 'coin') {
        const alpha = Math.min(1, k * 3);
        const rx = Math.max(0.8, Math.abs(Math.cos(p.rot)) * p.size);
        ctx.fillStyle = `rgba(245,158,11,${alpha})`;
        ctx.beginPath();
        ctx.ellipse(p.x, y, rx, p.size, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255,236,120,${alpha})`;
        ctx.beginPath();
        ctx.ellipse(p.x, y - p.size * 0.12, rx * 0.68, p.size * 0.68, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'gem') {
        const alpha = Math.min(1, k * 3);
        ctx.save();
        ctx.translate(p.x, y);
        ctx.rotate(p.rot);
        ctx.fillStyle = `rgba(${p.rgb},${alpha})`;
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.lineTo(p.size * 0.72, 0);
        ctx.lineTo(0, p.size);
        ctx.lineTo(-p.size * 0.72, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${alpha * 0.6})`;
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.lineTo(p.size * 0.72, 0);
        ctx.lineTo(0, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        const r = p.size * 4;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, 'rgba(255,255,255,0.95)');
        g.addColorStop(0.25, `rgba(${p.rgb},0.85)`);
        g.addColorStop(1, `rgba(${p.rgb},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function frame() {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, w, h);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.globalCompositeOperation = 'lighter';

      for (let i = bolts.length - 1; i >= 0; i--) {
        const b = bolts[i];
        b.t += dt;
        if (b.t >= b.life) { bolts.splice(i, 1); continue; }
        drawBolt(b, b.sy - window.scrollY);
      }

      let targetCache = null;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.t += dt;
        if (p.t >= p.life) {
          if (p.done) p.done();
          parts.splice(i, 1);
          continue;
        }
        if (p.type === 'orb') {
          if (p.t < p.hold) {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= 0.9;
            p.vy *= 0.9;
            p.sx = p.x;
            p.sy0 = p.y;
          } else {
            if (!targetCache) {
              const r = p.target.getBoundingClientRect();
              targetCache = [r.left + r.width / 2, Math.max(18, r.top + r.height / 2)];
            }
            const e = Math.pow((p.t - p.hold) / (p.life - p.hold), 2.2);
            p.x = p.sx + (targetCache[0] - p.sx) * e;
            p.y = p.sy0 + (targetCache[1] - p.sy0) * e;
          }
          drawPart(p, 0);
        } else {
          p.vy += p.g * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (p.vr) p.rot += p.vr * dt;
          if (p.type !== 'spark') ctx.globalCompositeOperation = 'source-over';
          drawPart(p, p.sy - window.scrollY);
          ctx.globalCompositeOperation = 'lighter';
        }
      }

      if (!bolts.length && !parts.length) {
        running = false;
        tickers.delete(frame);
        ctx.clearRect(0, 0, w, h);
      }
    }

    return { enabled: true, bolt, sparks, burst, orbs };
  })();

  // A bolt from the top of the screen down to a point, with sparks where it lands.
  function strike(x, y, o) {
    fx.bolt(x + rand(-220, 220), -30, x, y, o);
    fx.sparks(x, y, 12, ARC_RGB);
  }

  // -------------------------------------------------------------------------
  // 18. Loot chests: struck open as the visitor reaches them, counted in the header
  // -------------------------------------------------------------------------
  const meter = document.getElementById('loot-meter');
  const meterCount = document.getElementById('meter-count');
  const meterSegs = meter ? Array.from(meter.querySelectorAll('.meter-segs i')) : [];
  const chests = Array.from(document.querySelectorAll('[data-chest]'));
  const heroStage = document.querySelector('.hero-stage');
  let opened = 0;

  function shake(el) {
    if (!el || reduced) return;
    el.classList.remove('is-shake');
    void el.offsetWidth;
    el.classList.add('is-shake');
  }

  function meterAdd(rarity) {
    const seg = meterSegs[opened];
    opened += 1;
    if (seg) {
      seg.style.setProperty('--c', `rgb(${RARITY_RGB[rarity] || VOLT_RGB})`);
      seg.classList.add('is-on');
    }
    if (!meter) return;
    const total = meterSegs.length;
    if (meterCount) meterCount.textContent = `${opened}/${total}`;
    meter.setAttribute('aria-label', `Baús abertos: ${opened} de ${total}`);
    meter.classList.remove('is-bump');
    void meter.offsetWidth;
    meter.classList.add('is-bump');
    if (opened >= total) {
      meter.classList.add('is-complete');
      if (header) header.classList.add('is-charged');
      // All found: the play button gets hit three times.
      const play = header && header.querySelector('.btn-primary');
      const r = (play && play.offsetParent ? play : meter).getBoundingClientRect();
      [0, 160, 320].forEach((ms) => setTimeout(() => {
        fx.bolt(r.left + r.width / 2 + rand(-300, 300), h0() + 40, r.left + r.width / 2, r.top + r.height / 2, { rgb: VOLT_RGB, flash: 0.08 });
        fx.sparks(r.left + r.width / 2, r.top + r.height / 2, 16, VOLT_RGB);
      }, ms));
    }
  }
  function h0() { return window.innerHeight; }

  function openChest(el, byUser) {
    if (!el) return;
    const rarity = el.dataset.rarity || 'legendary';
    const rgb = RARITY_RGB[rarity] || RARITY_RGB.legendary;
    const centre = () => {
      const r = el.getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height * 0.5];
    };

    if (el.classList.contains('is-open')) {
      // Already open: a click still pays out.
      if (!byUser) return;
      const [x, y] = centre();
      el.classList.remove('is-burst');
      void el.offsetWidth;
      el.classList.add('is-burst');
      fx.burst(x, y, rgb, 0.6);
      return;
    }
    if (el.dataset.opening) return;
    el.dataset.opening = '1';

    const finish = () => {
      const [x, y] = centre();
      el.classList.add('is-open');
      el.setAttribute('aria-label', 'Baú aberto. Clique para mais loot');
      if (header) header.classList.remove('is-hidden');
      fx.burst(x, y, rgb, 1);
      if (el.closest('.hero')) shake(heroStage);
      if (fx.enabled && meter && meter.offsetParent) fx.orbs(x, y, rgb, meter, () => meterAdd(rarity));
      else meterAdd(rarity);
    };

    if (!fx.enabled) { finish(); return; }
    const [x, y] = centre();
    fx.bolt(x + rand(-260, 260), -30, x, y, { flash: 0.16, width: 3.4 });
    setTimeout(finish, 110);
  }

  chests.forEach((el) => {
    el.addEventListener('click', () => openChest(el, true));
  });

  whenLoaded(() => {
    const heroChest = document.querySelector('.chest-hero');
    const lines = Array.from(document.querySelectorAll('.hero-title .line > span'));

    // Three words, three hits, then the chest.
    if (fx.enabled && window.scrollY < window.innerHeight * 0.6) {
      [260, 610, 960].forEach((ms, i) => setTimeout(() => {
        const line = lines[i];
        if (!line) return;
        const r = line.getBoundingClientRect();
        strike(r.left + r.width * rand(0.55, 0.95), r.top + r.height * 0.55, { flash: i === 2 ? 0.14 : 0.07, branches: 2 });
        shake(heroStage);
      }, ms));
    }
    setTimeout(() => openChest(heroChest), reduced ? 0 : 1650);

    // The rest open when they scroll well into view.
    if ('IntersectionObserver' in window) {
      const watcher = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          watcher.unobserve(entry.target);
          setTimeout(() => openChest(entry.target), reduced ? 0 : 320);
        });
      }, { threshold: 0.9, rootMargin: '0px 0px -14% 0px' });
      chests.forEach((el) => { if (el !== heroChest) watcher.observe(el); });
    } else {
      chests.forEach((el) => openChest(el));
    }
  });

  // -------------------------------------------------------------------------
  // 19. Lightning on demand: ambient strikes over the hero, clicks, zap targets
  // -------------------------------------------------------------------------
  if (fx.enabled) {
    let heroOnScreen = true;
    if (hero && 'IntersectionObserver' in window) {
      new IntersectionObserver((entries) => { heroOnScreen = entries[0].isIntersecting; }, { threshold: 0.25 }).observe(hero);
    }
    (function ambient() {
      setTimeout(() => {
        if (isLoaded && heroOnScreen && !document.hidden && hero) {
          const r = hero.getBoundingClientRect();
          const x = r.left + r.width * rand(0.3, 0.98);
          fx.bolt(x + rand(-160, 160), r.top - 20, x, r.top + r.height * rand(0.18, 0.55), { width: 1.8, flash: 0.05, branches: 2 });
        }
        ambient();
      }, rand(3200, 7000));
    })();

    document.addEventListener('click', (e) => {
      const target = e.target;
      if (!(target instanceof Element) || target.closest('[data-chest], [data-zap]')) return;
      if (target.closest('a, button, [role="button"], video')) {
        fx.sparks(e.clientX, e.clientY, 10, VOLT_RGB, 0.7);
      } else if (target.closest('.hero')) {
        strike(e.clientX, e.clientY, { flash: 0.1 });
      } else {
        fx.sparks(e.clientX, e.clientY, 8, ARC_RGB, 0.6);
      }
    });

    document.querySelectorAll('[data-zap]').forEach((el) => {
      const zap = () => {
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        if (el.dataset.zap === 'big') {
          for (let i = 0; i < 5; i++) {
            const a = rand(0, Math.PI * 2);
            const d = rand(r.width * 0.7, r.width * 1.25);
            fx.bolt(x, y, x + Math.cos(a) * d, y + Math.sin(a) * d, { rgb: i % 2 ? ARC_RGB : VOLT_RGB, flash: i ? 0 : 0.1, branches: 2, width: 2.4 });
          }
          fx.sparks(x, y, 30, VOLT_RGB, 1.2);
        } else {
          fx.bolt(x + rand(-140, 140), Math.max(-30, r.top - 420), x, y, { rgb: VOLT_RGB, flash: 0.05, branches: 2, width: 2.2 });
          fx.sparks(x, y, 12, VOLT_RGB, 0.8);
        }
      };
      el.addEventListener('click', zap);
      el.addEventListener('keydown', (e) => {
        if (el.getAttribute('role') === 'button' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); zap(); }
      });
    });
  }
})();
