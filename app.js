/* Iowa Neighbor V4.1 frontend – OpenStreetMap + Leaflet
 *
 * Multi-state skeleton: when expanding, set ACTIVE_STATE and use STATES[code].
 * Branding becomes "{State} Neighbor" (e.g. Minnesota Neighbor).
 * Non-IA blocks stay commented until that state launches.
 */
const SITE_CONFIG = {
  ACTIVE_STATE: "IA",
  STATES: {
    IA: {
      brand: "Iowa Neighbor",
      defaultLocation: "Des Moines, IA (50309)",
      mapCenter: [41.5868, -93.6250],
      mapZoom: 11,
      resourcesUrl: "resources.json",  // or "../data/resources.json"
    },
    // MN: {
    //   brand: "Minnesota Neighbor",
    //   defaultLocation: "Minneapolis, MN (55401)",
    //   mapCenter: [44.9778, -93.2650],
    //   mapZoom: 11,
    //   resourcesUrl: "resources-mn.json",
    // },
    // IL: {
    //   brand: "Illinois Neighbor",
    //   defaultLocation: "Chicago, IL (60601)",
    //   mapCenter: [41.8781, -87.6298],
    //   mapZoom: 11,
    //   resourcesUrl: "resources-il.json",
    // },
  },
};
const STATE = SITE_CONFIG.STATES[SITE_CONFIG.ACTIVE_STATE];

/** Default category thumbnails when source has no image_url */
const CATEGORY_DEFAULT_IMAGES = {
  'Food & Meals': 'assets/defaults/food-meals.svg',
  'Housing Assistance': 'assets/defaults/housing.svg',
  'Shelter': 'assets/defaults/shelter.svg',
  'Healthcare': 'assets/defaults/healthcare.svg',
  'Family & Children': 'assets/defaults/family.svg',
  'Other Resources': 'assets/defaults/other.svg',
};
const TAG_DEFAULT_IMAGES = {
  'Food Pantry': 'assets/defaults/food-meals.svg',
  'Meal Program': 'assets/defaults/food-meals.svg',
  'Shelter': 'assets/defaults/shelter.svg',
  'Housing Assistance': 'assets/defaults/housing.svg',
};

/** Fallback chain for card thumbnails:
 *  1) image_url from source page (if crawler found one)
 *  2) free OpenStreetMap static map (if lat/lng known)
 *  3) category default SVG
 *  4) other.svg (onerror in <img>)
 */
function categoryDefaultFor(r) {
  const cats = r.categories || [];
  for (const c of cats) {
    if (CATEGORY_DEFAULT_IMAGES[c]) return CATEGORY_DEFAULT_IMAGES[c];
  }
  const tags = r.tags || [];
  for (const tg of tags) {
    if (TAG_DEFAULT_IMAGES[tg]) return TAG_DEFAULT_IMAGES[tg];
  }
  const blob = (cats.join(' ') + ' ' + tags.join(' ')).toLowerCase();
  if (blob.includes('food') || blob.includes('meal') || blob.includes('pantry')) return CATEGORY_DEFAULT_IMAGES['Food & Meals'];
  if (blob.includes('shelter')) return CATEGORY_DEFAULT_IMAGES['Shelter'];
  if (blob.includes('hous')) return CATEGORY_DEFAULT_IMAGES['Housing Assistance'];
  if (blob.includes('health') || blob.includes('medical')) return CATEGORY_DEFAULT_IMAGES['Healthcare'];
  if (blob.includes('family') || blob.includes('child')) return CATEGORY_DEFAULT_IMAGES['Family & Children'];
  return CATEGORY_DEFAULT_IMAGES['Other Resources'];
}

function osmStaticMapUrl(lat, lng) {
  // Free OSM static map (no Google). Marker at resource location.
  return 'https://staticmap.openstreetmap.de/staticmap.php?center=' +
    lat + ',' + lng + '&zoom=16&size=400x300&maptype=mapnik&markers=' +
    lat + ',' + lng + ',lightblue1';
}

