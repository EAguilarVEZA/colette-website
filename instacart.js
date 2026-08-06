// Runs on Instacart-powered stores: Publix (instacart.com) and Restaurant Depot
// (member.restaurantdepot.com). It adds items ONE AT A TIME across page loads.
//
// The reliable way to add the RIGHT product is an exact product URL. On a product
// page the MAIN product's button reads exactly "Add to cart" — every other "Add"
// button on the page ("Add 1 ct <name>") belongs to a RELATED/carousel item and
// must be ignored. We click only the main "Add to cart" button, so we can never
// add the wrong item. If a line has no URL we fall back to search (top result).
//
// Quantity: after adding, Instacart shows a compact "N in cart" control whose
// stepper is a hover/portal widget that is unreliable to script. We add the item
// (qty 1, correct product guaranteed) and then make a BEST-EFFORT attempt to raise
// the quantity. Getting the right item is the priority; qty can be nudged by hand.
(function () {
  const isInstacart = location.host.includes('instacart.com');
  const STORE_KEY = isInstacart ? 'order_instacart' : 'order_rd';
  const RUN_KEY = 'run_' + STORE_KEY;
  const LABEL = isInstacart ? 'Publix' : 'Restaurant Depot';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Base path for search URLs. On /store/<slug>/... use that; on a /products page
  // with ?retailerSlug=publix derive it from the query param.
  function storeBase() {
    const m = location.pathname.match(/^(\/store\/[^/]+)/);
    if (m) return m[1];
    const rs = new URLSearchParams(location.search).get('retailerSlug');
    if (rs) return '/store/' + rs;
    return '';
  }

  const isProduct = () => /\/products\//.test(location.pathname);
  const isSearch = () => /\/s(\/|$)/.test(location.pathname) || location.search.includes('k=');
  const buttons = () => [...document.querySelectorAll('button')];
  const norm = (b) => (b.getAttribute('aria-label') || b.innerText || '').trim();

  // The main product's add button: text/aria is EXACTLY "Add to cart".
  const mainAddBtn = () => buttons().find((b) => /^add to cart$/i.test(norm(b)));
  // Already-in-cart indicator on the main product ("1 in cart", "2 in cart"...).
  const inCartBtn = () => buttons().find((b) => /\b\d+\s+in cart\b/i.test((b.innerText || '')));
  // Search-result / RD fallback: the first "Add" button on a results page.
  const firstResultAdd = () => buttons().find((b) => /^add\b/i.test((b.getAttribute('aria-label') || b.innerText || '').trim()));
  // The quantity control after adding is a DROPDOWN (combobox) whose listbox
  // (#quantity-dropdown) holds options 1..9 (option-N) plus "Remove". We open it
  // and pick option-N. This is the real Instacart mechanism (RD + Publix).
  const qtyCombo = () => document.querySelector('[role="combobox"][aria-controls="quantity-dropdown"]')
    || buttons().find((b) => /\b\d+\s+in cart\b/i.test((b.innerText || '')));

  const searchUrl = (q) => storeBase() + '/s?k=' + encodeURIComponent(q);
  // Where to send the browser for a line: exact product URL if provided, else search.
  const target = (line) => {
    if (line.url) {
      if (line.url.startsWith('http')) return line.url;      // full URL (preferred)
      if (line.url.startsWith('/')) return line.url;          // absolute path
      return storeBase() + '/products/' + line.url;           // bare product id
    }
    return searchUrl(line.name);
  };

  const setBanner = (t) => { const b = document.getElementById('colette-fill-btn'); if (b) b.textContent = t; };
  const getRun = async () => (await chrome.storage.local.get(RUN_KEY))[RUN_KEY];
  const saveRun = (r) => chrome.storage.local.set({ [RUN_KEY]: r });

  // Set the quantity to `qty` via the dropdown. The item is already in the cart at
  // qty 1 after "Add to cart", so we only act for qty >= 2. Dropdown supports 1..9;
  // for larger orders we set 9 (the max the dropdown offers) as a safe ceiling.
  // Never throws — if the dropdown can't be found the item stays at qty 1.
  async function setQty(qty) {
    const target = Math.max(1, Math.min(9, qty || 1));
    if (target < 2) return;
    for (let attempt = 0; attempt < 2; attempt++) {
      const combo = qtyCombo();
      if (!combo) return;
      combo.click();
      await sleep(700);
      // Prefer the option by id (option-N); fall back to matching option text.
      let opt = document.getElementById('option-' + target);
      if (!opt) {
        const box = document.getElementById('quantity-dropdown') || document.querySelector('[role="listbox"]');
        if (box) opt = [...box.querySelectorAll('[role="option"],li,button')].find((o) => (o.innerText || '').trim() === String(target));
      }
      if (opt) { opt.click(); await sleep(1200); return; }
      // Dropdown didn't open as expected; close and retry once.
      document.body.click(); await sleep(400);
    }
  }

  // Add the main product on the current product page. Returns true if added or
  // already present. NEVER clicks a carousel "Add 1 ct <name>" button.
  async function addMainProduct(line) {
    const add = mainAddBtn();
    if (add) { add.click(); await sleep(1600); await setQty(line.qty); return true; }
    if (inCartBtn()) { await setQty(line.qty); return true; } // already in cart
    return false;
  }

  async function advance(run) {
    run.i++;
    if (run.i >= run.lines.length) {
      run.active = false; await saveRun(run); setBanner('✓ Done — review cart');
      const missed = (run.missed || []);
      alert(`Colette: added ${run.lines.length - missed.length}/${run.lines.length} items to ${LABEL}. Review your cart.` +
        (missed.length ? `\n\nNot found: ${missed.join(', ')}` : ''));
      return;
    }
    await saveRun(run);
    location.href = target(run.lines[run.i]);
  }

  async function resume() {
    const run = await getRun();
    if (!run || !run.active) return;
    const line = run.lines[run.i];
    setBanner(`Adding ${run.i + 1}/${run.lines.length}: ${line.name || 'item'}`);

    if (line.url) {
      // Exact product URL — add the main product here (right item guaranteed).
      await sleep(2600);
      const ok = await addMainProduct(line);
      if (!ok) (run.missed = run.missed || []).push(line.name || line.url);
      await advance(run);
    } else if (isSearch() && !isProduct()) {
      // Search fallback (no URL): add the top result.
      await sleep(2600);
      const add = firstResultAdd();
      if (!add) { (run.missed = run.missed || []).push(line.name); return advance(run); }
      add.click();
      await sleep(1600);
      if (!isProduct()) { await setQty(line.qty); await advance(run); }
      // (RD navigates to the product page on Add → handled by the branch below.)
    } else if (isProduct()) {
      // Arrived at a product page from a search result (RD). Ensure it's added.
      await sleep(1600);
      await addMainProduct(line);
      await advance(run);
    }
  }

  async function start() {
    const o = (await chrome.storage.local.get(STORE_KEY))[STORE_KEY];
    if (!o || !o.lines || !o.lines.length) {
      alert(`No Colette ${LABEL} order found.\n\nOpen the Colette supplier sheet, set quantities, click "Send to ${LABEL}", then press this button.`);
      return;
    }
    await saveRun({ active: true, i: 0, lines: o.lines, missed: [] });
    location.href = target(o.lines[0]);
  }

  const POS_KEY = 'btnpos_' + STORE_KEY;
  const VER = '7';
  function addButton() {
    let existing = document.getElementById('colette-fill-btn');
    if (existing && existing.dataset.coletteV === VER) return; // already ours
    // Take over: strip any old copy's listeners/style by replacing the node.
    const b = document.createElement('button');
    b.id = 'colette-fill-btn';
    b.dataset.coletteV = VER;
    if (existing) existing.replaceWith(b); else document.body.appendChild(b);
    b.textContent = `🥖 Fill ${LABEL} cart (drag me)`;
    Object.assign(b.style, {
      position: 'fixed', top: '70px', right: '16px', zIndex: 2147483647,
      background: '#c99a3b', color: '#1a1206', border: '2px solid #1a1206', borderRadius: '22px',
      padding: '12px 18px', fontWeight: '700', cursor: 'grab', fontFamily: 'sans-serif',
      boxShadow: '0 3px 14px rgba(0,0,0,.35)', userSelect: 'none',
    });
    // Restore a saved position if the user dragged it before.
    try { const p = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
      if (p) { b.style.top = p.top + 'px'; b.style.left = p.left + 'px'; b.style.right = 'auto'; b.style.bottom = 'auto'; }
    } catch (e) {}
    // Drag to reposition; a real click (no drag) triggers the fill.
    let dragging = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0;
    b.addEventListener('mousedown', (e) => {
      dragging = true; moved = false; sx = e.clientX; sy = e.clientY;
      const r = b.getBoundingClientRect(); ox = r.left; oy = r.top; b.style.cursor = 'grabbing'; e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
      b.style.left = (ox + dx) + 'px'; b.style.top = (oy + dy) + 'px'; b.style.right = 'auto'; b.style.bottom = 'auto';
    });
    window.addEventListener('mouseup', () => {
      if (!dragging) return; dragging = false; b.style.cursor = 'grab';
      if (moved) { const r = b.getBoundingClientRect(); try { localStorage.setItem(POS_KEY, JSON.stringify({ top: Math.round(r.top), left: Math.round(r.left) })); } catch (e) {} }
    });
    b.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); return; } start(); });
  }

  new MutationObserver(addButton).observe(document.documentElement, { childList: true, subtree: true });
  addButton();
  resume();
})();
