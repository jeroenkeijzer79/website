(() => {
  'use strict';
  // Toon alleen het hoofddomein in de adresbalk, maar onthoud welke
  // pagina actief is. Zo kan een refresh op mobiel (pull-to-refresh)
  // niet onbedoeld terugvallen op de welkomstpagina.
  const currentPath = window.location.pathname;
  const isRoot = currentPath === '/' || currentPath === '';
  const navigationEntry = performance.getEntriesByType('navigation')[0];
  const isReload = navigationEntry && navigationEntry.type === 'reload';
  const savedPage = sessionStorage.getItem('activePage');

  if (isRoot && isReload && savedPage && savedPage !== '/') {
    window.location.replace(savedPage);
    return;
  }

  if (!isRoot) {
    sessionStorage.setItem('activePage', currentPath);
    window.history.replaceState({}, document.title, '/');
  }

  // Interne navigatie onthouden voordat de zichtbare URL wordt aangepast.
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link) return;

    try {
      const target = new URL(link.href, window.location.href);
      if (target.origin !== window.location.origin) return;

      if (target.pathname === '/' || target.pathname === '') {
        sessionStorage.setItem('activePage', '/');
      } else if (target.pathname.endsWith('.html')) {
        sessionStorage.setItem('activePage', target.pathname);
      }
    } catch (_) {}
  }, true);

  // Google Analytics 4
  // Vervang deze placeholder door het Measurement ID uit Google Analytics (bijv. G-ABC1234567).
  const GA_MEASUREMENT_ID = 'G-SDLFLFQLH1';

  const initAnalytics = () => {
    if (!/^G-[A-Z0-9]+$/.test(GA_MEASUREMENT_ID) || GA_MEASUREMENT_ID === 'G-XXXXXXXXXX') return;

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_MEASUREMENT_ID, { anonymize_ip: true });

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_MEASUREMENT_ID);
    document.head.appendChild(script);
  };

  const trackEvent = (name, parameters = {}) => {
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', name, parameters);
  };

  initAnalytics();

  // Meet belangrijke navigatie- en conversieklikken.
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link) return;

    const href = link.href || '';
    const text = (link.textContent || '').trim();
    const label = text || href;

    if (href.includes('gigstarter.nl')) {
      trackEvent('gigstarter_click', { link_url: href });
    } else if (href.includes('instagram.com')) {
      trackEvent('instagram_click', { link_url: href });
    } else if (href.includes('youtube.com') || href.includes('youtu.be')) {
      trackEvent('youtube_click', { link_url: href });
    } else if (href.includes('spotify.com')) {
      trackEvent('spotify_click', { link_url: href });
    } else if (href.endsWith('/agenda.html') || href.endsWith('agenda.html')) {
      trackEvent('agenda_click', { link_text: label });
    } else if (href.endsWith('/repertoire.html') || href.endsWith('repertoire.html')) {
      trackEvent('repertoire_click', { link_text: label });
    } else if (href.endsWith('/aanvraag.html') || href.endsWith('aanvraag.html')) {
      trackEvent('aanvraag_click', { link_text: label });
    } else if (href.endsWith('/contact.html') || href.endsWith('contact.html')) {
      trackEvent('contact_click', { link_text: label });
    }
  });

  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    if (form.classList.contains('contact-form')) {
      trackEvent('contact_submit');
    } else if (form.classList.contains('request-form')) {
      trackEvent('aanvraag_submit');
    }
  });

  const loadContent = async () => {
    const targets = [
      ['home-hero-content', './content/home.html', 'hero-content'],
      ['home-about-content', './content/home.html', 'about-inner'],
      ['contact-content', './content/contact.html', 'contact-inner'],
      ['instagram-content', './content/instagram.html', 'instagram-inner'],
      ['request-content', './content/aanvraag.html', 'request-inner']
    ];

    await Promise.all(targets.map(async ([id, url, className]) => {
      const target = document.getElementById(id);
      if (!target) return;

      try {
        const response = await fetch(new URL(url, document.baseURI).href, {
          cache: 'no-store'
        });

        if (!response.ok) {
          throw new Error(`Content laden mislukt: ${response.status}`);
        }

        const html = await response.text();
        const template = document.createElement('template');
        template.innerHTML = html;

        const content = template.content.querySelector('.' + className);

        if (!content) {
          throw new Error(`Element .${className} ontbreekt in ${url}`);
        }

        target.replaceWith(content);
      } catch (error) {
        console.error('Content laden mislukt:', error);
      }
    }));
  };

  loadContent();

  const slides = [...document.querySelectorAll('.slide')];

  if (slides.length > 1) {
    let currentIndex = 0;

    setInterval(() => {
      const current = slides[currentIndex];
      const nextIndex = (currentIndex + 1) % slides.length;
      const next = slides[nextIndex];

      next.classList.add('is-active');
      current.classList.remove('is-active');
      currentIndex = nextIndex;
    }, 10000);
  }

  const scrollButton = document.querySelector('.scroll-down');

  if (scrollButton) {
    scrollButton.addEventListener('click', () => {
      const content = document.getElementById('content');

      if (content) {
        content.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  }

  const about = document.querySelector('.about');
  const aboutScrollUp = document.querySelector('.about-scroll-up');

  if (about && aboutScrollUp) {
    const updateAboutArrow = (entries) => {
      const entry = entries[0];
      aboutScrollUp.classList.toggle('is-visible', entry.isIntersecting && entry.intersectionRatio >= 0.97);
    };

    const aboutObserver = new IntersectionObserver(updateAboutArrow, {
      threshold: [0, 0.5, 0.9, 0.97, 1]
    });

    aboutObserver.observe(about);

    aboutScrollUp.addEventListener('click', () => {
      const hero = document.getElementById('hero');
      if (hero) {
        hero.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  }

  const header = document.querySelector('.site-header');
  const hero = document.querySelector('.hero');
  const hasHero = Boolean(hero);

  if (header) {
    let ticking = false;

    const updateHeader = () => {
      const fadeDistance = hasHero ? Math.max(1, hero.offsetHeight - header.offsetHeight) : 1;
      const progress = hasHero ? Math.min(1, Math.max(0, window.scrollY / fadeDistance)) : 1;
      const value = Math.round(255 * progress);
      const inverse = 255 - value;

      header.style.setProperty('--nav-bg-r', value);
      header.style.setProperty('--nav-bg-g', value);
      header.style.setProperty('--nav-bg-b', value);
      header.style.setProperty('--nav-bg-a', progress === 0 ? '.30' : String(progress));

      header.style.setProperty('--nav-text-r', inverse);
      header.style.setProperty('--nav-text-g', inverse);
      header.style.setProperty('--nav-text-b', inverse);

      ticking = false;
    };

    const requestHeaderUpdate = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateHeader);
        ticking = true;
      }
    };

    window.addEventListener('scroll', requestHeaderUpdate, { passive: true });
    window.addEventListener('resize', requestHeaderUpdate);
    updateHeader();
  }

  // Scrollknoppen op de Over-pagina.
  document.querySelectorAll('[data-scroll-target]').forEach((button) => {
    button.addEventListener('click', () => {
      const targetId = button.getAttribute('data-scroll-target');
      const target = targetId ? document.getElementById(targetId) : null;
      if (!target) return;

      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    });
  });

  const menuToggle = document.querySelector('.menu-toggle');
  const menuClose = document.querySelector('.menu-close');
  const mobilePanel = document.querySelector('.mobile-panel');
  const mobileBackdrop = document.querySelector('.mobile-backdrop');

  if (!menuToggle || !mobilePanel || !mobileBackdrop) return;

  const setMenu = (open) => {
    menuToggle.setAttribute('aria-expanded', String(open));
    mobilePanel.setAttribute('aria-hidden', String(!open));
    mobilePanel.classList.toggle('is-open', open);
    mobileBackdrop.classList.toggle('is-open', open);
    document.body.classList.toggle('menu-open', open);
  };

  menuToggle.addEventListener('click', () => setMenu(true));
  menuClose?.addEventListener('click', () => setMenu(false));
  mobileBackdrop.addEventListener('click', () => setMenu(false));

  mobilePanel.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setMenu(false));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setMenu(false);
  });
})();