function defaultImageFor(r) {
  // Prefer reliable local category art first (staticmap.openstreetmap.de is often down).
  // 1) Category / tag default SVG (always local, never broken)
  // 2) Optional source image_url only if it looks like a real http(s) image
  // 3) other.svg via onerror
  const cat = categoryDefaultFor(r);
  if (r.image_url && /^https?:\/\//i.test(r.image_url) && !/staticmap\.openstreetmap/i.test(r.image_url)) {
    return r.image_url;
  }
  return cat;
}



const DATA_URLS = ['./data/resources.json', '../data/resources.json'];
async function loadResourcesJson() {
  let lastErr = null;
  for (const url of DATA_URLS) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) return await res.json();
      lastErr = new Error('HTTP ' + res.status + ' for ' + url);
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('Could not load resources');
}
let allResources = [], filtered = [], map = null, markersLayer = null;

function readSavedOfflineResources() {
  if (window.IowaNeighborOffline && typeof window.IowaNeighborOffline.getSavedResources === 'function') {
    const saved = window.IowaNeighborOffline.getSavedResources();
    return Array.isArray(saved) ? saved : [];
  }
  try {
    const raw = localStorage.getItem('in_offline_bundle');
    const parsed = raw ? JSON.parse(raw) : null;
    return (parsed && Array.isArray(parsed.resources)) ? parsed.resources : [];
  } catch (err) {
    return [];
  }
}

/** True browser offline: do NOT hit local server or network — only saved copy (demo-honest). */
function isBrowserOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

document.addEventListener('DOMContentLoaded', async () => {
  const offlineHint = document.getElementById('offline-empty-hint');
  allResources = [];
  filtered = [];

  if (isBrowserOffline()) {
    // Airplane mode / offline: ignore localhost JSON so demo is not "always full"
    allResources = readSavedOfflineResources();
    if (offlineHint) {
      offlineHint.hidden = false;
      offlineHint.textContent = allResources.length
        ? 'Offline — showing the same saved copy on this device. Click Search to display it.'
        : 'Offline — no saved copy on this device. Go online, Search, then Save for offline viewing.';
    }
  } else {
    try {
      allResources = await loadResourcesJson();
      if (offlineHint) offlineHint.hidden = true;
    } catch (e) {
      console.warn('Could not load resources.json', e);
      allResources = readSavedOfflineResources();
      if (offlineHint) {
        offlineHint.hidden = false;
        offlineHint.textContent = allResources.length
          ? 'Could not reach the host — showing the same saved copy on this device.'
          : 'Could not load resources. Check that RUNME is running, or go online.';
      }
    }
  }

  window.allResources = allResources;
  initMap();
  bindEvents();
  // Do NOT auto-fill results — wait until user clicks Search (clearer demo, not "hardcoded dump")
  showWaitingForSearch();
});

function showWaitingForSearch() {
  const list = document.getElementById('results-list');
  const count = document.getElementById('result-count');
  const rq = document.getElementById('result-query');
  if (count) count.textContent = '0';
  if (rq) rq.textContent = '—';
  if (list) {
    list.innerHTML = '<div style="padding:2rem;text-align:center;color:#64748b">Click <strong>Search</strong> to load resources for this area. Results stay empty until you search.</div>';
  }
  if (typeof markersLayer !== 'undefined' && markersLayer) markersLayer.clearLayers();
}

function initMap() {
  const el = document.getElementById('map');
  if (!el) return;
  if (typeof L === 'undefined') {
    el.innerHTML = '<p style="padding:1rem;color:#64748b;font-size:0.9rem">Map library did not load. Check internet connection (OpenStreetMap tiles need network).</p>';
    return;
  }
  map = L.map(el, { zoomControl: true }).setView([41.5868, -93.6250], 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    crossOrigin: true
  }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
  map.on('popupopen', (e) => {
    const a = e.popup.getElement()?.querySelector('.popup-detail');
    if (a) a.addEventListener('click', (ev) => {
      ev.preventDefault();
      openDetail(a.getAttribute('data-id'));
    });
  });
}



function directionsUrl(lat, lng, address) {
  // Prefer OS default maps app via geo: (Android) / Apple Maps daddr (iOS-friendly).
  // Fallback: OpenStreetMap web directions (free, no Google).
  const label = encodeURIComponent(address || (lat + ',' + lng));
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS) {
    return 'https://maps.apple.com/?daddr=' + lat + ',' + lng + '&q=' + label;
  }
  // geo: opens the default maps app on most Android devices
  return 'geo:' + lat + ',' + lng + '?q=' + lat + ',' + lng + '(' + label + ')';
}

