// Runs on Costco Business Center's "Order by Item Number" page. Adds a floating
// button that fills every item # + quantity from the Colette order and adds to cart.
(function () {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const setVal = (el, v) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(el, String(v));
    ['input', 'change', 'keyup', 'blur'].forEach((t) => el.dispatchEvent(new Event(t, { bubbles: true })));
  };

  const POS_KEY = 'btnpos_costco';
  const VER = '7';
  function addButton() {
    let existing = document.getElementById('colette-fill-btn');
    if (existing && existing.dataset.coletteV === VER) return; // already ours
    const b = document.createElement('button');
    b.id = 'colette-fill-btn';
    b.dataset.coletteV = VER;
    if (existing) existing.replaceWith(b); else document.body.appendChild(b);
    b.textContent = '🥐 Fill Costco cart (drag me)';
    Object.assign(b.style, {
      position: 'fixed', top: '70px', right: '16px', zIndex: 2147483647,
      background: '#c99a3b', color: '#1a1206', border: '2px solid #1a1206', borderRadius: '22px',
      padding: '12px 18px', fontWeight: '700', cursor: 'grab', fontFamily: 'sans-serif',
      boxShadow: '0 3px 14px rgba(0,0,0,.35)', userSelect: 'none',
    });
    try { const p = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
      if (p) { b.style.top = p.top + 'px'; b.style.left = p.left + 'px'; b.style.right = 'auto'; }
    } catch (e) {}
    let dragging = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0;
    b.addEventListener('mousedown', (e) => { dragging = true; moved = false; sx = e.clientX; sy = e.clientY; const r = b.getBoundingClientRect(); ox = r.left; oy = r.top; b.style.cursor = 'grabbing'; e.preventDefault(); });
    window.addEventListener('mousemove', (e) => { if (!dragging) return; const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.abs(dx) + Math.abs(dy) > 4) moved = true; b.style.left = (ox + dx) + 'px'; b.style.top = (oy + dy) + 'px'; b.style.right = 'auto'; });
    window.addEventListener('mouseup', () => { if (!dragging) return; dragging = false; b.style.cursor = 'grab'; if (moved) { const r = b.getBoundingClientRect(); try { localStorage.setItem(POS_KEY, JSON.stringify({ top: Math.round(r.top), left: Math.round(r.left) })); } catch (e) {} } });
    b.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); return; } run(); });
  }

  async function run() {
    const b = document.getElementById('colette-fill-btn');
    chrome.storage.local.get('order_costco', async (d) => {
      const o = d && d.order_costco;
      if (!o || !o.lines || !o.lines.length) {
        alert('No Colette order found.\n\nOpen the Colette supplier sheet, set your Costco quantities, and click "Send to Costco" — then come back here and press this button.');
        return;
      }
      b.disabled = true;
      let done = 0;
      for (const l of o.lines) {
        if (!l.id) continue;
        let item = [...document.querySelectorAll('input.item-number-textbox')].find((i) => !i.value.trim());
        if (!item) item = [...document.querySelectorAll('input.item-number-textbox')].pop();
        if (!item) break;
        setVal(item, l.id);
        const row = item.closest('tr') || item.closest('.row') || item.parentElement.parentElement;
        const qty = row && row.querySelector('input.qty-textbox');
        if (qty) setVal(qty, l.qty);
        // Nudge Costco to validate the item and add a fresh row.
        item.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
        item.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true }));
        item.blur();
        done++;
        b.textContent = `Filling… ${done}/${o.lines.length}`;
        await sleep(1700);
      }
      b.textContent = 'Adding to cart…';
      const add = document.querySelector('#obiAddToCart');
      if (add) add.click();
      await sleep(1500);
      b.textContent = '✓ Done — review your cart';
      b.disabled = false;
    });
  }

  // The page renders rows dynamically; keep the button present.
  new MutationObserver(addButton).observe(document.documentElement, { childList: true, subtree: true });
  addButton();
})();
