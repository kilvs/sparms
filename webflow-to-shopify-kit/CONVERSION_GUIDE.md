# Webflow → Shopify Conversion Guide

A repeatable recipe for turning a Webflow site export into a Shopify Online Store 2.0 theme **without rewriting any styles or markup**. Used to convert this repo; same steps apply to any Webflow export.

The goal is byte-identical visual parity. Only the rendering engine changes (static HTML → Liquid).

---

## 1. Source inventory checklist

Before starting, take stock of the export:

| Asset | What to record |
|---|---|
| HTML pages | Filenames + role (home, product template, etc.). Note shared vs. one-off pages. |
| CSS files | Paths + whether they reference fonts/images via `url(../...)`. |
| JS bundle | Webflow ships one big `*.js` — keep it intact. |
| Images / fonts | Count, formats, subfolders. |
| `<html>` attributes | `data-wf-page` (varies per page), `data-wf-site` (constant). |
| External CDNs | jQuery (Webflow CDN), GSAP, Swiper, etc. — keep as-is. |
| Forms | Newsletter, contact, password-page — all need rewiring. |

---

## 2. Target Shopify theme structure

```
<theme-root>/
├── assets/             # FLAT — Shopify forbids subdirs here
├── config/
│   ├── settings_schema.json
│   └── settings_data.json
├── layout/
│   ├── theme.liquid    # wraps all chrome'd pages
│   └── password.liquid # for the 401 / password page
├── locales/
│   └── en.default.json
├── sections/
│   ├── header.liquid + header-group.json
│   ├── footer.liquid + footer-group.json
│   ├── page-*.liquid   # one per source HTML page (or split further into blocks)
│   └── main-cart.liquid, main-search.liquid
├── snippets/
│   ├── social-icon.liquid
│   └── wf-form-states.liquid
└── templates/
    ├── index.json
    ├── product.json
    ├── collection.json
    ├── blog.json
    ├── article.json
    ├── page.json / page.<handle>.json
    ├── 404.json
    ├── cart.json
    └── search.json
```

---

## 3. Folder remap

| Webflow export | Shopify theme |
|---|---|
| `css/*.css` | `assets/` |
| `js/*.js` | `assets/` |
| `images/*` | `assets/` |
| `fonts/*` | `assets/` |
| `index.html` | `sections/page-index.liquid` + `templates/index.json` |
| `product-template.html` | `sections/page-product.liquid` + `templates/product.json` |
| `shop.html` | `sections/page-collection.liquid` + `templates/collection.json` |
| `blog.html` | `sections/page-blog.liquid` + `templates/blog.json` |
| `article-template.html` | `sections/page-article.liquid` + `templates/article.json` |
| `<page>.html` (static) | `sections/page-<page>.liquid` + `templates/page.<page>.json` |
| `404.html` | `sections/page-404.liquid` + `templates/404.json` |
| `401.html` | `layout/password.liquid` (no sections — full layout) |

**Filename collision check**: confirm no two assets share a name once `images/` and `fonts/` flatten into `assets/`. Prefix font files if needed and update CSS.

---

## 4. Asset URL rewrite rules

### 4.1 CSS

In any Webflow CSS that uses relative paths to siblings:

```
url('../images/foo.png')   →  url('foo.png')
url("../fonts/bar.woff2")  →  url("bar.woff2")
url(../images/foo.png)     →  url(foo.png)
```

Shopify serves everything in `assets/` at the same flat path, so a CSS-relative `url('foo.png')` resolves to `assets/foo.png`. **Don't** rename CSS to `.css.liquid` — it skips CDN edge caching for no benefit when the folder is flat.

One-liner (POSIX sed):

```bash
sed -i "s|\.\./fonts/||g; s|\.\./images/||g" assets/*.css
```

### 4.2 HTML / Liquid

In templates, sections, layouts:

| Find | Replace |
|---|---|
| `<link href="css/X.css" rel="stylesheet" ...>` | `{{ 'X.css' | asset_url | stylesheet_tag }}` |
| `<script src="js/X.js" ...>` | `<script src="{{ 'X.js' | asset_url }}"></script>` |
| `src="images/X.png"` | `src="{{ 'X.png' | asset_url }}"` |
| `srcset="images/A.webp 500w, images/B.webp 800w"` | rewrite each token to `{{ 'A.webp' | asset_url }} 500w, ...` |
| `href="images/X.svg"` | `href="{{ 'X.svg' | asset_url }}"` |
| `url(images/X.png)` (inline style) | `url({{ 'X.png' | asset_url }})` |

A small Node script handles this in bulk. See `convert.cjs` in this repo's history for the pattern.

### 4.3 Internal `.html` link rewrites

