/**
 * Add to Home Screen — always provides a working path.
 * We cannot force Chrome's install sheet; we always show real steps.
 */
(function () {
  var deferredPrompt = null;

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js', { scope: './' }).then(function (reg) {
        console.info('[IN] SW registered', reg.scope);
      }).catch(function (err) {
        console.warn('[IN] SW register failed', err);
      });
    });
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    var btn = document.getElementById('pwa-install-btn');
    if (btn) {
      btn.setAttribute('data-prompt-ready', '1');
      btn.textContent = installButtonLabel() + ' ✓';
    }
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    var hint = document.getElementById('pwa-hint');
    if (hint) {
      hint.hidden = false;
      hint.textContent = 'Added to this device. Check your home screen.';
    }
  });

  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent || '') ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function isAndroid() {
    return /android/i.test(navigator.userAgent || '');
  }
  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      window.navigator.standalone === true;
  }
  function installButtonLabel() {
    if (isIOS() || isAndroid()) return 'Add to Home Screen';
    return 'Add a Shortcut';
  }

  function stepsHtml() {
    if (isStandalone()) {
      return '<p class="pwa-ok"><strong>Already on your home screen</strong> — you are using the installed version.</p>';
    }
    if (isIOS()) {
      return [
        '<p><strong>On iPhone / iPad (Safari)</strong></p>',
        '<ol class="pwa-steps">',
        '<li>Tap the <strong>Share</strong> button (□↑).</li>',
        '<li>Scroll and tap <strong>Add to Home Screen</strong>.</li>',
        '<li>Tap <strong>Add</strong>.</li>',
        '</ol>'
      ].join('');
    }
    if (isAndroid()) {
      return [
        '<p><strong>On Android (Chrome)</strong></p>',
        '<ol class="pwa-steps">',
        '<li>Tap <strong>Install now</strong> below if it appears.</li>',
        '<li>Or tap the menu <strong>⋮</strong> at the top right.</li>',
        '<li><strong>Scroll down</strong> in that menu — look for <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>',
        '<li>If you only see <strong>Share…</strong>, tap Share, then look for <strong>Add to Home screen</strong> / <strong>Install</strong>.</li>',
        '<li>Confirm with Install or Add.</li>',
        '</ol>',
        '<p class="pwa-muted">Stay on this site over HTTPS (your live demo link). Open the site once while online, wait a few seconds, then try the menu again.</p>'
      ].join('');
    }
    return [
      '<p><strong>On computer</strong></p>',
      '<ol class="pwa-steps">',
      '<li>Click <strong>Install now</strong> if shown.</li>',
      '<li>Or use the install icon in the address bar.</li>',
      '<li>Or browser menu → <strong>Install Iowa Neighbor</strong>.</li>',
      '</ol>'
    ].join('');
  }

  function ensureInstallBtn() {
    if (document.getElementById('pwa-install-btn')) return;
    var actions = document.querySelector('.header-top-strip .header-actions') ||
                  document.querySelector('.header-actions');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'pwa-install-btn';
    btn.className = 'pwa-install-btn';
    btn.textContent = installButtonLabel();
    if (actions) {
      var conn = document.getElementById('conn-status-btn');
      if (conn && conn.parentNode === actions) actions.insertBefore(btn, conn.nextSibling);
      else actions.appendChild(btn);
    } else {
      btn.classList.add('pwa-install-fixed');
      document.body.appendChild(btn);
    }
    btn.addEventListener('click', openInstallPop);
  }

  function ensurePop() {
    if (document.getElementById('pwa-install-pop')) return;
    var pop = document.createElement('div');
    pop.id = 'pwa-install-pop';
    pop.className = 'pwa-install-pop';
    pop.hidden = true;
    pop.innerHTML =
      '<div class="pwa-pop-card">' +
      '  <div class="pwa-pop-head"><strong id="pwa-pop-title">Add to Home Screen</strong>' +
      '  <button type="button" class="pwa-pop-close" aria-label="Close">×</button></div>' +
      '  <div class="pwa-pop-body">' +
      '    <p>Optional shortcut icon. Does <strong>not</strong> use Google Play or the App Store.</p>' +
      '    <div id="pwa-steps-wrap"></div>' +
      '  </div>' +
      '  <div class="pwa-pop-actions">' +
      '    <button type="button" class="btn btn-outline" id="pwa-no">Not now</button>' +
      '    <button type="button" class="btn btn-primary" id="pwa-yes">Install now</button>' +
      '  </div>' +
      '  <p id="pwa-hint" class="pwa-hint" hidden></p>' +
      '</div>';
    document.body.appendChild(pop);
    pop.querySelector('.pwa-pop-close').addEventListener('click', closePop);
    document.getElementById('pwa-no').addEventListener('click', closePop);
    document.getElementById('pwa-yes').addEventListener('click', onYes);
  }

  function openInstallPop() {
    ensurePop();
    var pop = document.getElementById('pwa-install-pop');
    document.getElementById('pwa-steps-wrap').innerHTML = stepsHtml();
    document.getElementById('pwa-pop-title').textContent = installButtonLabel();
    var hint = document.getElementById('pwa-hint');
    if (hint) { hint.hidden = true; hint.innerHTML = ''; }
    var yes = document.getElementById('pwa-yes');
    if (yes) {
      yes.style.display = isStandalone() ? 'none' : '';
      yes.textContent = deferredPrompt ? 'Install now' : 'Show steps';
    }
    pop.hidden = false;
  }

  function closePop() {
    var pop = document.getElementById('pwa-install-pop');
    if (pop) pop.hidden = true;
  }

  async function onYes() {
    var hint = document.getElementById('pwa-hint');
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        var choice = await deferredPrompt.userChoice;
        deferredPrompt = null;
        if (hint) {
          hint.hidden = false;
          hint.textContent = choice.outcome === 'accepted'
            ? 'Installed — check your home screen.'
            : 'Dismissed. Use the numbered steps above (⋮ menu → scroll for Install app).';
        }
        if (choice.outcome === 'accepted') setTimeout(closePop, 600);
        return;
      } catch (e) { deferredPrompt = null; }
    }
    if (hint) {
      hint.hidden = false;
      if (isAndroid()) {
        hint.innerHTML = 'Automatic popup is not available right now. Tap <strong>⋮</strong>, <strong>scroll the whole menu</strong>, and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>. Or Share → Add to Home screen.';
      } else if (isIOS()) {
        hint.innerHTML = 'On iPhone use <strong>Share → Add to Home Screen</strong>. Apps are not allowed to do this automatically.';
      } else {
        hint.innerHTML = 'Use the install icon in the address bar, or the browser menu → Install app.';
      }
    }
    document.getElementById('pwa-steps-wrap').innerHTML = stepsHtml();
  }

  document.addEventListener('DOMContentLoaded', function () {
    ensureInstallBtn();
    ensurePop();
  });
})();
