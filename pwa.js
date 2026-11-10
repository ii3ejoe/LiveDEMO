/**
 * Add to Home Screen / shortcut — restored simple flow
 */
(function () {
  var deferredPrompt = null;

  // Register SW immediately (same pattern that worked before)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(function () {});
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
  });

  function isMobile() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
  }
  function isIOS() {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent || '') ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function label() {
    return isMobile() ? 'Add to Home Screen' : 'Add a Shortcut';
  }

  function ensureBtn() {
    if (document.getElementById('pwa-install-btn')) return;
    var host = document.querySelector('.header-top-strip .header-actions') ||
               document.querySelector('.header-actions');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'pwa-install-btn';
    btn.className = 'pwa-install-btn';
    btn.textContent = label();
    if (host) {
      var conn = document.getElementById('conn-status-btn');
      if (conn && conn.parentNode === host) host.insertBefore(btn, conn.nextSibling);
      else host.appendChild(btn);
    } else {
      document.body.appendChild(btn);
    }
    btn.addEventListener('click', openPop);
  }

  function ensurePop() {
    if (document.getElementById('pwa-install-pop')) return;
    var pop = document.createElement('div');
    pop.id = 'pwa-install-pop';
    pop.className = 'pwa-install-pop';
    pop.hidden = true;
    pop.innerHTML =
      '<div class="pwa-pop-card">' +
      '<div class="pwa-pop-head"><strong>' + label() + '</strong>' +
      '<button type="button" class="pwa-pop-close" aria-label="Close">×</button></div>' +
      '<div class="pwa-pop-body">' +
      '<p>Optional shortcut on this device. Not from Google Play or the App Store.</p>' +
      '<div id="pwa-steps"></div></div>' +
      '<div class="pwa-pop-actions">' +
      '<button type="button" class="btn btn-outline" id="pwa-no">Not now</button>' +
      '<button type="button" class="btn btn-primary" id="pwa-yes">Yes, continue</button></div>' +
      '<p id="pwa-hint" class="pwa-hint" hidden></p></div>';
    document.body.appendChild(pop);
    pop.querySelector('.pwa-pop-close').onclick = closePop;
    document.getElementById('pwa-no').onclick = closePop;
    document.getElementById('pwa-yes').onclick = onYes;
  }

  function steps() {
    if (isIOS()) {
      return '<ol class="pwa-steps"><li>Tap <strong>Share</strong> (□ with arrow).</li>' +
        '<li>Tap <strong>Add to Home Screen</strong>.</li><li>Tap <strong>Add</strong>.</li></ol>';
    }
    if (/Android/i.test(navigator.userAgent || '')) {
      return '<ol class="pwa-steps">' +
        '<li>Tap <strong>Yes, continue</strong> for the install popup if Chrome shows it.</li>' +
        '<li>Or tap <strong>⋮</strong> → scroll for <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>' +
        '<li>Or <strong>Share…</strong> → <strong>Add to Home screen</strong>.</li></ol>';
    }
    return '<ol class="pwa-steps"><li>Click Yes for the install popup.</li>' +
      '<li>Or use the install icon in the address bar / browser menu.</li></ol>';
  }

  function openPop() {
    ensurePop();
    document.getElementById('pwa-steps').innerHTML = steps();
    var h = document.getElementById('pwa-hint');
    if (h) { h.hidden = true; h.textContent = ''; }
    document.getElementById('pwa-install-pop').hidden = false;
  }
  function closePop() {
    var p = document.getElementById('pwa-install-pop');
    if (p) p.hidden = true;
  }

  async function onYes() {
    var hint = document.getElementById('pwa-hint');
    if (deferredPrompt) {
      deferredPrompt.prompt();
      var choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (hint) {
        hint.hidden = false;
        hint.textContent = choice.outcome === 'accepted' ? 'Added to this device.' : 'Dismissed — try ⋮ → Install app.';
      }
      if (choice.outcome === 'accepted') closePop();
      return;
    }
    if (hint) {
      hint.hidden = false;
      hint.innerHTML = isIOS()
        ? 'Use <strong>Share → Add to Home Screen</strong> (required on iPhone).'
        : 'No popup yet. Use <strong>⋮ → Install app</strong> (scroll the menu) or <strong>Share → Add to Home screen</strong>.';
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    ensureBtn();
    ensurePop();
  });
})();
