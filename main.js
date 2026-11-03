/**
 * Kapi Studios • Nature, Magic & Capybara Interactions
 * High-DPI Fireflies simulation, scroll-spy, mobile nav, capybara pet easter egg, and accessible trailer modal
 */
(function initKapiNature() {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // =========================================================================
  // 1. FIREFLIES PARTICLES SIMULATION (Retina-ready & Offscreen-paused)
  // =========================================================================
  const canvases = document.querySelectorAll('.fireflies');

  canvases.forEach((canvas) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let isVisible = true;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resizeCanvas() {
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { passive: true });

    const count = parseInt(canvas.dataset.count || '30', 10);
    const fireflies = [];
    const colors = [
      { r: 246, g: 226, b: 122 }, // Warm gold
      { r: 110, g: 231, b: 183 }, // Soft emerald
      { r: 196, g: 181, b: 253 }, // Mystic lavender
      { r: 254, g: 240, b: 138 }, // Firefly yellow
    ];

    for (let i = 0; i < count; i++) {
      fireflies.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 2.2 + 1.2,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.35 - 0.15,
        alpha: Math.random() * 0.7 + 0.2,
        phase: Math.random() * Math.PI * 2,
        phaseSpeed: Math.random() * 0.03 + 0.015,
      });
    }

    if ('IntersectionObserver' in window) {
      const canvasObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          isVisible = entry.isIntersecting;
        });
      });
      canvasObserver.observe(canvas);
    }

    function drawFrame() {
      if (isVisible) {
        ctx.clearRect(0, 0, width, height);
        for (let i = 0; i < fireflies.length; i++) {
          const f = fireflies[i];
          if (!prefersReducedMotion) {
            f.x += f.vx;
            f.y += f.vy;
            f.phase += f.phaseSpeed;
          }

          if (f.x < -20) f.x = width + 20;
          if (f.x > width + 20) f.x = -20;
          if (f.y < -20) f.y = height + 20;
          if (f.y > height + 20) f.y = -20;

          const currentAlpha = Math.max(0.08, Math.sin(f.phase) * f.alpha);
          const { r, g, b } = f.color;

          const glowRadius = f.radius * 5.5;
          const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, glowRadius);
          grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${currentAlpha * 0.8})`);
          grad.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, ${currentAlpha * 0.3})`);
          grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(f.x, f.y, glowRadius, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = `rgba(255, 255, 255, ${currentAlpha * 0.95})`;
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.radius * 0.7, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (!prefersReducedMotion) {
        requestAnimationFrame(drawFrame);
      }
    }

    drawFrame();
  });

  // =========================================================================
  // 2. MOBILE NAVIGATION DRAWER & ACTIVE SECTION SCROLL-SPY
  // =========================================================================
  const navToggle = document.getElementById('nav-toggle');
  const mainNav = document.getElementById('main-nav');
  const navLinks = document.querySelectorAll('.main-nav .nav-link');

  function closeMobileNav() {
    if (!navToggle || !mainNav) return;
    navToggle.setAttribute('aria-expanded', 'false');
    mainNav.classList.remove('is-open');
  }

  if (navToggle && mainNav) {
    navToggle.addEventListener('click', () => {
      const expanded = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', String(!expanded));
      mainNav.classList.toggle('is-open', !expanded);
    });

    navLinks.forEach((link) => {
      link.addEventListener('click', closeMobileNav);
    });
  }

  const sections = document.querySelectorAll('main section[id]');
  if ('IntersectionObserver' in window && sections.length > 0) {
    const spyObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('id');
            navLinks.forEach((link) => {
              link.classList.toggle('is-active', link.getAttribute('href') === `#${id}`);
            });
          }
        });
      },
      { rootMargin: '-35% 0px -55% 0px' }
    );
    sections.forEach((sec) => spyObserver.observe(sec));
  }

  // =========================================================================
  // 3. CAPYBARA PETTING INTERACTION (Cozy Easter Egg)
  // =========================================================================
  const capyPet = document.getElementById('capy-pet');
  const capyTooltip = document.getElementById('capy-tooltip');
  const cozyMessages = [
    'A capivara gostou do carinho!',
    'Que paz na beira do rio...',
    'Pronta para a próxima aventura!',
    'Nhac! Uma folha fresquinha.',
  ];
  let msgIndex = 0;
  let petTimeout = null;

  function triggerCapyPet() {
    if (!capyPet) return;
    capyPet.classList.remove('is-petted');
    void capyPet.offsetWidth; // Force reflow to restart heart animation
    capyPet.classList.add('is-petted');

    if (capyTooltip) {
      capyTooltip.textContent = cozyMessages[msgIndex % cozyMessages.length];
      msgIndex++;
    }

    clearTimeout(petTimeout);
    petTimeout = setTimeout(() => {
      capyPet.classList.remove('is-petted');
    }, 1600);
  }

  if (capyPet) {
    capyPet.addEventListener('click', triggerCapyPet);
    capyPet.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        triggerCapyPet();
      }
    });
  }

  // =========================================================================
  // 4. SCROLL REVEAL OBSERVER
  // =========================================================================
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && reveals.length > 0 && !prefersReducedMotion) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    reveals.forEach((el) => observer.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-visible'));
  }

  // =========================================================================
  // 5. TRAILER MODAL CONTROLS (With Focus Management)
  // =========================================================================
  const trailerModal = document.getElementById('trailer-modal');
  const trailerBackdrop = document.getElementById('trailer-backdrop');
  const trailerCloseBtn = document.getElementById('trailer-close');
  const modalVideo = document.getElementById('modal-video');
  const openButtons = [
    document.getElementById('btn-open-trailer'),
    document.getElementById('btn-world-trailer'),
  ].filter(Boolean);

  let lastFocusedTrigger = null;

  function openTrailer(e) {
    if (!trailerModal) return;
    lastFocusedTrigger = e ? e.currentTarget : document.activeElement;
    trailerModal.classList.add('is-active');
    trailerModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (trailerCloseBtn) trailerCloseBtn.focus();
    if (modalVideo) {
      modalVideo.currentTime = 0;
      modalVideo.play().catch(() => {});
    }
  }

  function closeTrailer() {
    if (!trailerModal) return;
    trailerModal.classList.remove('is-active');
    trailerModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (modalVideo) {
      modalVideo.pause();
    }
    if (lastFocusedTrigger && typeof lastFocusedTrigger.focus === 'function') {
      lastFocusedTrigger.focus();
    }
  }

  openButtons.forEach((btn) => btn.addEventListener('click', openTrailer));
  if (trailerCloseBtn) trailerCloseBtn.addEventListener('click', closeTrailer);
  if (trailerBackdrop) trailerBackdrop.addEventListener('click', closeTrailer);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (trailerModal && trailerModal.classList.contains('is-active')) {
        closeTrailer();
      }
      closeMobileNav();
    }
  });

  const worldVideo = document.getElementById('world-video');
  if (worldVideo && !prefersReducedMotion) {
    worldVideo.play().catch(() => {});
  }
})();
