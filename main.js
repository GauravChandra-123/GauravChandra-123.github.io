/* Theme toggle (dark/light) */
(function(){
  const root = document.documentElement;
  const key = 'gc_theme';

  function apply(theme){
    if(theme === 'light') root.setAttribute('data-theme','light');
    else root.removeAttribute('data-theme');
    const icon = document.querySelector('#themeIcon');
    if(icon) icon.textContent = theme === 'light' ? '☀' : '☾';
  }

  const stored = localStorage.getItem(key);
  if(stored){
    apply(stored);
  }else{
    const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    apply(prefersLight ? 'light' : 'dark');
  }

  const toggle = document.querySelector('#themeToggle');
  toggle?.addEventListener('click', () => {
    const current = root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    const next = current === 'light' ? 'dark' : 'light';
    if(next === 'light') root.setAttribute('data-theme','light');
    else root.removeAttribute('data-theme');
    localStorage.setItem(key, next);
    apply(next);
  });
})();

/* Year */
document.getElementById('year')?.append(String(new Date().getFullYear()));

/* Scroll reveal with small stagger */
(function(){
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      // Add on enter, remove on leave so the animation plays both when
      // scrolling down and when scrolling back up.
      if(e.isIntersecting) e.target.classList.add('in');
      else e.target.classList.remove('in');
    });
  }, {threshold: 0.18, rootMargin: '0px 0px -10% 0px'});

  function observeAll(){
    const items = Array.from(document.querySelectorAll('.reveal'));
    items.forEach((el, i) => {
      if(!el.style.getPropertyValue('--d')){
        const delay = el.getAttribute('data-delay');
        if(delay) el.style.setProperty('--d', delay + 'ms');
        else el.style.setProperty('--d', (i % 6) * 60 + 'ms');
      }

      if(el.dataset.observed === '1') return;
      el.dataset.observed = '1';
      io.observe(el);
    });
  }

  observeAll();

  window.addEventListener('gc:reveal:refresh', observeAll);
})();

/* GitHub projects (auto-fetch repos) */
(function(){
  const host = document.getElementById('projectsList');
  if(!host) return;

  const USER = 'GauravChandra-123';
  const API = `https://api.github.com/users/${USER}/repos?per_page=100&sort=updated`;

  function escapeHtml(str){
    return (str || '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function badge(text){
    return `<span class="badge">${escapeHtml(text)}</span>`;
  }

  function card(repo, delay){
    const desc = repo.description ? escapeHtml(repo.description) : 'No description yet.';
    const lang = repo.language ? badge(repo.language) : '';
    const stars = repo.stargazers_count ? badge(`★ ${repo.stargazers_count}`) : '';
    const updated = repo.pushed_at ? new Date(repo.pushed_at).toLocaleDateString(undefined, {year:'numeric', month:'short'}) : '';

    return `
      <article class="card project reveal" data-delay="${delay}">
        <a class="title" href="${repo.html_url}" target="_blank" rel="noopener">${escapeHtml(repo.name)}</a>
        <p>${desc}</p>
        <div class="meta">
          ${lang}${stars}${updated ? badge(`Updated ${updated}`) : ''}${repo.fork ? badge('Fork') : ''}
        </div>
      </article>
    `;
  }

  async function load(){
    try{
      const res = await fetch(API, {headers: { 'Accept': 'application/vnd.github+json' }});
      if(!res.ok) throw new Error('GitHub request failed');
      const repos = (await res.json())
        .filter(r => !r.archived)
        .sort((a,b) => new Date(b.pushed_at) - new Date(a.pushed_at));

      if(!repos.length){
        host.innerHTML = `<div class="card project reveal"><a class="title" href="https://github.com/${USER}" target="_blank" rel="noopener">No repositories found</a><p>Add a repo on GitHub and it will appear here automatically.</p></div>`;
        return;
      }

      // Show all repos, but keep it fast: render first 12 and let user expand.
      const first = repos.slice(0, 12);
      const rest = repos.slice(12);

      let html = first.map((r, i) => card(r, i * 60)).join('');

      if(rest.length){
        html += `
          <div class="reveal" data-delay="120" style="display:flex; gap:10px; flex-wrap:wrap; margin-top:10px">
            <button class="btn" type="button" id="showAllRepos">Show all ${repos.length} projects</button>
            <a class="btn btn--primary" href="https://github.com/${USER}?tab=repositories" target="_blank" rel="noopener">Browse on GitHub</a>
          </div>
          <div id="allRepos" style="display:none; margin-top:12px">
            ${rest.map((r, i) => card(r, (i % 6) * 60)).join('')}
          </div>
        `;
      }

      host.innerHTML = html;

      // Re-bind reveal observer for dynamically injected nodes
      window.dispatchEvent(new Event('gc:reveal:refresh'));

      document.getElementById('showAllRepos')?.addEventListener('click', () => {
        const all = document.getElementById('allRepos');
        if(!all) return;
        all.style.display = all.style.display === 'none' ? 'block' : 'none';
        window.dispatchEvent(new Event('gc:reveal:refresh'));
      });
    }catch(_){
      host.innerHTML = `
        <div class="card project reveal">
          <a class="title" href="https://github.com/${USER}" target="_blank" rel="noopener">Open GitHub projects</a>
          <p>Couldn’t load the repo list right now (GitHub rate-limit or network). You can still view everything on GitHub.</p>
        </div>
      `;
    }
  }

  load();
})();

/* Smooth scroll for internal links (keeps URL clean) */
(function(){
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if(!a) return;
    const href = a.getAttribute('href') || '';
    if(!href.startsWith('#') || href.length < 2) return;
    const target = document.querySelector(href);
    if(!target) return;
    e.preventDefault();
    target.scrollIntoView({behavior:'smooth', block:'start'});
    history.replaceState(null, '', href);
  });
})();

