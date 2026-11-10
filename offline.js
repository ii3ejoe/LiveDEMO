/**
 * Iowa Neighbor — connection mode + offline resource save
 * Offline: bold red + last saved date; warn if date !== today
 * Online: bold green + live date
 */
(function () {
  const STORAGE_KEY = 'in_offline_bundle';
  const DATE_KEY = 'in_offline_saved_at';
  const CACHE_NAME = 'iowa-neighbor-offline-v2';

  function todayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function formatDisplayDate(iso) {
    try {
      const d = iso ? new Date(iso) : new Date();
      return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return iso || '';
    }
  }

  function normalizeResourceList(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.resources)) return data.resources;
    return [];
  }

  function readMeta() {
    try {
      const at = localStorage.getItem(DATE_KEY);
      const raw = localStorage.getItem(STORAGE_KEY);
      let resources = [];
      if (raw) {
        const parsed = JSON.parse(raw);
        resources = normalizeResourceList(parsed.resources != null ? parsed : parsed);
        if (!resources.length && parsed && Array.isArray(parsed)) resources = parsed;
      }
      return { at: at, hasData: resources.length > 0, count: resources.length, resources: resources };
    } catch (e) {
      return { at: null, hasData: false, count: 0, resources: [] };
    }
  }

  function resourceJsonUrls() {
    const base = (document.querySelector('base') && document.querySelector('base').href) || (location.origin + location.pathname.replace(/\/[^/]*$/, '/'));
    return [
      'data/resources.json',
      './data/resources.json',
      '/data/resources.json',
      '../data/resources.json',
      new URL('data/resources.json', location.href).href,
      new URL('./data/resources.json', location.href).href
    ];
  }

  async function fetchResourcesForSave() {
    // 1) In-memory list from app (after page load)
    if (typeof window.allResources !== 'undefined' && Array.isArray(window.allResources) && window.allResources.length) {
      return window.allResources;
    }
    // 2) Offline API if already saved (re-save)
    if (window.IowaNeighborOffline && typeof window.IowaNeighborOffline.getSavedResources === 'function') {
      const prev = window.IowaNeighborOffline.getSavedResources();
      if (Array.isArray(prev) && prev.length) return prev;
    }
    // 3) Network / cache fetch — try several paths (Cloudflare root vs nested)
    let lastErr = null;
    for (const url of resourceJsonUrls()) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          const list = normalizeResourceList(data);
          if (list.length) return list;
        } else {
          lastErr = new Error('HTTP ' + res.status + ' ' + url);
        }
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('Could not load resources to save');
  }

  function ensureUI() {
    // status button is created by inject or exists
  }

  function getPop() {
    return document.getElementById('conn-popover');
  }

  function renderPopBody() {
    const pop = getPop();
    if (!pop) return;
    const body = pop.querySelector('.conn-pop-body') || pop;
    const online = navigator.onLine !== false;
    const meta = readMeta();
    const savedLabel = meta.at ? formatDisplayDate(meta.at) : 'Never saved';

    if (online) {
      body.innerHTML =
        '<p class="conn-state online"><span class="conn-dot"></span> <strong>Online</strong></p>' +
        '<p>Live date: <strong>' + formatDisplayDate() + '</strong></p>' +
        (meta.hasData
          ? '<p class="conn-muted">Offline copy on this device: <strong>' + meta.count + ' resources</strong> · ' + savedLabel + '</p>'
          : '<p class="conn-muted">No offline copy saved on this device yet.</p>') +
        '<div class="conn-pop-actions">' +
        '<button type="button" class="btn btn-primary" id="conn-save-btn">' +
        (meta.hasData ? 'Update offline copy' : 'Save for offline viewing') +
        '</button>' +
        (meta.hasData ? '<button type="button" class="btn btn-outline" id="conn-clear-btn">Remove offline copy</button>' : '') +
        '</div>' +
        '<p class="conn-muted" style="font-size:0.8rem;margin-top:0.5rem">Tip: Stay online, wait for the page to finish loading, then save once. You should see a resource count after a successful save.</p>';
    } else {
      const savedDay = meta.at ? meta.at.slice(0, 10) : null;
      const outdated = !savedDay || savedDay !== todayKey();
      body.innerHTML =
        '<p class="conn-state offline"><span class="conn-dot"></span> <strong>Offline</strong></p>' +
        '<p>Using the <strong>same</strong> saved copy of resources' +
        (meta.at ? ' from <strong>' + savedLabel + '</strong>.' : ' (none found on this device).') + '</p>' +
        (meta.hasData
          ? '<p class="conn-muted"><strong>' + meta.count + ' resources</strong> on this device. Click Search to show them.</p>'
          : '<p class="conn-muted">No saved copy. Go online and use <strong>Save for offline viewing</strong>.</p>') +
        (outdated && meta.hasData ? '<p class="conn-warn">Saved date is not today — data may be outdated.</p>' : '') +
        '<div class="conn-pop-actions">' +
        '<button type="button" class="btn btn-primary" id="conn-got-it">Got it</button>' +
        '<button type="button" class="btn btn-outline" id="conn-retry">Try again when online</button>' +
        '</div>';
    }

    const saveBtn = document.getElementById('conn-save-btn');
    if (saveBtn) saveBtn.addEventListener('click', saveOffline);
    const clearBtn = document.getElementById('conn-clear-btn');
    if (clearBtn) clearBtn.addEventListener('click', clearOffline);
    const got = document.getElementById('conn-got-it');
    if (got) got.addEventListener('click', function () { pop.hidden = true; });
    const retry = document.getElementById('conn-retry');
    if (retry) {
      retry.addEventListener('click', function () {
        if (navigator.onLine) {
          location.reload();
        } else {
          retry.textContent = 'Still offline';
          setTimeout(function () { retry.textContent = 'Try again when online'; }, 1500);
        }
      });
    }
  }

  async function saveOffline() {
    const saveBtn = document.getElementById('conn-save-btn');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';
    }
    try {
      const data = await fetchResourcesForSave();
      if (!data || !data.length) throw new Error('Resource list is empty — wait for the page to load, or Search once online, then save again.');

      const payload = {
        savedAt: new Date().toISOString(),
        resources: data,
        count: data.length,
        version: (window.IOWA_NEIGHBOR_VERSION || '')
      };
      const serialized = JSON.stringify(payload);
      try {
        localStorage.setItem(STORAGE_KEY, serialized);
        localStorage.setItem(DATE_KEY, payload.savedAt);
      } catch (quotaErr) {
        throw new Error('Could not save on this device (storage full or blocked). Free space or try desktop.');
      }

      // Verify write
      const check = readMeta();
      if (!check.hasData || check.count < 1) {
        throw new Error('Save did not stick — try again');
      }

      // Cache core shell + data for airplane mode
      if ('caches' in window) {
        try {
          const cache = await caches.open(CACHE_NAME);
          const urls = [
            './', './index.html', './styles.css', './app.js', './offline.js', './version.js',
            './pwa.js', './faq.html', './about.html', './support.html', './feedback.html',
            './share-resource.html', './manifest.json',
            './data/resources.json', 'data/resources.json',
            './assets/defaults/food-meals.svg', './assets/defaults/other.svg',
            './assets/defaults/shelter.svg', './assets/defaults/housing.svg',
            './assets/defaults/healthcare.svg', './assets/defaults/family.svg'
          ];
          await Promise.all(urls.map(function (u) {
            return cache.add(new Request(u, { cache: 'reload' })).catch(function () {
              return cache.add(u).catch(function () {});
            });
          }));
        } catch (e) { /* ignore cache errors */ }
      }

      if (saveBtn) {
        saveBtn.textContent = 'Saved · ' + check.count + ' resources';
        setTimeout(function () {
          saveBtn.disabled = false;
          renderPopBody();
        }, 1200);
      }
      updateStatus();
    } catch (err) {
      console.warn('saveOffline', err);
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save failed — try again';
        saveBtn.title = (err && err.message) ? err.message : 'Save failed';
      }
      const pop = getPop();
      if (pop) {
        const body = pop.querySelector('.conn-pop-body') || pop;
        const note = document.createElement('p');
        note.className = 'conn-warn';
        note.textContent = (err && err.message) ? err.message : 'Save failed';
        body.appendChild(note);
      }
    }
  }

  function clearOffline() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(DATE_KEY);
    } catch (e) { /* ignore */ }
    renderPopBody();
    updateStatus();
  }

  function updateStatus() {
    const btn = document.getElementById('conn-status-btn');
    if (!btn) return;
    const online = navigator.onLine !== false;
    const meta = readMeta();
    const dateEl = btn.querySelector('.conn-date');
    btn.classList.toggle('is-offline', !online);
    btn.classList.toggle('is-online', online);
    if (online) {
      btn.innerHTML = '<span class="conn-dot"></span> <strong>Online</strong> <span class="conn-date">' + formatDisplayDate() + '</span>';
      btn.title = 'Online loads the shared list. Save a copy for offline. Clearing page cache does not remove your offline save.';
    } else {
      btn.innerHTML = '<span class="conn-dot"></span> <strong>Offline</strong> <span class="conn-date">' + (meta.at ? formatDisplayDate(meta.at) : 'No save') + '</span>';
      btn.title = meta.hasData
        ? ('Offline — ' + meta.count + ' saved resources. Click Search to show them.')
        : 'Offline — no saved copy on this device.';
    }
  }

  function injectChrome() {
    // Prefer header-top-strip, then header-actions
    let host = document.querySelector('.header-top-strip .header-actions') ||
               document.querySelector('.header-top-strip') ||
               document.querySelector('.header-actions');
    if (!host) return;

    if (!document.getElementById('conn-status-btn')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'conn-status-btn';
      btn.className = 'conn-status-btn is-online';
      btn.setAttribute('aria-expanded', 'false');
      host.insertBefore(btn, host.firstChild);
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const pop = document.getElementById('conn-popover');
        if (!pop) return;
        const open = pop.hidden;
        pop.hidden = !open;
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) renderPopBody();
      });
    }

    if (!document.getElementById('conn-popover')) {
      const pop = document.createElement('div');
      pop.id = 'conn-popover';
      pop.className = 'conn-mode-pop';
      pop.hidden = true;
      pop.innerHTML = '<div class="conn-pop-card"><div class="conn-pop-head"><strong>Connection mode</strong><button type="button" class="conn-pop-close" aria-label="Close">×</button></div><div class="conn-pop-body"></div></div>';
      document.body.appendChild(pop);
      pop.querySelector('.conn-pop-close').addEventListener('click', function () { pop.hidden = true; });
      document.addEventListener('click', function (e) {
        if (!pop.hidden && !pop.contains(e.target) && e.target.id !== 'conn-status-btn') {
          pop.hidden = true;
        }
      });
    }

    // Add to home / shortcut button if missing
    if (!document.getElementById('btn-a2hs') && host) {
      // pwa.js may own this — skip if present elsewhere
    }
  }

  // Public API for app.js
  window.IowaNeighborOffline = {
    getSavedResources: function () {
      return readMeta().resources;
    },
    getSavedAt: function () {
      return localStorage.getItem(DATE_KEY);
    },
    hasSavedCopy: function () {
      return readMeta().hasData;
    },
    saveOffline: saveOffline
  };

  function onNetworkChange() {
    updateStatus();
    const pop = document.getElementById('conn-popover');
    if (pop && !pop.hidden) renderPopBody();
  }

  document.addEventListener('DOMContentLoaded', function () {
    injectChrome();
    updateStatus();
    window.addEventListener('online', onNetworkChange);
    window.addEventListener('offline', onNetworkChange);
  });
})();