function osmDirectionsUrl(lat, lng) {
  const to = encodeURIComponent(lat + ',' + lng);
  return 'https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=%3B' + to + '#map=16/' + lat + '/' + lng;
}

function mapPinUrl(lat, lng) {
  return 'https://www.openstreetmap.org/?mlat=' + lat + '&mlon=' + lng + '#map=17/' + lat + '/' + lng;
}

function updateMap(resources) {
  markersLayer.clearLayers();
  const bounds = [];
  resources.forEach(r => {
    if (r.lat == null || r.lng == null) return;
    const marker = L.circleMarker([r.lat, r.lng], {
      radius: 8, fillColor: '#0d9488', color: '#fff', weight: 2, opacity: 1, fillOpacity: 0.9
    });
    const dir = directionsUrl(r.lat, r.lng);
    marker.bindPopup(`<strong>${esc(r.name)}</strong><br>${esc(r.full_address||'')}<br>${r.phone?esc(r.phone)+'<br>':''}<a href="#" class="popup-detail" data-id="${esc(r.id)}">View details</a> · <a href="${dir}" target="_blank" rel="noopener">Directions</a>`);
    markersLayer.addLayer(marker);
    bounds.push([r.lat, r.lng]);
  });
  if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
  else if (bounds.length === 1) map.setView(bounds[0], 13);
}

function applyFilters() {
  const catSel = document.getElementById('filter-category');
  const catHero = document.getElementById('category-select');
  const cat = (catSel && catSel.value) || (catHero && catHero.value) || '';
  const checkedTypes = [...document.querySelectorAll('#service-type-filters input:checked')].map(el => el.value);
  const sort = document.getElementById('sort-select').value;
  // Update results meta (never hardcode "food pantry")
  const rq = document.getElementById('result-query');
  if (rq) {
    if (checkedTypes.length) rq.textContent = checkedTypes.join(', ');
    else if (cat) rq.textContent = cat;
    else rq.textContent = 'all categories';
  }
  filtered = allResources.filter(r => {
    if (cat && !(r.categories || []).includes(cat)) return false;

  // Public site: hide pending imports until verified (legacy rows with no status still show)
  filtered = filtered.filter(function (r) {
    var st = (r.verification_status || '').toLowerCase();
    if (!st) return true;
    if (st === 'pending' || st === 'needs review' || st === 'unverified' || st === 'needs_review') return false;
    return true;
  });
    if (checkedTypes.length) {
      const tags = r.tags || [], cats = r.categories || [];
      const hit = checkedTypes.some(t => tags.includes(t) || cats.includes(t) || (t === 'Other Services' && !tags.length));
      if (!hit) return false;
    }
    return true;
  });
  filtered.sort((a, b) => {
    if (sort === 'confidence') return (b.evidence_confidence||0) - (a.evidence_confidence||0);
    if (sort === 'name') return (a.name||'').localeCompare(b.name||'');
    return (b.evidence_confidence||0) - (a.evidence_confidence||0);
  });
  renderResults();
  updateMap(filtered);
}

function renderResults() {
  const list = document.getElementById('results-list');
  document.getElementById('result-count').textContent = filtered.length;
  if (!filtered.length) {
    list.innerHTML = '<div style="padding:2rem;text-align:center;color:#64748b">No resources match your filters.</div>';
    return;
  }
  list.innerHTML = filtered.map(r => cardHTML(r)).join('');
}

