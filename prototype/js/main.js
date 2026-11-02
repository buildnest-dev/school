(() => {
  'use strict';
  window.__ok = true; // tells the head script that scripts ran (see index.html)

  /* Replace the temporary product name here (and the fallback text in index.html / <title>). */
  const BRAND = 'SchoolOS';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const reduceMq = matchMedia('(prefers-reduced-motion: reduce)');
  const motionOK = () => !reduceMq.matches;

  $$('[data-brand]').forEach(el => { el.textContent = BRAND; });
  $$('.brand').forEach(el => el.setAttribute('aria-label', BRAND + ' home'));
  const yr = $('#year'); if (yr) yr.textContent = new Date().getFullYear();

  /* ---------- Toast for placeholder destinations ---------- */
  const toast = $('#toast'); let toastTimer;
  const showToast = msg => {
    toast.textContent = msg; toast.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.hidden = true; }, 3800);
  };
  $$('[data-placeholder]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault(); showToast(a.dataset.placeholder); closeMenu();
  }));

  /* ---------- Mobile menu ---------- */
  const header = $('.site-header'), toggle = $('.nav-toggle'), panel = $('#site-nav');
  function closeMenu() {
    panel.classList.remove('is-open'); header.classList.remove('menu-open'); toggle.setAttribute('aria-expanded', 'false');
  }
  toggle.addEventListener('click', () => {
    const open = panel.classList.toggle('is-open');
    header.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  });
  panel.addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && panel.classList.contains('is-open')) { closeMenu(); toggle.focus(); }
  });
  matchMedia('(min-width: 961px)').addEventListener('change', closeMenu);

  /* ---------- Tabs (arrows, Home/End; Up/Down for vertical lists) ---------- */
  $$('[data-tabs]').forEach(root => {
    const tabs = $$('[role="tab"]', root);
    const vertical = root.dataset.orientation === 'vertical';
    const select = (tab, focus) => {
      tabs.forEach(t => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) tab.focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t));
      t.addEventListener('keydown', e => {
        const next = vertical ? 'ArrowDown' : 'ArrowRight', prev = vertical ? 'ArrowUp' : 'ArrowLeft';
        const map = { [next]: i + 1, [prev]: i - 1, Home: 0, End: tabs.length - 1 };
        if (!(e.key in map)) return;
        e.preventDefault();
        select(tabs[(map[e.key] + tabs.length) % tabs.length], true);
      });
    });
  });

  /* ---------- Hero: count-up, workspace switcher, group view ---------- */
  const SCHOOLS = {
    northfield: { name: 'Northfield Academy', initial: 'N', classes: 'Classes 1–12 · 38 sections', enroll: 1248, enrollSub: '+36 this term', present: 94.2, presentSub: '1,176 of 1,248 students', fees: 38.6, feesSub: 'of ₹52.0L due · Term 2', feesPct: 74,
      wings: [['Primary', 96], ['Middle', 93], ['Secondary', 91], ['Sr. Secondary', 95]] },
    riverstone: { name: 'Riverstone Public School', initial: 'R', classes: 'Nursery–10 · 27 sections', enroll: 862, enrollSub: '+21 this term', present: 91.8, presentSub: '791 of 862 students', fees: 21.4, feesSub: 'of ₹30.5L due · Term 2', feesPct: 70,
      wings: [['Pre-primary', 97], ['Primary', 92], ['Middle', 90], ['Secondary', 88]] }
  };
  const fmt = {
    int: v => Math.round(v).toLocaleString('en-IN'),
    pct: v => v.toFixed(1) + '%',
    lakh: v => '₹' + v.toFixed(1) + 'L'
  };
  const app = $('#hero-app');
  const kpis = $$('.kpi-value', app);
  const raf = {};
  const countTo = (el, target, animate) => {
    cancelAnimationFrame(raf[el.id]);
    const f = fmt[el.dataset.fmt];
    if (!animate) { el.textContent = f(target); el.dataset.v = target; return; }
    const from = 0, dur = 1100, t0 = performance.now();
    const step = now => {
      const p = clamp((now - t0) / dur, 0, 1), eased = 1 - Math.pow(1 - p, 3);
      el.textContent = f(from + (target - from) * eased);
      if (p < 1) raf[el.id] = requestAnimationFrame(step);
    };
    el.dataset.v = target; raf[el.id] = requestAnimationFrame(step);
  };

  const applySchool = (key, animate) => {
    const s = SCHOOLS[key];
    app.dataset.school = key;
    $('#w-name').textContent = s.name; $('#w-initial').textContent = s.initial; $('#w-classes').textContent = s.classes;
    $('#k-enroll-sub').textContent = s.enrollSub; $('#k-present-sub').textContent = s.presentSub; $('#k-fees-sub').textContent = s.feesSub;
    $('#k-present-bar').style.width = s.present + '%'; $('#k-fees-bar').style.width = s.feesPct + '%';
    countTo($('#k-enroll'), s.enroll, animate); countTo($('#k-present'), s.present, animate); countTo($('#k-fees'), s.fees, animate);
    $$('#wings li').forEach((li, i) => {
      $('span', li).textContent = s.wings[i][0]; $('b', li).style.width = s.wings[i][1] + '%'; $('em', li).textContent = s.wings[i][1] + '%';
    });
  };
  $$('.ws button', app).forEach(btn => btn.addEventListener('click', () => {
    $$('.ws button', app).forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    applySchool(btn.dataset.ws, motionOK());
  }));
  const grpBtn = $('#grp-btn');
  grpBtn.addEventListener('click', () => {
    const on = grpBtn.getAttribute('aria-pressed') !== 'true';
    grpBtn.setAttribute('aria-pressed', String(on));
    $('#view-school').hidden = on; $('#view-group').hidden = !on;
  });
  /* Initial count-up runs while the panels stagger in (values are already correct without motion). */
  if (motionOK()) {
    kpis.forEach(el => { el.textContent = fmt[el.dataset.fmt](0); });
    setTimeout(() => { const s = SCHOOLS.northfield; countTo($('#k-enroll'), s.enroll, true); countTo($('#k-present'), s.present, true); countTo($('#k-fees'), s.fees, true); }, 1550);
  }

  /* ---------- Headline word masks ---------- */
  const splitWords = root => {
    let i = 0;
    const walk = node => {
      Array.from(node.childNodes).forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span'); w.className = 'w';
            const inner = document.createElement('span'); inner.textContent = part; inner.style.setProperty('--i', i++);
            w.appendChild(inner); frag.appendChild(w);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(root);
  };

  /* ---------- Reveal on scroll ---------- */
  const targets = $$('.reveal, .reveal-m, .stagger, .mask, #campus-vis, #timeline');
  if (motionOK()) $$('.mask').forEach(splitWords);
  $$('.stagger').forEach(g => Array.from(g.children).forEach((c, i) => c.style.setProperty('--i', i)));
  if ('IntersectionObserver' in window && motionOK()) {
    const io = new IntersectionObserver(es => es.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
    }), { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
    targets.forEach(el => io.observe(el));
  } else targets.forEach(el => el.classList.add('is-in'));

  /* ---------- Scroll-driven showcase ---------- */
  const track = $('#showcase-track');
  const stages = $$('.stage', track), navBtns = $$('.show-nav button', track);
  let stageIdx = 0, sticky = false;
  const setStage = i => {
    if (i === stageIdx && stages[i].classList.contains('is-active')) return;
    stageIdx = i;
    stages.forEach((s, k) => s.classList.toggle('is-active', k === i));
    navBtns.forEach((b, k) => b.setAttribute('aria-current', String(k === i)));
  };
  const stickyMq = matchMedia('(min-width: 961px)');
  const syncSticky = () => {
    sticky = stickyMq.matches && motionOK();
    track.classList.toggle('is-sticky', sticky);
    if (!sticky) stages.forEach(s => s.classList.add('is-active')); else setStage(0);
    if (sticky) { stages.forEach((s, k) => s.classList.toggle('is-active', k === 0)); update(); }
  };
  navBtns.forEach(b => b.addEventListener('click', () => {
    const i = +b.dataset.go, range = track.offsetHeight - $('.show-sticky', track).offsetHeight;
    const top = track.getBoundingClientRect().top + scrollY + (i + 0.5) / stages.length * range;
    scrollTo({ top, behavior: motionOK() ? 'smooth' : 'auto' });
  }));

  /* ---------- One rAF-throttled scroll handler: header, progress, parallax, showcase ---------- */
  const px = $$('.px');
  let ticking = false;
  function update() {
    ticking = false;
    const y = scrollY, h = document.documentElement.scrollHeight - innerHeight;
    header.classList.toggle('is-solid', y > 24);
    header.style.setProperty('--p', h > 0 ? clamp(y / h, 0, 1).toFixed(4) : 0);
    if (motionOK() && y < innerHeight * 1.6) px.forEach(el => el.style.transform = `translate3d(0, ${(y * parseFloat(el.dataset.depth)).toFixed(1)}px, 0)`);
    if (sticky) {
      const r = track.getBoundingClientRect(), range = track.offsetHeight - $('.show-sticky', track).offsetHeight;
      const p = clamp(-r.top / range, 0, 0.9999);
      track.style.setProperty('--sp', p.toFixed(3));
      setStage(Math.floor(p * stages.length));
    }
  }
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  stickyMq.addEventListener('change', syncSticky);
  reduceMq.addEventListener('change', () => { syncSticky(); if (!motionOK()) px.forEach(el => { el.style.transform = ''; }); });
  syncSticky(); update();

  /* ---------- Inquiry form: client-side validation only ---------- */
  const form = $('#inquiry'), status = $('#form-status');
  const rules = {
    name: v => v.trim().length > 1,
    email: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()),
    school: v => v.trim().length > 1
  };
  const check = input => {
    const ok = rules[input.name](input.value);
    input.setAttribute('aria-invalid', String(!ok));
    $('#err-' + input.name).hidden = ok;
    return ok;
  };
  Object.keys(rules).forEach(n => {
    const input = form.elements[n];
    input.addEventListener('blur', () => { if (input.value || input.getAttribute('aria-invalid')) check(input); });
    input.addEventListener('input', () => { if (input.getAttribute('aria-invalid') === 'true') check(input); });
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const bad = Object.keys(rules).map(n => form.elements[n]).filter(i => !check(i));
    if (bad.length) { status.textContent = ''; bad[0].focus(); return; }
    status.textContent = 'Looks good. Nothing was sent: connect a form backend to receive real requests.';
    form.reset();
  });
})();