| Webflow href | Shopify route |
|---|---|
| `index.html` | `{{ routes.root_url }}` |
| `<static>.html` | `{{ routes.root_url }}pages/<handle>` |
| `shop.html` | `{{ routes.collections_url }}/all` |
| `blog.html` | `{{ routes.root_url }}blogs/news` |
| `product-template.html` | `{{ product.url }}` or `{{ routes.collections_url }}/all` |
| `article-template.html` | `{{ article.url }}` or blog list |
| `404.html` | `/404` |
| `401.html` | `/password` |

---

## 5. `layout/theme.liquid` skeleton

Copy from `index.html`'s head/body skeleton. Key edits:

```liquid
{%- liquid
  case template
    when 'index'
      assign wf_page_id = '<homepage data-wf-page>'
    when 'product'
      assign wf_page_id = '<product data-wf-page>'
    # ...one statement per line inside {% liquid %} — semicolons are NOT valid separators
    else
      assign wf_page_id = '<homepage data-wf-page>'
  endcase
-%}
<!DOCTYPE html>
<html data-wf-page="{{ wf_page_id }}" data-wf-site="<your data-wf-site>" lang="{{ request.locale.iso_code | default: 'en-AU' }}">
<head>
  <meta charset="utf-8">
  <title>{{ page_title }} ... – {{ shop.name }}</title>
  <!-- meta, favicon, css links via asset_url -->
  {{ 'normalize.css' | asset_url | stylesheet_tag }}
  {{ 'components.css' | asset_url | stylesheet_tag }}
  {{ '<site>.css' | asset_url | stylesheet_tag }}
  <!-- ...inline Webflow JS detector + Swiper helpers... -->
  {{ content_for_header }}   <!-- REQUIRED inside <head> -->
</head>
<body>
  <div class="page-wrapper">
    <!-- cursor, global styles (verbatim from Webflow) -->
    {% sections 'header-group' %}
    {{ content_for_layout }}
    {% sections 'footer-group' %}
  </div>
  <!-- jQuery (Webflow CDN), main JS bundle (asset_url), GSAP -->
</body>
</html>
```

**Rules:**
- `{{ content_for_header }}` MUST be in `<head>` (Shopify injects analytics/apps here).
- Keep the existing `<main class="main-wrapper">` inside each section — don't wrap with a duplicate `<main>` here.
- Don't strip the `data-wf-page` / `data-wf-site` attributes — Webflow's JS keys off them.

---

## 6. Section-per-page pattern

For each source HTML page:

1. **Slice** the content between `</header>` and `<footer ...>` (or `<main>...</main>`).
2. **Save** as `sections/page-<name>.liquid`.
3. **Rewrite** asset URLs and internal `.html` hrefs per §4.
4. **Append** a `{% schema %} ... {% endschema %}` block:
   ```liquid
   {% schema %}
   {
     "name": "Page <name>",
     "settings": [ { "type": "paragraph", "content": "Imported from Webflow." } ],
     "presets": [{ "name": "Page <name>" }]
   }
   {% endschema %}
   ```
5. **Wire** a `templates/<name>.json` (or `templates/page.<name>.json` for static pages):
   ```json
   { "sections": { "main": { "type": "page-<name>" } }, "order": ["main"] }
   ```

**Splitting further** *(recommended for the homepage and any landing page the merchant should be able to rearrange)*: slice into one section file per top-level `<section>` element on the page and list each in the JSON template's `order` array. See §6.1.

---

## 6.1 Per-block split recipe

Goal: every top-level `<section class="...">` in a Webflow page becomes a standalone Shopify section file, with at minimum a **show / hide toggle** and a **product picker** for any commerce CTA, so the merchant can rearrange/edit blocks in the theme editor.

### Webflow's two section flavours

Look at the outermost class on each `<section>` — the prefix tells you whether the block is reusable or page-specific. **Audit this before naming any files.**

| Webflow class prefix | Meaning | Shopify file location |
|---|---|---|
| `home_*_section`, `about_*_section`, `shop_*_section`, `blog_*_section`, `article_*_section`, `contact_*_section`, `product_*_section` | **Page-specific** — appears on one page only (the home banner, the blog header, etc.) | `sections/<page>-<NN>-<slug>.liquid` |
| `component_*_section` | **Reusable component** — Webflow's design system intends it to appear on multiple pages (newsletter sign-up, news feed, FAQ, testimonials, etc.) | `sections/component-<slug>.liquid` |

Run this audit on a fresh Webflow export to see which components are reused and where:

```bash
for f in *.html; do
  printf "\n--- %s ---\n" "$f"
  grep -oE '<section[^>]*class="[^"]*component_[a-z_]+_section[^"]*"' "$f" \
    | grep -oE 'component_[a-z_]+_section' | sort -u
done
```