function cardHTML(r) {
  const conf = r.evidence_confidence || 50;
  const confClass = conf >= 80 ? 'high' : conf >= 55 ? 'mid' : 'low';
  const statusClass = (r.verification_status || '').toLowerCase().includes('verified') ? 'verified' : 'review';
  const statusLabel = r.verification_status || 'Unverified';
  const tags = (r.tags || []).map(t => {
    const cls = t.toLowerCase().includes('food') ? 'food' : t.toLowerCase().includes('shelter') ? 'shelter' : '';
    return `<span class="tag ${cls}">${esc(t)}</span>`;
  }).join('');
  const cats = (r.categories || []).map(c => `<span class="tag">${esc(c)}</span>`).join('');
  const lastChecked = r.last_checked
    ? new Date(r.last_checked).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';
  return `
  <article class="resource-card" id="card-${r.id}">
    <div class="card-thumb">
      ${(() => {
        const src = defaultImageFor(r);
        const cat = categoryDefaultFor(r);
        return `<img src="${esc(src)}" alt="" loading="lazy" data-cat="${esc(cat)}" onerror="const c=this.getAttribute('data-cat'); if(c && !this.dataset.triedCat){this.dataset.triedCat='1'; this.src=c;} else {this.onerror=null; this.src='assets/defaults/other.svg';}" />`;
      })()}
    </div>
    <div class="card-body">
      <div class="card-tags">${userSubmittedBadge(r)}${cats}${tags}</div>
      <h3>${esc(r.name)}</h3>
      <div class="card-meta">
        ${r.full_address ? `<span>📍 ${esc(r.full_address)}</span>` : ''}
        ${r.phone ? `<span>📞 ${esc(r.phone)}</span>` : ''}
        ${r.hours ? `<span>🕒 ${esc(r.hours)}</span>` : ''}
      </div>
      ${r.description ? `<p class="card-desc">${esc(r.description)}</p>` : ''}
    </div>
    <div class="card-side">
      <span class="badge-status ${statusClass}">${statusClass === 'verified' ? '✓' : '○'} ${esc(statusLabel)}</span>
      <div class="confidence">
        <div class="confidence-label"><span>Evidence Confidence</span><span>${conf}%</span></div>
        <div class="confidence-bar"><div class="confidence-fill ${confClass}" style="width:${conf}%"></div></div>
      </div>
      <div class="meta-line">📅 Last Checked: ${lastChecked}</div>
      <div class="meta-line">📄 Source: ${esc(r.source || 'Website')}</div>
      <div class="meta-line">👤 Eligibility: ${esc(r.eligibility || 'Varies')}</div>
      <button type="button" class="view-details" data-id="${esc(r.id)}">View Details →</button>
    </div>
  </article>`;
}


let detailMap = null;

