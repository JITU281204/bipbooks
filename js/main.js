// ─── Firebase Config ────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyC47j_zGeawZaI6gm0nE4EccIt4afrIIjE",
  authDomain: "bipbooks.firebaseapp.com",
  projectId: "bipbooks",
  storageBucket: "bipbooks.firebasestorage.app",
  messagingSenderId: "102356999864",
  appId: "1:102356999864:web:16fa5845df6eaed245de4d"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();


(function() {
  'use strict';

  // ─── Auth State & Dashboard UI Logic ──────────────────────
  function initAuthUI() {
    const loginBtn = document.getElementById('user-login-btn');
    const profileBtn = document.getElementById('user-profile-btn');
    const profileImg = document.getElementById('user-profile-img');
    const logoutBtn = document.getElementById('user-logout-btn');
    const dropdown = document.querySelector('.user-dropdown');
    let dropdownTimeout;

    if (profileBtn && dropdown) {
      profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.style.display = 'flex';
        clearTimeout(dropdownTimeout);
        dropdownTimeout = setTimeout(() => {
          dropdown.style.display = 'none';
        }, 5000); // Hide after 5 seconds
      });

      document.addEventListener('click', (e) => {
        if (!e.target.closest('.user-profile')) {
          dropdown.style.display = 'none';
        }
      });
    }
    

    // Authentication Listeners
    if (loginBtn) {
      loginBtn.addEventListener('click', () => {
        auth.signInWithPopup(provider).catch(err => {
          console.error(err);
          alert("লগইন ব্যর্থ হয়েছে!\n\nসমস্যা: " + err.message + "\n\n(অনুগ্রহ করে আপনার Firebase Console-এ Authentication > Sign-in method এ গিয়ে 'Google' অপশনটি Enable করুন।)");
        });
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        auth.signOut();
        
      });
    }

    // Auth State Observer
    auth.onAuthStateChanged((user) => {
      if (user) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (profileBtn) profileBtn.style.display = 'flex';
        if (profileImg) profileImg.src = user.photoURL || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%23ffd700"/></svg>';
      } else {
        if (loginBtn) loginBtn.style.display = 'block';
        if (profileBtn) profileBtn.style.display = 'none';
      }
    });

    }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuthUI);
  } else {
    initAuthUI();
  }

  // ─── Particle Canvas ─────────────────────────────────────
  (function initParticles() {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let W = window.innerWidth;
    let H = window.innerHeight;
    canvas.width  = W;
    canvas.height = H;

    const COLORS = ['rgba(255,215,0,', 'rgba(0,229,255,', 'rgba(224,64,251,', 'rgba(0,230,118,'];
    const COUNT  = Math.min(80, Math.floor(W * H / 18000));

    const particles = Array.from({ length: COUNT }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.5 + 0.5,
      dx: (Math.random() - 0.5) * 0.35,
      dy: (Math.random() - 0.5) * 0.35,
      alpha: Math.random() * 0.5 + 0.1,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      pulse: Math.random() * Math.PI * 2
    }));

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const t = Date.now() * 0.001;

      particles.forEach(p => {
        p.pulse += 0.02;
        const alpha = p.alpha * (0.7 + 0.3 * Math.sin(p.pulse));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color + alpha + ')';
        ctx.fill();

        p.x += p.dx;
        p.y += p.dy;

        if (p.x < -5) p.x = W + 5;
        if (p.x > W + 5) p.x = -5;
        if (p.y < -5) p.y = H + 5;
        if (p.y > H + 5) p.y = -5;
      });

      // Draw connecting lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(255,215,0,${0.05 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(draw);
    }

    draw();

    window.addEventListener('resize', () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width  = W;
      canvas.height = H;
    });
  })();

  // ─── Navbar Scroll Effect ─────────────────────────────────
  (function initNavbar() {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;

    function onScroll() {
      if (window.scrollY > 50) navbar.classList.add('scrolled');
      else navbar.classList.remove('scrolled');

      // Active nav link highlight
      const sections = document.querySelectorAll('section[id], .section[id]');
      const navLinks = document.querySelectorAll('.nav-links a');
      let current = '';

      sections.forEach(sec => {
        const top = sec.offsetTop - 120;
        if (window.scrollY >= top) current = sec.getAttribute('id');
      });

      navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === '#' + current) {
          link.classList.add('active');
        }
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  })();

  // ─── Mobile Hamburger ─────────────────────────────────────
  (function initMobileNav() {
    const btn   = document.getElementById('nav-hamburger');
    const menu  = document.getElementById('nav-mobile');
    if (!btn || !menu) return;

    let isOpen = false;

    function toggle() {
      isOpen = !isOpen;
      btn.setAttribute('aria-expanded', isOpen);
      menu.classList.toggle('open', isOpen);

      const spans = btn.querySelectorAll('span');
      if (isOpen) {
        spans[0].style.transform = 'translateY(7px) rotate(45deg)';
        spans[1].style.opacity   = '0';
        spans[2].style.transform = 'translateY(-7px) rotate(-45deg)';
      } else {
        spans[0].style.transform = '';
        spans[1].style.opacity   = '';
        spans[2].style.transform = '';
      }
    }

    btn.addEventListener('click', toggle);

    // Close on link click
    menu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        if (isOpen) toggle();
      });
    });

    // Close on outside click
    document.addEventListener('click', e => {
      if (isOpen && !btn.contains(e.target) && !menu.contains(e.target)) {
        toggle();
      }
    });
  })();

  // ─── Smooth Scroll for all anchor links ──────────────────
  (function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        if (href === '#') return;
        const target = document.querySelector(href);
        if (!target) return;
        e.preventDefault();
        const offset = 100;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      });
    });
  })();

  // ─── Scroll Reveal Animation ──────────────────────────────
  (function initScrollReveal() {
    const reveals = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');
    if (!reveals.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    reveals.forEach(el => observer.observe(el));
  })();

  // ─── Category Slider Drag (touch support) ────────────────
  (function initCategorySlider() {
    const slider = document.getElementById('category-slider');
    if (!slider) return;

    let isDown = false, startX, scrollLeft;

    slider.addEventListener('mousedown', e => {
      isDown = true;
      slider.style.cursor = 'grabbing';
      startX = e.pageX - slider.offsetLeft;
      scrollLeft = slider.scrollLeft;
    });
    slider.addEventListener('mouseleave', () => { isDown = false; slider.style.cursor = 'grab'; });
    slider.addEventListener('mouseup',    () => { isDown = false; slider.style.cursor = 'grab'; });
    slider.addEventListener('mousemove',  e => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - slider.offsetLeft;
      const walk = (x - startX) * 1.5;
      slider.scrollLeft = scrollLeft - walk;
    });
  })();

  // ─── Contact Form Handler ─────────────────────────────────
  window.handleContactForm = function(e) {
    e.preventDefault();
    const btn = document.getElementById('contact-submit-btn');
    const origText = btn.textContent;
    btn.textContent = '⏳ পাঠানো হচ্ছে...';
    btn.disabled = true;

    setTimeout(() => {
      btn.textContent = origText;
      btn.disabled = false;
      e.target.reset();
      showToast('✅ আপনার বার্তা সফলভাবে পাঠানো হয়েছে!', '#00e676');
    }, 1500);
  };

  // ─── Toast Notification ──────────────────────────────────
  let toastTimeout;
  window.showToast = function(msg, color) {
    const toast = document.getElementById('main-toast');
    const msgEl = document.getElementById('toast-msg');
    const iconEl = document.getElementById('toast-icon');
    if (!toast) return;

    if (msgEl) msgEl.textContent = msg;
    toast.style.borderColor = color || 'rgba(255,255,255,0.1)';

    toast.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('show'), 4000);
  };

  // ─── Counter Animation (Hero Stats) ──────────────────────
  (function animateCounters() {
    const counters = document.querySelectorAll('.stat-num');
    if (!counters.length) return;

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const text = el.textContent;
        // Only animate if it contains a number
        const numMatch = text.match(/[\d,৫০১২০০০০৫]+/);
        if (!numMatch) return;
        observer.unobserve(el);
        // Simple pulse effect
        el.style.transform = 'scale(1.15)';
        el.style.transition = 'transform 0.4s ease';
        setTimeout(() => { el.style.transform = ''; }, 400);
      });
    }, { threshold: 0.5 });

    counters.forEach(c => observer.observe(c));
  })();

  // ─── Book card hover glow colors ─────────────────────────
  (function bookCardEffects() {
    const glowColors = [
      'var(--shadow-cyan)',
      'var(--shadow-gold)',
      'var(--shadow-magenta)',
      'var(--shadow-green)',
    ];
    document.querySelectorAll('.book-card').forEach((card, i) => {
      const color = glowColors[i % glowColors.length];
      card.addEventListener('mouseenter', () => card.style.boxShadow = `var(${color.replace('var(','').replace(')','')})`);
      card.addEventListener('mouseleave', () => card.style.boxShadow = '');
    });
  })();

  // ─── Ticker duplicate for infinite scroll ────────────────
  (function fixTicker() {
    const track = document.getElementById('ticker-track');
    if (!track) return;
    // Already duplicated in HTML. Just ensure animation width is right.
    const items = track.querySelectorAll('.ticker-item');
    const halfCount = Math.floor(items.length / 2);
    // Animation translates by 50%, so ensure equal halves
  })();

})();