### Naming convention

**Page-specific sections** — keep the page prefix and a 2-digit order index so the file list reads in render order:

```
sections/home-01-banner.liquid          # home_banner_section
sections/home-02-overview.liquid        # home_overview_section
sections/home-06-story.liquid           # home_story_section
sections/about-01-intro.liquid          # about_intro_section
sections/article-01-hero.liquid         # article_hero_section
```

**Reusable component sections** — flat name, no page prefix, no order index (each page that uses it picks its own position in its own JSON template):

```
sections/component-marquee.liquid
sections/component-explore.liquid
sections/component-blurb.liquid
sections/component-platform.liquid
sections/component-product-overview.liquid
sections/component-testimonial.liquid
sections/component-faq.liquid
sections/component-newsletter.liquid
sections/component-news.liquid
```

A Shopify section file is its own **type** — multiple JSON templates can reference the same type, so the markup lives once and stays in sync everywhere it's used.

### Minimum schema every split section gets

```liquid
{%- if section.settings.show_section -%}
<!-- ...original Webflow markup verbatim... -->
{%- endif -%}

{% schema %}
{
  "name": "Home — Banner",
  "tag": "section",
  "class": "shopify-section-home-banner",
  "settings": [
    { "type": "checkbox", "id": "show_section", "label": "Show this section", "default": true },
    { "type": "header", "content": "Imported from Webflow" },
    { "type": "paragraph", "content": "Edit text/images here as you split further. Default values match the static export." }
  ],
  "presets": [{ "name": "Home — Banner" }]
}
{% endschema %}
```

**Why `show_section` defaults to `true`**: the page renders identically to the Webflow original out of the box. Merchants can toggle a section off without deleting it.

### Making every text / image / button merchant-editable

For each section, turn static markup into schema-driven defaults. The pattern that works across every section type:

1. **Single text** → `{ "type": "text", "id": "heading", "default": "Static text from Webflow" }` rendered as `{{ section.settings.heading | default: 'Static text from Webflow' }}`. Use `textarea` for short body copy, `richtext` for anything with inline markup, `inline_richtext` for short formatted strings.
2. **Single image** → `{ "type": "image_picker", "id": "image" }` rendered with `{% if section.settings.image != blank %}{{ section.settings.image | image_url: width: 1200 }}{% else %}{{ 'fallback.webp' | asset_url }}{% endif %}`. Always provide a fallback so the section never looks broken when the merchant clears the picker.
3. **Single button** → group `cta_label` (text) + `cta_url` (url) + a typed picker (`product` / `collection` / `page` / `blog`) + a `show_cta` checkbox. Compute the URL once at the top of the section with `{%- liquid ... -%}` so the markup stays clean. Pattern:
   ```liquid
   {%- liquid
     assign url = section.settings.cta_url
     if url == blank and section.settings.cta_page != blank
       assign url = section.settings.cta_page.url
     endif
     assign url = url | default: routes.collections_url | append: '/all'
   -%}
   {%- if section.settings.show_cta -%}
     <a href="{{ url }}" class="button-primary w-button">{{ section.settings.cta_label | default: 'Buy Now' }}</a>
   {%- endif -%}
   ```
4. **Repeating items (cards, logos, testimonials, FAQ items, news posts)** → `schema.blocks`. Render with `{% for block in section.blocks %}{% if block.type == 'card' %}…{% endif %}{% endfor %}`. Each block carries its own `heading`, `body`, `image`, `cta_label`, `cta_url` fields. Set sensible `max_blocks` (6–30 depending on layout). Provide `presets.blocks` matching the original static content so the section ships pre-populated.
5. **Conditional visibility** → every section starts with `{ "type": "checkbox", "id": "show_section", "default": true }` and the markup is wrapped in `{%- if section.settings.show_section -%}…{%- endif -%}`. Same pattern within: `show_cta`, `show_view_all`, `show_secondary_cta`, etc.
6. **Form labels** → `email_label`, `submit_label`, `consent_text`, `success_text`, `error_text`. The `wf-form-states` snippet accepts `success_text` and `error_text` as render parameters: `{% render 'wf-form-states', form: form, success_text: section.settings.success_text, error_text: section.settings.error_text %}`.
7. **Star ratings, scores** → `{ "type": "range", "min": 0, "max": 5, "step": 1, "default": 5 }` then loop with `{% for i in (1..rating) %}<img …>{% endfor %}`.
8. **Fallback asset filenames** → when the design depends on a specific image from `assets/` (e.g. an SVG watermark or default product placeholder), expose a hidden `fallback_image` text field carrying the filename. The render branches on `image != blank ? image_url : fallback_image | asset_url`. This lets each merchant override per-block without having to re-upload the default.