function openDetail(id) {
  const r = allResources.find(x => x.id === id);
  if (!r) return;
  let modal = document.getElementById('detail-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'detail-modal';
    modal.className = 'detail-modal';
    modal.innerHTML = '<div class="detail-backdrop" data-close></div><div class="detail-panel" role="dialog" aria-modal="true"><button type="button" class="detail-close" data-close aria-label="Close">×</button><div id="detail-content"></div></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
      if (e.target.hasAttribute('data-close')) closeDetail();
    });
  }
  const hasGeo = r.lat != null && r.lng != null;
  const dir = hasGeo ? directionsUrl(r.lat, r.lng, r.full_address) : '#';
  const pin = hasGeo ? mapPinUrl(r.lat, r.lng) : '#';
  const lastCheckedDetail = r.last_checked
    ? new Date(r.last_checked).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';
  document.getElementById('detail-content').innerHTML = `
    <h2>${esc(r.name)}</h2>
    <div class="card-tags" style="margin-bottom:0.75rem">${userSubmittedBadge(r)}${(r.categories||[]).map(c=>'<span class="tag">'+esc(c)+'</span>').join('')}${(r.tags||[]).map(t=>'<span class="tag">'+esc(t)+'</span>').join('')}</div>
    <div class="card-meta" style="margin-bottom:0.75rem">
      ${r.full_address && pubOn(r,'address') ? '<span>📍 '+esc(r.full_address)+'</span>' : ''}
      ${r.phone && pubOn(r,'phone') ? '<span>📞 '+esc(r.phone)+'</span>' : ''}
      ${r.hours && pubOn(r,'hours') ? '<span>🕒 '+esc(r.hours)+'</span>' : ''}
    </div>
    ${r.description && pubOn(r,'description') ? '<p class="card-desc">'+esc(r.description)+'</p>' : ''}
    ${r.requirements && pubOn(r,'requirements') ? '<div class="detail-requirements" style="margin:0.75rem 0;padding:0.75rem 1rem;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px"><strong>Requirements</strong><p style="margin:0.35rem 0 0;color:#9a3412">'+esc(r.requirements)+'</p></div>' : ''}
    ${ (r.tags && r.tags.length) ? '<p class="meta-line">Tags: '+r.tags.map(function(t){return esc(t)}).join(', ')+'</p>' : '' }
    <p class="meta-line">Eligibility: ${esc(r.eligibility||'Varies')} · Source: ${esc(r.source||r.source_name||'Website')}</p>
    <div id="detail-map" class="detail-map" aria-label="Map showing resource location"></div>
    <div class="detail-actions">
      ${hasGeo ? '<a class="btn btn-primary" href="'+dir+'">Get directions</a>' : ''}
      ${hasGeo ? '<a class="btn btn-outline" href="'+osmDirectionsUrl(r.lat,r.lng)+'" target="_blank" rel="noopener">Directions in browser (OSM)</a>' : ''}
      ${hasGeo ? '<a class="btn btn-outline" href="'+pin+'" target="_blank" rel="noopener">Open in OpenStreetMap</a>' : ''}
      ${r.website ? '<a class="btn btn-outline" href="'+esc(r.website)+'" target="_blank" rel="noopener">Website</a>' : ''}
      <button type="button" class="btn btn-outline" id="detail-print-btn">Save a copy to share or print</button>
    </div>
    ${!hasGeo ? '<p class="support-note">No coordinates yet — directions unavailable.</p>' : ''}
    <p class="detail-verified-foot">Information verified by Iowa Neighbor · Last updated ${lastCheckedDetail}</p>
  `;
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  const printBtn = document.getElementById('detail-print-btn');
  if (printBtn) printBtn.addEventListener('click', function () { printResourceSummary(r); });

  // Leaflet detail map
  setTimeout(() => {
    const el = document.getElementById('detail-map');
    if (!el || !hasGeo) return;
    if (detailMap) { detailMap.remove(); detailMap = null; }
    detailMap = L.map(el, { zoomControl: true }).setView([r.lat, r.lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(detailMap);
    L.circleMarker([r.lat, r.lng], {
      radius: 10, fillColor: '#0d9488', color: '#fff', weight: 2, fillOpacity: 0.95
    }).addTo(detailMap).bindPopup(esc(r.name)).openPopup();
    setTimeout(() => detailMap.invalidateSize(), 100);
  }, 50);
}

function closeDetail() {
  const modal = document.getElementById('detail-modal');
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
  if (detailMap) { detailMap.remove(); detailMap = null; }
}


function bindEvents() {
  document.getElementById('search-btn').addEventListener('click', () => {
    document.getElementById('filter-location').value = document.getElementById('location-input').value;
    document.getElementById('filter-category').value = document.getElementById('category-select').value;
    const q = document.getElementById('location-input').value || STATE.defaultLocation;
    document.getElementById('result-location').textContent = q;
    const catLabel = document.getElementById('category-select').value || 'all categories';
    const rq = document.getElementById('result-query');
    if (rq) rq.textContent = catLabel === 'all' || !catLabel ? 'all categories' : catLabel;
    applyFilters();
    document.getElementById('results').scrollIntoView({ behavior: 'smooth' });
  });
  document.getElementById('sort-select').addEventListener('change', applyFilters);
  document.getElementById('filter-category').addEventListener('change', applyFilters);
  document.getElementById('filter-location').addEventListener('change', applyFilters);
  document.querySelectorAll('#service-type-filters input').forEach(el => el.addEventListener('change', applyFilters));
  document.getElementById('clear-filters').addEventListener('click', () => {
    document.getElementById('filter-category').value = '';
    document.getElementById('category-select').value = '';
    document.querySelectorAll('#service-type-filters input').forEach(el => { el.checked = false; });
    applyFilters();
  });
  document.querySelectorAll('.cat-card').forEach(card => {
    card.addEventListener('click', () => {
      const cat = card.dataset.cat;
      document.getElementById('category-select').value = cat;
      document.getElementById('filter-category').value = cat;
      applyFilters();
      document.getElementById('results').scrollIntoView({ behavior: 'smooth' });
    });
  });
  document.getElementById('view-map-btn').addEventListener('click', () => {
    document.getElementById('map').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  document.getElementById('results-list').addEventListener('click', (e) => {
    const btn = e.target.closest('.view-details');
    if (btn && btn.dataset.id) openDetail(btn.dataset.id);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDetail(); });
}


function pubOn(r, key) {
  const pf = r.public_fields;
  if (!pf) return true;
  if (pf[key] === false) return false;
  return true;
}

function userSubmittedBadge(r) {
  const tags = (r.tags || []).map(t => String(t).toLowerCase());
  if (!tags.includes('user-submitted') && !tags.includes('user submitted')) return '';
  return '<span class="user-submitted-badge" title="Community or partner submitted — verify before referring">' +
    '<span class="usb-icon" aria-hidden="true">IN</span> User submitted</span>';
}

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}


/* Future-proof: state select is in the DOM but hidden.
   When launching MN/IL, uncomment STATES entries, remove [hidden] on
   .state-select-wrap, and this handler will switch brand + map defaults. */
function initStateSelect() {
  const sel = document.getElementById('state-select');
  if (!sel) return;
  sel.value = SITE_CONFIG.ACTIVE_STATE;
  sel.addEventListener('change', () => {
    const code = sel.value;
    if (!SITE_CONFIG.STATES[code]) return;
    SITE_CONFIG.ACTIVE_STATE = code;
    const next = SITE_CONFIG.STATES[code];
    document.querySelectorAll('.brand').forEach(el => { el.textContent = next.brand; });
    const loc = document.getElementById('location-input');
    const floc = document.getElementById('filter-location');
    if (loc) loc.value = next.defaultLocation;
    if (floc) floc.value = next.defaultLocation;
    // Optional: reload resources from next.resourcesUrl and re-center map
    // loadResources(next.resourcesUrl);
  });
}


if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initStateSelect);
} else {
  initStateSelect();
}


