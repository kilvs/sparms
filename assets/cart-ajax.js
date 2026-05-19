/*
 * Panthor Shopify AJAX cart
 *
 * Endpoints (all return JSON):
 *   POST /cart/add.js       add a variant + quantity (+ properties)
 *   POST /cart/change.js    set the quantity of one line by line index or key
 *   POST /cart/update.js    bulk-set quantities from { updates: { key: qty, ... } }
 *   GET  /cart.js           current cart state
 *
 * How to wire up:
 *   - any <form action="/cart/add" data-cart-form>   intercepted, AJAX-submitted
 *   - any [data-cart-quick-add="<variantId>"]        click adds 1 of that variant
 *   - any [data-cart-line-change="<key>"]            input change updates that line
 *   - any [data-cart-line-remove="<key>"]            click removes that line
 *   - any [data-cart-open]                           click opens drawer
 *   - [data-cart-drawer]                             root element of the drawer
 *   - [data-cart-count]                              spans whose text is set to item_count
 *   - [data-cart-drawer-items]                       container for drawer line items
 *   - [data-cart-drawer-subtotal]                    element whose text is set to total_price
 *   - [data-cart-empty-state]                        shown when cart is empty
 */
(function () {
  'use strict';

  var ROUTES = (window.Shopify && Shopify.routes) || { root: '/' };
  var SECTIONS_TO_RENDER = []; // optional, future

  function moneyFormat(cents) {
    var format = (window.Shopify && Shopify.money_format) || '${{amount}}';
    var amount = (cents / 100).toFixed(2);
    return format
      .replace(/\{\{\s*amount\s*\}\}/g, amount)
      .replace(/\{\{\s*amount_no_decimals\s*\}\}/g, Math.round(cents / 100))
      .replace(/\{\{\s*amount_with_comma_separator\s*\}\}/g, amount.replace('.', ','));
  }

  function fetchJSON(url, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ 'Content-Type': 'application/json', 'Accept': 'application/json' }, opts.headers || {});
    if (opts.body && typeof opts.body !== 'string') opts.body = JSON.stringify(opts.body);
    return fetch(url, opts).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) {
          var err = new Error((data && data.description) || r.statusText || 'Cart request failed');
          err.status = r.status; err.body = data; throw err;
        }
        return data;
      });
    });
  }

  var Cart = {
    state: null,

    get: function () {
      return fetchJSON(ROUTES.root + 'cart.js').then(function (cart) {
        Cart.state = cart;
        Cart.render(cart);
        return cart;
      });
    },

    add: function (payload) {
      return fetchJSON(ROUTES.root + 'cart/add.js', { method: 'POST', body: payload }).then(function () {
        return Cart.get().then(function (cart) { Cart.open(); return cart; });
      });
    },

    change: function (payload) {
      return fetchJSON(ROUTES.root + 'cart/change.js', { method: 'POST', body: payload }).then(function (cart) {
        Cart.state = cart; Cart.render(cart); Cart.refreshCartPage(); return cart;
      });
    },

    update: function (updates) {
      return fetchJSON(ROUTES.root + 'cart/update.js', { method: 'POST', body: { updates: updates } }).then(function (cart) {
        Cart.state = cart; Cart.render(cart); Cart.refreshCartPage(); return cart;
      });
    },

    refreshCartPage: function () {
      // If we're on the /cart page, re-fetch the full HTML and swap the .cart_section
      // so per-line prices and the page subtotal stay accurate.
      var cartSection = document.querySelector('.cart_section');
      if (!cartSection) return;
      var path = window.location.pathname.replace(/\/+$/, '');
      var cartPath = (ROUTES.root + 'cart').replace(/\/+$/, '');
      if (path !== cartPath) return;
      fetch(window.location.href, { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
        .then(function (r) { return r.text(); })
        .then(function (html) {
          var doc = new DOMParser().parseFromString(html, 'text/html');
          var fresh = doc.querySelector('.cart_section');
          if (fresh) cartSection.replaceWith(fresh);
        })
        .catch(function () { /* ignore — drawer already updated */ });
    },

    open: function () {
      var d = document.querySelector('[data-cart-drawer]');
      if (d) { d.setAttribute('aria-hidden', 'false'); d.classList.add('is-open'); document.documentElement.classList.add('cart-drawer-open'); }
    },

    close: function () {
      var d = document.querySelector('[data-cart-drawer]');
      if (d) { d.setAttribute('aria-hidden', 'true'); d.classList.remove('is-open'); document.documentElement.classList.remove('cart-drawer-open'); }
    },

    render: function (cart) {
      // Cart count badges
      document.querySelectorAll('[data-cart-count]').forEach(function (el) {
        el.textContent = cart.item_count;
        el.setAttribute('data-cart-count', cart.item_count);
        if (cart.item_count > 0) el.classList.remove('is-hidden');
        else el.classList.add('is-hidden');
      });

      // Drawer items
      var itemsEl = document.querySelector('[data-cart-drawer-items]');
      var emptyEl = document.querySelector('[data-cart-empty-state]');
      if (itemsEl) {
        itemsEl.innerHTML = cart.items.map(Cart.renderLine).join('');
      }
      if (emptyEl) {
        emptyEl.style.display = cart.item_count === 0 ? '' : 'none';
      }
      if (itemsEl) {
        itemsEl.style.display = cart.item_count === 0 ? 'none' : '';
      }

      // Subtotal
      document.querySelectorAll('[data-cart-drawer-subtotal]').forEach(function (el) {
        el.textContent = moneyFormat(cart.total_price);
      });

      // Dispatch event for other listeners
      document.dispatchEvent(new CustomEvent('cart:updated', { detail: { cart: cart } }));
    },

    renderLine: function (item) {
      var img = item.featured_image && item.featured_image.url
        ? '<img src="' + item.featured_image.url + '" alt="' + (item.featured_image.alt || item.product_title) + '" class="cart-drawer__line-image" loading="lazy">'
        : '';
      var variantTitle = (item.variant_title && item.variant_title !== 'Default Title')
        ? '<p class="cart-drawer__line-variant">' + item.variant_title + '</p>' : '';
      return '' +
        '<div class="cart-drawer__line" data-cart-line-key="' + item.key + '">' +
          '<a href="' + item.url + '" class="cart-drawer__line-image-wrap">' + img + '</a>' +
          '<div class="cart-drawer__line-body">' +
            '<a href="' + item.url + '" class="cart-drawer__line-title">' + item.product_title + '</a>' +
            variantTitle +
            '<p class="cart-drawer__line-price">' + moneyFormat(item.final_line_price) + '</p>' +
            '<div class="cart-drawer__line-qty">' +
              '<button type="button" class="cart-drawer__qty-step" data-cart-qty-step="-1" data-cart-line-key="' + item.key + '" aria-label="Decrease quantity">&minus;</button>' +
              '<input type="number" value="' + item.quantity + '" min="0" class="cart-drawer__qty-input" data-cart-line-change="' + item.key + '">' +
              '<button type="button" class="cart-drawer__qty-step" data-cart-qty-step="1" data-cart-line-key="' + item.key + '" aria-label="Increase quantity">+</button>' +
              '<button type="button" class="cart-drawer__line-remove" data-cart-line-remove="' + item.key + '" aria-label="Remove">Remove</button>' +
            '</div>' +
          '</div>' +
        '</div>';
    }
  };

  // -------- Event delegation --------

  // Add-to-cart form intercept — Shopify's {% form 'product' %} renders
  // <form action="/cart/add" ...> so we match on action ending with /cart/add.
  // Opt-out by adding data-cart-no-ajax to the form.
  document.addEventListener('submit', function (e) {
    var form = e.target.closest('form[action$="/cart/add"]');
    if (!form || form.hasAttribute('data-cart-no-ajax')) return;
    e.preventDefault();
    var btn = form.querySelector('[name="add"]') || form.querySelector('[type="submit"]');
    if (btn) { btn.setAttribute('aria-disabled', 'true'); btn.dataset.originalLabel = btn.dataset.originalLabel || btn.textContent || btn.value; btn.textContent = 'Adding…'; }
    var data = Object.fromEntries(new FormData(form).entries());
    if (!data.id) { console.warn('cart-ajax: form is missing a variant id input'); }
    Cart.add(data).catch(function (err) {
      console.error('cart-ajax add error', err);
      alert((err.body && (err.body.description || err.body.message)) || 'Could not add to cart.');
    }).finally(function () {
      if (btn) { btn.removeAttribute('aria-disabled'); btn.textContent = btn.dataset.originalLabel || 'Add to cart'; }
    });
  });

  // Quick-add buttons (e.g. + on product card)
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-cart-quick-add]');
    if (!btn) return;
    e.preventDefault();
    var id = btn.getAttribute('data-cart-quick-add');
    Cart.add({ id: id, quantity: 1 }).catch(function (err) {
      console.error('cart-ajax quick add error', err);
    });
  });

  // Drawer open trigger (header cart icon)
  document.addEventListener('click', function (e) {
    var trig = e.target.closest('[data-cart-open]');
    if (!trig) return;
    e.preventDefault();
    Cart.get().then(function () { Cart.open(); });
  });

  // Drawer close (close button or overlay click)
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-cart-close]')) { e.preventDefault(); Cart.close(); }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') Cart.close();
  });

  // Quantity step buttons
  document.addEventListener('click', function (e) {
    var stepBtn = e.target.closest('[data-cart-qty-step]');
    if (!stepBtn) return;
    e.preventDefault();
    var key = stepBtn.getAttribute('data-cart-line-key');
    var delta = parseInt(stepBtn.getAttribute('data-cart-qty-step'), 10) || 0;
    var input = document.querySelector('[data-cart-line-change="' + key + '"]');
    var current = parseInt((input && input.value) || '0', 10) || 0;
    var next = Math.max(0, current + delta);
    Cart.change({ id: key, quantity: next });
  });

  // Quantity input change
  document.addEventListener('change', function (e) {
    var input = e.target.closest('[data-cart-line-change]');
    if (!input) return;
    var key = input.getAttribute('data-cart-line-change');
    var qty = Math.max(0, parseInt(input.value, 10) || 0);
    Cart.change({ id: key, quantity: qty });
  });

  // Remove line
  document.addEventListener('click', function (e) {
    var rm = e.target.closest('[data-cart-line-remove]');
    if (!rm) return;
    e.preventDefault();
    var key = rm.getAttribute('data-cart-line-remove');
    Cart.change({ id: key, quantity: 0 });
  });

  // Boot: prime cart state for header badge
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { Cart.get().catch(function () {}); });
  } else {
    Cart.get().catch(function () {});
  }

  // Expose for debugging / custom code
  window.PanthorCart = Cart;
})();