/* Active nav + back-to-top */
(function(){
  const links = Array.from(document.querySelectorAll('.nav__links a'));
  const map = new Map(links.map(a => [a.getAttribute('href'), a]));
  const navStrip = document.querySelector('.nav__links');
  const sections = links
    .map(a => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);

  let lastActive = null;
  let ensureTimer = null;
  let lastUserScrollAt = 0;

  // Mark when the user is actively scrolling so we don't fight their scroll.
  const markUserScroll = () => { lastUserScrollAt = Date.now(); };
  window.addEventListener('wheel', markUserScroll, {passive:true});
  window.addEventListener('touchmove', markUserScroll, {passive:true});

  function ensureActiveTabVisible(id){
    if(!navStrip) return;
    const active = map.get(id);
    if(!active) return;

    // If the nav fits, nothing to do.
    if(navStrip.scrollWidth <= navStrip.clientWidth + 2) return;

    const pad = 18;
    const leftEdge = navStrip.scrollLeft + pad;
    const rightEdge = navStrip.scrollLeft + navStrip.clientWidth - pad;

    // Position of the active tab relative to the scroll container.
    const aLeft = active.offsetLeft;
    const aRight = aLeft + active.offsetWidth;

    // Only scroll the nav if the active tab is actually clipped.
    const behavior = (Date.now() - lastUserScrollAt < 250) ? 'auto' : 'smooth';
    if(aLeft < leftEdge){
      const targetLeft = Math.max(0, aLeft - pad);
      navStrip.scrollTo({left: targetLeft, behavior});
    }else if(aRight > rightEdge){
      const targetLeft = Math.min(navStrip.scrollWidth, aRight - navStrip.clientWidth + pad);
      navStrip.scrollTo({left: targetLeft, behavior});
    }
  }

  const ratios = new Map(sections.map(s => [s, 0]));
  const navIO = new IntersectionObserver((entries) => {
    // IntersectionObserver gives only changed entries. We track ratios for all sections
    // and compute the "most visible" section from the full set each time.
    entries.forEach(e => ratios.set(e.target, e.isIntersecting ? e.intersectionRatio : 0));

    let bestSection = null;
    let bestRatio = 0;
    for (const [sec, r] of ratios.entries()){
      if(r > bestRatio){
        bestRatio = r;
        bestSection = sec;
      }
    }
    if(!bestSection) return;

    const id = '#' + bestSection.id;
    links.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === id));

    // Keep the active tab fully visible (prevents the last item getting clipped)
    if(navStrip && id !== lastActive){
      lastActive = id;
      if(ensureTimer) clearTimeout(ensureTimer);
      ensureTimer = setTimeout(() => ensureActiveTabVisible(id), 90);
    }
  }, {threshold:[0, 0.12, 0.22, 0.35, 0.55], rootMargin:'-18% 0px -62% 0px'});

  sections.forEach(s => navIO.observe(s));

  const back = document.querySelector('.backToTop');
  if(back){
    const toggle = () => {
      if(window.scrollY > 520) back.classList.add('show');
      else back.classList.remove('show');
    };
    toggle();
    window.addEventListener('scroll', toggle, {passive:true});
  }

  // Compact header when scrolling to avoid layout shifts/wrapping
  const header = document.querySelector('.header');
  if(header){
    // Use rAF to avoid missing the "back to top" state on fast scrolls.
    let ticking = false;

    function setActive(id){
      links.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === id));
      lastActive = id;
    }

    function resetNavToStart(){
      if(!navStrip) return;
      // Two-step: scroll immediately, then again next frame in case layout shifts
      // (fonts/images) changed scrollWidth.
      navStrip.scrollTo({left: 0, behavior: 'auto'});
      requestAnimationFrame(() => navStrip.scrollTo({left: 0, behavior: 'auto'}));
    }

    function update(){
      const y = window.scrollY || 0;
      header.classList.toggle('is-scrolled', y > 24);

      // Hard reset at the very top so the navbar looks fully arranged
      // and the first tab is visible.
      if(y < 40){
        resetNavToStart();
        if(map.has('#about')) setActive('#about');
      }
    }

    function onScroll(){
      if(ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        update();
      });
    }

    update();
    window.addEventListener('scroll', onScroll, {passive:true});
    window.addEventListener('resize', update);
    // Also reset once after full load to account for late layout changes.
    window.addEventListener('load', () => setTimeout(update, 50));
  }
})();