/** One-page summary — browser print / Save as PDF. Neutral open-project wording. */
function printResourceSummary(r) {
  let el = document.getElementById('print-summary');
  if (!el) {
    el = document.createElement('div');
    el.id = 'print-summary';
    document.body.appendChild(el);
  }
  const last = r.last_checked
    ? new Date(r.last_checked).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';
  const cats = (r.categories || []).join(', ') || '—';
  const tags = (r.tags || []).join(', ');
  el.innerHTML = `
    <h1 style="font-size:1.35rem;margin:0 0 0.5rem">${esc(r.name)}</h1>
    <p style="margin:0 0 0.75rem;color:#334155"><strong>Categories:</strong> ${esc(cats)}</p>
    ${r.full_address ? '<p style="margin:0.25rem 0"><strong>Address:</strong> ' + esc(r.full_address) + '</p>' : ''}
    ${r.phone ? '<p style="margin:0.25rem 0"><strong>Phone:</strong> ' + esc(r.phone) + '</p>' : ''}
    ${r.hours ? '<p style="margin:0.25rem 0"><strong>Hours:</strong> ' + esc(r.hours) + '</p>' : ''}
    ${r.website ? '<p style="margin:0.25rem 0"><strong>Website:</strong> ' + esc(r.website) + '</p>' : ''}
    ${r.description ? '<p style="margin:0.75rem 0">' + esc(r.description) + '</p>' : ''}
    ${r.requirements ? '<p style="margin:0.75rem 0;padding:0.6rem;border:1px solid #fdba74;background:#fff7ed"><strong>Requirements:</strong> ' + esc(r.requirements) + '</p>' : ''}
    <p style="margin:0.5rem 0"><strong>Eligibility:</strong> ${esc(r.eligibility || 'Varies')}</p>
    ${tags ? '<p style="margin:0.35rem 0"><strong>Tags:</strong> ' + esc(tags) + '</p>' : ''}
    <hr style="margin:1rem 0;border:none;border-top:1px solid #cbd5e1" />
    <p style="font-size:0.9rem;color:#475569">From Iowa Neighbor — community resource directory. Always verify with the organization before referring.</p>
    <p style="font-size:0.85rem;color:#64748b">Source: ${esc(r.source || r.source_name || 'Website')} · Last updated: ${esc(last)}</p>
    <p style="font-size:0.8rem;color:#94a3b8">Open project. Information may change.</p>
  `;
  window.print();
}
