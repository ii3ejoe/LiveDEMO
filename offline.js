/**
 * Iowa Neighbor — connection mode (Online / Offline)
 * Top-right control, non-blocking popup, auto network detection.
 * Online: bold green + live date
 * Offline: bold red + last saved date; warn if date !== today
 */
(function () {
  const STORAGE_KEY = 'in_offline_bundle';
  const DATE_KEY = 'in_offline_saved_at';

  function todayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function formatDisplayDate(isoOrDate) {
    const d = isoOrDate ? new Date(isoOrDate) : new Date();
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  function isOnline() {
    return typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
  }

  function getSavedMeta() {
    try {
      const at = localStorage.getItem(DATE_KEY);
      const raw = localStorage.getItem(STORAGE_KEY);
      return { at, hasData: !!(raw && raw.length > 2) };
    } catch (e) {
      return { at: null, hasData: false };
    }
  }

  function ensureUI() {
    if (document.getElementById('conn-status-btn')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'conn-status-btn';
    btn.className = 'conn-status-btn';
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span class="conn-dot"></span><span class="conn-label">Online</span><span class="conn-date"></span>';

    // Prefer header-actions (top-right); else fixed corner
    const actions = document.querySelector('.header-actions');
    if (actions) {
      actions.insertBefore(btn, actions.firstChild);
    } else {
      btn.classList.add('conn-status-fixed');
      document.body.appendChild(btn);
    }

    const pop = document.createElement('div');
    pop.id = 'conn-mode-pop';
    pop.className = 'conn-mode-pop';
    pop.hidden = true;
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', 'Connection mode');
    pop.innerHTML = [
      '<div class="conn-pop-card">',
      '  <div class="conn-pop-head">',
      '    <strong>Connection mode</strong>',
      '    <button type="button" class="conn-pop-close" aria-label="Close">×</button>',
      '  </div>',
      '  <div class="conn-pop-body"></div>',
      '  <div class="conn-pop-actions"></div>',
      '</div>'
    ].join('');
    document.body.appendChild(pop);

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      togglePop();
    });
    pop.querySelector('.conn-pop-close').addEventListener('click', closePop);
    document.addEventListener('click', function (e) {
      if (!pop.hidden && !pop.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
        closePop();
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closePop();
    });
  }

  function togglePop() {
    const pop = document.getElementById('conn-mode-pop');
    const btn = document.getElementById('conn-status-btn');
    if (!pop) return;
    if (pop.hidden) {
      renderPopBody();
      pop.hidden = false;
      btn && btn.setAttribute('aria-expanded', 'true');
    } else {
      closePop();
    }
  }

  function closePop() {
    const pop = document.getElementById('conn-mode-pop');
    const btn = document.getElementById('conn-status-btn');
    if (pop) pop.hidden = true;
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function renderPopBody() {
    const pop = document.getElementById('conn-mode-pop');
    if (!pop) return;
    const body = pop.querySelector('.conn-pop-body');
    const actions = pop.querySelector('.conn-pop-actions');
    const online = isOnline();
    const meta = getSavedMeta();
    const live = formatDisplayDate();
    const savedLabel = meta.at ? formatDisplayDate(meta.at) : 'Never saved';

    if (online) {
      body.innerHTML = [
        '<p class="conn-state online"><span class="conn-dot"></span> <strong>Online</strong></p>',
        '<p>You are online. Resource list updates live from the network when available.</p>',
        '<p><strong>Live date:</strong> ' + live + '</p>',
        meta.hasData
          ? '<p class="conn-muted">Offline copy on this device: ' + savedLabel + '</p>'
          : '<p class="conn-muted">No offline copy saved on this device yet.</p>'
      ].join('');
      actions.innerHTML = [
        '<button type="button" class="btn btn-primary" id="conn-save-btn">Save for offline viewing</button>',
        meta.hasData ? '<button type="button" class="btn btn-outline" id="conn-clear-btn">Remove offline copy</button>' : ''
      ].join('');
      const saveBtn = document.getElementById('conn-save-btn');
      if (saveBtn) saveBtn.addEventListener('click', saveOffline);
      const clearBtn = document.getElementById('conn-clear-btn');
      if (clearBtn) clearBtn.addEventListener('click', clearOffline);
    } else {
      const savedDay = meta.at ? meta.at.slice(0, 10) : null;
      const outdated = !savedDay || savedDay !== todayKey();
      body.innerHTML = [
        '<p class="conn-state offline"><span class="conn-dot"></span> <strong>Offline</strong></p>',
        '<p>Using the <strong>same</strong> saved copy of resources' +
          (meta.at ? ' from <strong>' + savedLabel + '</strong>.' : ' (none found on this device).') + '</p>',
        outdated
          ? '<div class="conn-warn" role="status">Database may be outdated — last update is not today’s date.</div>'
          : '<p class="conn-muted">Saved copy is from today.</p>'
      ].join('');
      actions.innerHTML = [
        '<button type="button" class="btn btn-primary" id="conn-gotit-btn">Got it</button>',
        '<button type="button" class="btn btn-outline" id="conn-retry-btn">Try again when online</button>'
      ].join('');
      const got = document.getElementById('conn-gotit-btn');
      if (got) got.addEventListener('click', closePop);
      const retry = document.getElementById('conn-retry-btn');
      if (retry) {
        retry.addEventListener('click', function () {
          updateStatus();
          if (isOnline()) {
            renderPopBody();
          } else {
            retry.textContent = 'Still offline';
            setTimeout(function () { retry.textContent = 'Try again when online'; }, 1500);
          }
        });
      }
    }
  }

  async function saveOffline() {
    const saveBtn = document.getElementById('conn-save-btn');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';
    }
    try {
      let data = null;
      // Prefer in-memory resources from app.js if present
      if (typeof window.allResources !== 'undefined' && Array.isArray(window.allResources) && window.allResources.length) {
        data = window.allResources;
      } else {
        const res = await fetch('../data/resources.json', { cache: 'no-store' });
        if (res.ok) data = await res.json();
      }
      if (!data) throw new Error('Could not load resources to save');
      const payload = {
        savedAt: new Date().toISOString(),
        resources: data,
        version: (window.IOWA_NEIGHBOR_VERSION || '')
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      localStorage.setItem(DATE_KEY, payload.savedAt);
      // Best-effort cache of core pages (no hard failure)
      if ('caches' in window) {
        try {
          const cache = await caches.open('iowa-neighbor-offline-v1');
          await cache.addAll([
            './index.html',
            './styles.css',
            './app.js',
            './offline.js',
            './version.js',
            './about.html',
            './support.html',
            './assets/defaults/food-meals.svg',
            './assets/defaults/other.svg'
          ].map(function (u) { return new Request(u, { cache: 'reload' }); })).catch(function () {});
        } catch (e) { /* ignore */ }
      }
      if (saveBtn) {
        saveBtn.textContent = 'Saved';
        setTimeout(function () {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save for offline viewing';
          renderPopBody();
        }, 900);
      }
      updateStatus();
    } catch (err) {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save failed — try again';
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
    ensureUI();
    const btn = document.getElementById('conn-status-btn');
    if (!btn) return;
    const label = btn.querySelector('.conn-label');
    const dateEl = btn.querySelector('.conn-date');
    const online = isOnline();
    const meta = getSavedMeta();

    btn.classList.toggle('is-online', online);
    btn.classList.toggle('is-offline', !online);

    if (online) {
      if (label) label.textContent = 'Online';
      if (dateEl) dateEl.textContent = formatDisplayDate();
      btn.title = "Online loads the shared list; offline shows the last copy you saved on this device so you're not left with nothing. Clearing only the page cache does not remove your offline save — use Remove offline copy for that. (Browser “Clear site data” for this site can still erase everything.)" + ' Live date: ' + formatDisplayDate();
    } else {
      if (label) label.textContent = 'Offline';
      if (dateEl) dateEl.textContent = meta.at ? formatDisplayDate(meta.at) : 'No save';
      btn.title = "Online loads the shared list; offline shows the last copy you saved on this device so you're not left with nothing. Clearing only the page cache does not remove your offline save — use Remove offline copy for that. (Browser “Clear site data” for this site can still erase everything.)" + (meta.at ? ' Last saved: ' + formatDisplayDate(meta.at) : ' No saved copy yet.');
    }

    // Expose for app.js to load offline resources
    window.IowaNeighborOffline = {
      hasOfflineCopy: function () {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (!raw) return false;
          const parsed = JSON.parse(raw);
          return !!(parsed && Array.isArray(parsed.resources) && parsed.resources.length);
        } catch (e) { return false; }
      },
      isOnline: isOnline,
      getSavedResources: function () {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (!raw) return null;
          const parsed = JSON.parse(raw);
          return parsed.resources || null;
        } catch (e) {
          return null;
        }
      },
      getSavedAt: function () {
        return localStorage.getItem(DATE_KEY);
      }
    };
  }

  function onNetworkChange() {
    updateStatus();
    const pop = document.getElementById('conn-mode-pop');
    if (pop && !pop.hidden) renderPopBody();
  }

  document.addEventListener('DOMContentLoaded', function () {
    ensureUI();
    updateStatus();
    window.addEventListener('online', onNetworkChange);
    window.addEventListener('offline', onNetworkChange);
  });
})();
