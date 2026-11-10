/**
 * Optional Add to Home Screen (PWA) — not forced.
 * Online/Offline control lives in offline.js.
 * Install steps restored (Android / iOS / desktop).
 */
(function () {
  let deferredPrompt = null;

  function installButtonLabel() {
    const ua = navigator.userAgent || '';
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    return isMobile ? 'Add to Home Screen' : 'Add a Shortcut';
  }

  function isIOS() {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent || '') ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function isAndroid() {
    return /Android/i.test(navigator.userAgent || '');
  }

  function stepsHtml() {
    if (isIOS()) {
      return '<p><strong>iPhone / iPad</strong></p><ol class="pwa-steps">' +
        '<li>Tap <strong>Share</strong> (square with arrow).</li>' +
        '<li>Tap <strong>Add to Home Screen</strong>.</li>' +
        '<li>Tap <strong>Add</strong>.</li></ol>';
    }
    if (isAndroid()) {
      return '<p><strong>Android</strong></p><ol class="pwa-steps">' +
        '<li>Tap <strong>Yes, continue</strong> — if Chrome shows Install, accept it.</li>' +
        '<li>Or tap <strong>⋮</strong> and <strong>scroll the full menu</strong> for <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>' +
        '<li>If install was blocked earlier: clear site data for this site, reload online, try again.</li></ol>' +
        '<p class="pwa-muted">Share is for sending the link; Install is usually under the <strong>⋮</strong> menu.</p>';
    }
    return '<p><strong>Computer</strong></p><ol class="pwa-steps">' +
      '<li>Click <strong>Yes, continue</strong> for the install popup.</li>' +
      '<li>Or use the install icon in the address bar / browser menu → Install app.</li></ol>';
  }

  function ensureInstallBtn() {
    if (document.getElementById('pwa-install-btn')) return;
    const actions = document.querySelector('.header-top-strip .header-actions') ||
                    document.querySelector('.header-actions');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'pwa-install-btn';
    btn.className = 'pwa-install-btn';
    btn.textContent = installButtonLabel();
    btn.title = 'Optional — add a shortcut on this device';
    if (actions) {
      const conn = document.getElementById('conn-status-btn');
      if (conn && conn.parentNode === actions) {
        actions.insertBefore(btn, conn.nextSibling);
      } else {
        actions.appendChild(btn);
      }
    } else {
      btn.classList.add('pwa-install-fixed');
      document.body.appendChild(btn);
    }
    btn.addEventListener('click', openInstallPop);
  }

  function ensurePop() {
    if (document.getElementById('pwa-install-pop')) return;
    const pop = document.createElement('div');
    pop.id = 'pwa-install-pop';
    pop.className = 'pwa-install-pop';
    pop.hidden = true;
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', installButtonLabel());
    pop.innerHTML = [
      '<div class="pwa-pop-card">',
      '  <div class="pwa-pop-head">',
      '    <strong>' + installButtonLabel() + '</strong>',
      '    <button type="button" class="pwa-pop-close" aria-label="Close">×</button>',
      '  </div>',
      '  <div class="pwa-pop-body">',
      '    <p>This is <strong>optional</strong>. You can keep using Iowa Neighbor in your browser anytime.</p>',
      '    <p>Adding to the home screen creates a shortcut icon and can open the site in a simple app-style window.</p>',
      '    <p class="pwa-muted">This does <strong>not</strong> use the Apple App Store or Google Play.</p>',
      '    <p class="pwa-muted">Works with Online / Offline: save a copy while online, then use it offline.</p>',
      '    <div id="pwa-steps-wrap"></div>',
      '  </div>',
      '  <div class="pwa-pop-actions">',
      '    <button type="button" class="btn btn-outline" id="pwa-no">No</button>',
      '    <button type="button" class="btn btn-primary" id="pwa-yes">Yes, continue</button>',
      '  </div>',
      '  <p id="pwa-hint" class="pwa-hint" hidden></p>',
      '</div>'
    ].join('');
    document.body.appendChild(pop);
    pop.querySelector('.pwa-pop-close').addEventListener('click', closePop);
    document.getElementById('pwa-no').addEventListener('click', closePop);
    document.getElementById('pwa-yes').addEventListener('click', onYes);
  }

  function openInstallPop() {
    ensurePop();
    const pop = document.getElementById('pwa-install-pop');
    const wrap = document.getElementById('pwa-steps-wrap');
    const hint = document.getElementById('pwa-hint');
    if (wrap) wrap.innerHTML = stepsHtml();
    if (hint) { hint.hidden = true; hint.textContent = ''; }
    pop.hidden = false;
  }

  function closePop() {
    const pop = document.getElementById('pwa-install-pop');
    if (pop) pop.hidden = true;
  }

  async function onYes() {
    const hint = document.getElementById('pwa-hint');
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (hint) {
        hint.hidden = false;
        hint.textContent = choice.outcome === 'accepted'
          ? 'Added — check your home screen or app list.'
          : 'Dismissed. You can use the steps above anytime.';
      }
      if (choice.outcome === 'accepted') closePop();
      return;
    }
    if (hint) {
      hint.hidden = false;
      if (isIOS()) {
        hint.innerHTML = 'Use <strong>Share → Add to Home Screen</strong> (required on iPhone).';
      } else if (isAndroid()) {
        hint.innerHTML = 'No automatic popup right now. Use <strong>⋮ → Install app</strong> (scroll the menu). Clear site data for this site if it still does not appear, then reload online.';
      } else {
        hint.innerHTML = 'No popup yet. Check the address bar install icon or browser menu → Install app.';
      }
    }
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
  });

  document.addEventListener('DOMContentLoaded', function () {
    ensureInstallBtn();
    ensurePop();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    }
  });
})();