Worked examples in this repo: [sections/home-02-overview.liquid](sections/home-02-overview.liquid) (block cards with image + heading + body), [sections/component-faq.liquid](sections/component-faq.liquid) (question/answer blocks + show_cta), [sections/component-newsletter.liquid](sections/component-newsletter.liquid) (form labels, submit text, success/error message), [sections/component-news.liquid](sections/component-news.liquid) (dynamic blog source OR block-based fallback).

### When a section contains a commerce CTA

Add a `product` picker + `cta_url_fallback` + `cta_label` to the schema:

```json
{ "type": "product", "id": "cta_product", "label": "Product for primary CTA" },
{ "type": "url",     "id": "cta_url",     "label": "Custom URL (overrides product)" },
{ "type": "text",    "id": "cta_label",   "label": "CTA button label", "default": "Buy Now" }
```

Then in the markup:

```liquid
{%- assign _cta_url = section.settings.cta_url -%}
{%- if _cta_url == blank and section.settings.cta_product -%}
  {%- assign _cta_url = section.settings.cta_product.url -%}
{%- endif -%}
{%- assign _cta_url = _cta_url | default: routes.collections_url | append: '/all' -%}
<a href="{{ _cta_url }}" class="button-primary w-button">{{ section.settings.cta_label | default: 'Buy Now' }}</a>
```

Same pattern for **collection** pickers (use `"type": "collection"`), **blog** pickers, **link_list** pickers.

### Conditional visibility for blocks within a section

Inside repeating areas (testimonials, FAQ items, news cards), use `schema.blocks` so merchants can add/remove items. The render loop is:

```liquid
{%- for block in section.blocks -%}
  {%- if block.settings.is_visible -%}
    <div {{ block.shopify_attributes }}>…{{ block.settings.heading }}…</div>
  {%- endif -%}
{%- endfor -%}
```

With block schema:

```json
"blocks": [
  {
    "type": "item",
    "name": "Item",
    "settings": [
      { "type": "checkbox", "id": "is_visible", "label": "Visible", "default": true },
      { "type": "text", "id": "heading", "label": "Heading" }
    ]
  }
]
```

### `templates/index.json` after splitting

Each section gets its own entry, with the `type` matching the section file name (page-specific or component). Multiple page templates can reuse the same component types.

```json
{
  "sections": {
    "banner":           { "type": "home-01-banner",             "settings": { "show_section": true } },
    "overview":         { "type": "home-02-overview",           "settings": { "show_section": true } },
    "marquee":          { "type": "component-marquee",          "settings": { "show_section": true } },
    "explore":          { "type": "component-explore",          "settings": { "show_section": true } },
    "blurb":            { "type": "component-blurb",            "settings": { "show_section": true } },
    "story":            { "type": "home-06-story",              "settings": { "show_section": true } },
    "platform":         { "type": "component-platform",         "settings": { "show_section": true } },
    "product-overview": { "type": "component-product-overview", "settings": { "show_section": true } },
    "testimonial":      { "type": "component-testimonial",      "settings": { "show_section": true } },
    "faq":              { "type": "component-faq",              "settings": { "show_section": true } },
    "newsletter":       { "type": "component-newsletter",       "settings": { "show_section": true } },
    "news":             { "type": "component-news",             "settings": { "show_section": true } }
  },
  "order": ["banner","overview","marquee","explore","blurb","story","platform","product-overview","testimonial","faq","newsletter","news"]
}
```

Then on every *other* page that uses the same component, reference the same `type` in that page's JSON template — for example `templates/page.about.json` includes `"newsletter": { "type": "component-newsletter" }` and gets the same section automatically. Update the markup once, all pages get it.

Delete the old monolithic `sections/page-<name>.liquid` after splitting — keeping both leaves dead code.

### Automation

The split is mechanical — write it once as a Node script. The script:

1. Reads `sections/page-<name>.liquid`.
2. Slices `<section class="...">…</section>` blocks at the **outermost** depth (be careful: some Webflow pages have nested `<section>` tags — match by indentation level, not just `<section>`).
3. Writes each to `sections/<page>-<NN>-<slug>.liquid` with the minimum schema appended.
4. Generates a fresh `templates/<page>.json` with sections listed in render order.

Save the script alongside `convert.cjs` — it's reusable across Webflow exports.

---

## 7. Dynamic data binding (commerce pages)

### Product page (`page-product.liquid`)

