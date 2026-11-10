/**
 * Optional Add to Home Screen (PWA) — not forced.
 * Online/Offline control lives in offline.js.
 */
(function () {
  let deferredPrompt = null;

  function installButtonLabel() {
    const ua = navigator.userAgent || '';
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    return isMobile ? 'Add to Home Screen' : 'Add a Shortcut';
  }


  function ensureInstallBtn() {
    if (document.getElementById('pwa-install-btn')) return;
    const actions = document.querySelector('.header-top-strip .header-actions') || document.querySelector('.header-actions');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'pwa-install-btn';
    btn.className = 'pwa-install-btn';
    btn.textContent = installButtonLabel();
    btn.title = 'Optional — add a shortcut on this device';
    if (actions) {
      // place after connection status if present
      const conn = document.getElementById('conn-status-btn');
      if (conn && conn.parentNode === actions) {
        actions.insertBefore(btn, conn.nextSibling);
      } else {
        actions.insertBefore(btn, actions.firstChild);
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
      '    <p class="pwa-muted">This does <strong>not</strong> use the Apple App Store or Google Play. It uses your browser’s built-in “Add to Home Screen” feature.</p>',
      '    <p class="pwa-muted">Works with the Online / Offline control: save a copy while online, then use it when offline.</p>',
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
    document.addEventListener('click', function (e) {
      if (!pop.hidden && !pop.contains(e.target) && e.target.id !== 'pwa-install-btn') closePop();
    });
  }

  function openInstallPop() {
    ensurePop();
    const pop = document.getElementById('pwa-install-pop');
    const hint = document.getElementById('pwa-hint');
    if (hint) { hint.hidden = true; hint.textContent = ''; }
    pop.hidden = false;
  }

  function closePop() {
    const pop = document.getElementById('pwa-install-pop');
    if (pop) pop.hidden = true;
  }

  async function onYes() {
    const hint = document.getElementById('pwa-hint');
    // Chrome/Edge install prompt when available
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (hint) {
        hint.hidden = false;
        hint.textContent = choice.outcome === 'accepted'
          ? 'Shortcut install was accepted.'
          : 'Install was dismissed. You can try again later.';
      }
      if (choice.outcome === 'accepted') closePop();
      return;
    }
    // iOS / browsers without beforeinstallprompt
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (hint) {
      hint.hidden = false;
      if (isIOS) {
        hint.innerHTML = 'On iPhone/iPad: tap the <strong>Share</strong> button, then <strong>Add to Home Screen</strong>.';
      } else {
        hint.innerHTML = 'Use your browser menu: <strong>Install app</strong> or <strong>Add to Home Screen</strong>. (Prompt not available in this browser yet.)';
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