| Static markup | Replace with |
|---|---|
| `<h1>Panthor Complete Strength System</h1>` | `<h1>{{ product.title \| default: '<static fallback>' }}</h1>` |
| `<p>$50,000</p>` | `<p>{% if product != blank %}{{ product.price \| money }}{% else %}$50,000{% endif %}</p>` |
| `<p>...description...</p>` | wrap in `{% if product != blank and product.description != blank %}{{ product.description }}{% else %}<static p>{% endif %}` |
| `<img src="images/featured.webp">` | `{% if product.featured_image %}{{ product.featured_image \| image_url: width: 1360 }}{% else %}<static>{% endif %}` |
| Variant buttons | inside `{% form 'product', product %}`, render `{% for variant in product.variants %}<button name="id" value="{{ variant.id }}">{{ variant.title }}</button>{% endfor %}` |
| Quantity input | add `name="quantity"` |
| Add-to-cart button | `<button type="submit" name="add">Add to cart</button>{% endform %}` |

### Collection page

Wrap the existing product-card grid with:

```liquid
{%- if collection != blank and collection.products.size > 0 -%}
  {%- paginate collection.products by 24 -%}
    {%- for product in collection.products -%}
      <a href="{{ product.url }}" class="component_product_card">…</a>
    {%- endfor -%}
    {{ paginate | default_pagination }}
  {%- endpaginate -%}
{%- else -%}
  <!-- original static cards as fallback -->
{%- endif -%}
```

### Blog list / article

Same pattern with `blog.articles` and `article.title / article.image / article.content / article.published_at`.

---

## 8. Forms

### Newsletter (Webflow `wf-form-Newsletter-Form`)

```liquid
{%- form 'customer', id: 'wf-form-Newsletter-Form', class: 'component_newsletter_form' -%}
  <input type="hidden" name="contact[tags]" value="newsletter">
  <input type="email" name="contact[email]" ...>
  <input type="checkbox" name="contact[accepts_marketing]" ...>
  <button type="submit">Submit</button>
  {% render 'wf-form-states', form: form %}
{%- endform -%}
```

### Contact / Enquiry

```liquid
{%- form 'contact', id: 'wf-form-Enquiry-Form', class: 'component_form' -%}
  <input name="contact[name]" required>
  <input name="contact[email]" type="email" required>
  <textarea name="contact[body]"></textarea>
  <button type="submit">Submit</button>
  {% render 'wf-form-states', form: form %}
{%- endform -%}
```

### Password page (`layout/password.liquid`)

```liquid
{%- form 'storefront_password' -%}
  <input type="password" name="password" required>
  <button type="submit">Submit</button>
  {%- if form.errors -%}<div class="w-form-fail">Incorrect password.</div>{%- endif -%}
{%- endform -%}
```

The `wf-form-states` snippet renders success/error blocks that match Webflow's `.w-form-done` / `.w-form-fail` classes, so existing CSS keeps styling them.

---

## 9. Header / footer section groups (OS 2.0)

Header markup (logo + nav + cart icon) goes in `sections/header.liquid` with a schema exposing logo image and menu picker. Footer similar, with social-link blocks.

Bind each with a section group JSON file:

```json
// sections/header-group.json
{
  "type": "header",
  "name": "Header group",
  "sections": { "header": { "type": "header" } },
  "order": ["header"]
}
```

Then in `theme.liquid`: `{% sections 'header-group' %}`.

---

## 10. Webflow JS preservation gotchas

- **`data-wf-page` per page** — Webflow interactions key off this. Per-template override via `{% case template %}` in `theme.liquid`.
- **`data-wf-site` is constant** — hardcode it.
- **Section render API** — Shopify's live theme editor re-injects sections via XHR. Webflow's interactions only run on `DOMContentLoaded` and won't re-init. Merchants must refresh the editor preview to see animations.
- **CDN scripts** stay external — jQuery, GSAP, Swiper. Don't self-host unless needed.
- **`<form action="webflow.com/...">`** is dead in Shopify. All forms must use `{% form %}`.

---

## 11. Required Shopify theme files (don't skip!)

A Webflow export has none of these. Shopify rejects the theme — with the (misleading) error **"Role can't be set to main: missing required file layout/theme.liquid"** — if any are absent at publish time. Add stubs even when you don't have Webflow designs for them.

### Layout
- `layout/theme.liquid` — main wrapper for every chromed page.
- `layout/password.liquid` — wrapper for the storefront password page. Should just render `{{ content_for_layout }}`; the form belongs in a section.

### Templates
- `templates/index.{liquid,json}`
- `templates/product.{liquid,json}`
- `templates/collection.{liquid,json}`
- `templates/list-collections.{liquid,json}` — the `/collections` route. Easy to miss.
- `templates/page.{liquid,json}` (+ alternates like `page.about.json`)
- `templates/blog.{liquid,json}`
- `templates/article.{liquid,json}`
- `templates/search.{liquid,json}`
- `templates/cart.{liquid,json}`
- `templates/404.{liquid,json}`
- `templates/password.{liquid,json}` — content for the password page. The layout alone isn't enough.
- `templates/gift_card.liquid` — **must be `.liquid`, not `.json`** (it's a full standalone HTML doc, no theme layout).

### Customer templates (all 7 required, all `.liquid`)
- `templates/customers/account.liquid`
- `templates/customers/activate_account.liquid`
- `templates/customers/addresses.liquid`
- `templates/customers/login.liquid`
- `templates/customers/order.liquid`
- `templates/customers/register.liquid`
- `templates/customers/reset_password.liquid`

Each uses a built-in Shopify form: `customer_login`, `create_customer`, `customer_address`, `reset_customer_password`, `recover_customer_password`, `activate_customer_password`. Stub them with the Webflow form classes (`component_form`, `w-input`, `w-button`) so existing CSS styles them automatically.

### Config & locales
- `config/settings_schema.json`
- `config/settings_data.json`
- `locales/en.default.json` (at minimum — other locales optional)

### One-liner check before pushing

```bash
for f in layout/theme.liquid layout/password.liquid \
  templates/index.json templates/product.json templates/collection.json \
  templates/list-collections.json templates/page.json templates/blog.json \
  templates/article.json templates/search.json templates/cart.json \
  templates/404.json templates/password.json templates/gift_card.liquid \
  templates/customers/account.liquid templates/customers/activate_account.liquid \
  templates/customers/addresses.liquid templates/customers/login.liquid \
  templates/customers/order.liquid templates/customers/register.liquid \
  templates/customers/reset_password.liquid \
  config/settings_schema.json config/settings_data.json \
  locales/en.default.json; do
    [ -e "$f" ] || echo "MISSING: $f"
done
```

---

## 12. Verification

1. `shopify theme dev --store <dev>.myshopify.com`
2. Visit every route and side-by-side compare to the original Webflow HTML:
   - `/` `/products/<test>` `/collections/all` `/blogs/news` `/blogs/news/<article>`
   - `/pages/about`, `/pages/contact`, `/pages/legal`, etc.
   - `/cart` `/search` `/404` `/password`
   - `/account`, `/account/login`, `/account/register`
   - `/collections` (list-collections)
3. Browser DevTools: confirm no 404s on assets, no JS errors, fonts load.
4. Theme editor: open each template, reorder a section on the homepage, confirm preview updates (with refresh for Webflow animations).
5. Submit the contact form — verify email in admin → Settings → Notifications.
6. Submit the newsletter — verify a customer is created with `newsletter` tag.
7. **Try publishing** in Shopify Admin → Themes → "Publish". This is the only way to catch missing-required-template errors *before* customers see them. If you get **"Role can't be set to main: missing required file …"**, the named file is missing OR contains a Liquid parse error (Shopify reports parse errors as missing). Don't trust the error text literally — check §13 for both root causes.
8. `shopify theme check` — fix flagged issues *without* touching the original Webflow markup.

---

## 13. Common gotchas

- **"Missing required file layout/theme.liquid" when the file exists.** This error fires when (a) any required template from §11 is actually missing, OR (b) `layout/theme.liquid` has a Liquid parse error that prevents loading. Shopify reports parse failures as if the file were missing.
- **`{% liquid %}` tag uses one statement per line.** Semicolons are NOT valid separators. This crashes parsing silently and triggers the "missing layout/theme.liquid" error above. ❌ `when 'index' ; assign x = 'a'` ✅
  ```liquid
  {%- liquid
    case template
      when 'index'
        assign x = 'a'
      when 'product'
        assign x = 'b'
    endcase
  -%}
  ```
- **Flat assets**: Shopify rejects subdirs in `assets/`. Flatten ruthlessly.
- **Double `<main>`**: each Webflow page has its own `<main class="main-wrapper">`. Don't wrap `{{ content_for_layout }}` with another `<main>` in `theme.liquid`.
- **Form `action` URLs**: Webflow forms post to `webflow.com`. After conversion to `{% form %}`, the action is replaced by Shopify — old `action=...` attrs are ignored.
- **Class names**: do NOT rename. Webflow JS, GSAP triggers, and CSS all depend on them.
- **`url(...)` in inline `<style>` blocks**: rare but check. Same rewrite rule as in CSS files.
- **HTTP vs HTTPS**: Webflow's CDN scripts already use `https://`. Leave them.
- **Cart drawer / line item properties**: Webflow doesn't model these. Add later via section blocks if needed.
- **`gift_card.liquid` is a full HTML doc** — it doesn't go through `layout/theme.liquid` and must contain its own `<!DOCTYPE html>` / `<head>` / `<body>` and load its own CSS. Don't reference `{{ content_for_header }}` from theme.liquid here.
- **`layout/password.liquid` and `templates/password.json` are separate.** The layout is just the HTML shell; the form/section goes in the template. Putting the form in the layout works visually but breaks the principle that templates own their content and editor sections.

---

## 14. AJAX cart

The theme ships with an AJAX cart so adding a product, editing quantity, or removing a line never reloads the page. Implementation lives in three files:

- `assets/cart-ajax.js` — fetches Shopify's `/cart/add.js`, `/cart/change.js`, `/cart/update.js`, `/cart.js` endpoints. Exposes `window.PanthorCart` for debugging.
- `assets/cart-drawer.css` — slide-in drawer styling. Scoped under `.cart-drawer__*` classes so it never clashes with Webflow CSS.
- `snippets/cart-drawer.liquid` — the drawer markup, rendered once in `layout/theme.liquid` (`{% render 'cart-drawer' %}`).

### How elements opt in (data attributes)

| Attribute | Element | Behaviour |
|---|---|---|
| `data-cart-open` | header cart icon | Click → opens drawer (also refetches cart state). |
| `data-cart-close` | close button / overlay | Click → closes drawer. ESC also closes. |
| `data-cart-count` | any element | Text is set to `cart.item_count`. Add the class `is-hidden` when count is 0. |
| `data-cart-drawer` | drawer root `<aside>` | Toggle target. |
| `data-cart-drawer-items` | container | Re-rendered with the live cart on every change. |
| `data-cart-drawer-subtotal` | element | Text is set to `moneyFormat(cart.total_price)`. |
| `data-cart-empty-state` | element | Shown when cart is empty. |
| `data-cart-quick-add="<variantId>"` | `<button>` | Click → adds 1 of that variant, opens drawer. Use on product cards. |
| `data-cart-line-change="<key>"` | `<input type="number">` | Change → calls `/cart/change.js` for that line. |
| `data-cart-line-remove="<key>"` | `<button>` | Click → removes that line. |
| `data-cart-qty-step="-1\|1"` + `data-cart-line-key="<key>"` | `<button>` | Stepper for cart-drawer / cart-page line items. |

Forms with `action$="/cart/add"` (Shopify's `{% form 'product' %}` emits this) are auto-intercepted and submitted via AJAX. Opt out per form by adding `data-cart-no-ajax`.

### Required setup in `theme.liquid`

Drop into `<head>` so the JS knows where to POST and how to format money:

```liquid
<script>
  window.Shopify = window.Shopify || {};
  Shopify.routes = { root: '{{ routes.root_url }}' };
  Shopify.money_format = {{ shop.money_format | json }};
</script>
```

Load the assets:

```liquid
{{ 'cart-drawer.css' | asset_url | stylesheet_tag }}
<!-- ...other stylesheets... -->
<!-- ...sections, footer... -->
{% render 'cart-drawer' %}
<script src="{{ 'cart-ajax.js' | asset_url }}" defer></script>
```

### Variant selection on the product page

Variant buttons should be `type="button"` (not submit), each carrying `data-product-variant="<id>"` and optional `data-variant-price="<cents>"` / `data-variant-available="true|false"`. A small inline script in `sections/page-product.liquid`:

1. Toggles the `is-active` class
2. Writes the selected variant id into `<input type="hidden" name="id" data-product-variant-id>`
3. Updates any `[data-product-price]` and `[data-product-total]` text using `Shopify.money_format`
4. Disables the Add-to-cart button if the variant is unavailable

When the user clicks "Add to cart", the form (`action="/cart/add"`) is intercepted by `cart-ajax.js`, AJAX-POSTed, and the drawer opens with the new line.

### Cart page (`/cart`)

The `sections/main-cart.liquid` page uses the same `data-cart-line-*` attributes as the drawer. After any AJAX change, `Cart.refreshCartPage()` re-fetches the page HTML and swaps `.cart_section` in place — so per-line prices, line subtotals, and the page-level subtotal stay accurate without a full reload.

### Custom listeners

The cart dispatches a `cart:updated` event on `document` after every successful change. Use it for header animations, recently-added popups, analytics:

```js
document.addEventListener('cart:updated', function (e) {
  console.log('new cart state', e.detail.cart);
});
```

### Gotchas

- **Quick-add `<a>`-wrapped cards**: when the card is wrapped in `<a href="{{ product.url }}">`, the quick-add `<button>` must call `event.stopPropagation()` and `event.preventDefault()` to avoid following the card link.
- **Variant id missing**: form submissions without an `id` input fail silently. Always have a hidden `<input name="id">` even when there's only one variant.
- **Webflow form animations**: if the original Webflow design animates form submits (e.g. shows a success state), that animation won't fire on AJAX submit. The drawer opening is the replacement signal.
- **Money format**: Shopify's `shop.money_format` is a templated string like `${{amount}}`. The JS replaces `{{amount}}`, `{{amount_no_decimals}}`, `{{amount_with_comma_separator}}`. Custom money formats with unusual tokens need additional handling in `cart-ajax.js → moneyFormat()`.
- **Currency / locale**: if you enable Shopify Markets with multiple currencies, the response from `/cart.js` returns the localised currency. The money format passed in `theme.liquid` should be `{{ cart.currency.symbol }}{{...}}` or use a `Shopify.currency` object — extend `cart-ajax.js → moneyFormat()` accordingly.

---

## 15. Theme settings (global merchant controls)

Settings live in **Shopify Admin → Online Store → Themes → Customize → Theme settings** (sidebar). Keep this panel **minimal** — only put genuinely global, design-system-level controls here. Anything page-specific belongs in a section's schema instead.

### Default schema (4 groups)

| Group | Settings | How it's applied |
|---|---|---|
| **Brand identity** | `logo`, `logo_width`, `favicon`, `social_share_image` | Header section reads `settings.logo` (falls back to inline SVG); `theme.liquid` reads `settings.favicon` + `settings.social_share_image` |
| **Custom CSS** | `custom_css` (textarea) | `snippets/theme-variables.liquid` emits `<style>{{ settings.custom_css }}</style>` in `<head>` after the theme's stylesheets — overrides anything without touching files |
| **Social** | `social_facebook_link`, `_instagram_`, `_twitter_`, `_linkedin_`, `_youtube_`, `_tiktok_` | Footer section loops through these and renders icons via `{% render 'social-icon' %}` |

That's it by default. Three groups — every line is a setting a merchant will actually touch.

### Why so few — and what was deliberately removed

Earlier versions of this kit shipped 10 groups (colors, typography, layout, header, cart, newsletter, SEO, animations…). It was overkill and **dangerous**: hard-coded color defaults in the schema seeded merchants with light-theme values (`#000` text on `#FFF` background) that overrode the Webflow CSS's dark-theme variables and made text invisible on dark backgrounds. The lesson: **theme settings that override CSS need to be empty-by-default** so they only apply when the merchant actively picks a value.

The **Custom CSS** textarea is the safety valve. Merchants who want to change a brand color, tweak spacing, swap a font weight, etc., paste a `:root { … }` block there. No theme update needed. No risk of breaking the design with wrong defaults.

### How to add more global settings (safely)

When you genuinely need a global setting (e.g. a sticky-header toggle), add it like this in `settings_schema.json`:

```json
{ "type": "checkbox", "id": "header_sticky", "label": "Sticky header", "default": true }
```

…and in `snippets/theme-variables.liquid`:

```liquid
{%- if settings.header_sticky -%}
  .component_header { position: sticky; top: 0; z-index: 100; }
{%- endunless -%}
```

For settings that override CSS variables, **always** use the `!= blank` guard so the design's defaults survive when the merchant hasn't picked a value:

```liquid
{%- if settings.color_brand_accent != blank -%}
  :root { --base-color-brand--orange: {{ settings.color_brand_accent }}; }
{%- endif -%}
```

And **never** put `"default": "#…"` on a color setting unless you're certain it matches what the CSS already uses.

### Per-section settings vs theme settings

| Use theme settings for… | Use section settings for… |
|---|---|
| Logo, favicon, social URLs | Per-section copy, images, blocks |
| Custom CSS that affects the whole site | A section's specific CTA URL |
| OG share image default | Whether a specific section is visible (`show_section`) |

Rule of thumb: **theme setting** if it should change everywhere at once; **section setting** if it might vary per page or per instance.

### Detecting your CSS's variables (for Custom CSS hints)

When merchants ask "what colors can I change?", point them at the variables your Webflow CSS exposes:

```bash
grep -oE -- "--[a-z][a-z0-9-]+:" assets/*.css | sort -u
```

The `Custom CSS` textarea's placeholder can hint at the most-overridable ones — e.g. `:root { --base-color-brand--orange: #E74C3C; }` for Panthor's accent.

---

## 16. What this conversion does NOT do

- Re-style any element. CSS is byte-identical.
- Rebuild the JS bundle. Webflow's `panthor-dev.js` ships verbatim.
- Convert the "Customise Your Machine" product UI into Shopify variants/line item properties. Currently static placeholder.
- Map Webflow CMS collections to Shopify metafields. (This export had no CMS lists.)
- Wire up Klaviyo / Mailchimp newsletter sync.

These are good follow-up tasks once visual parity is verified.
