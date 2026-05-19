# Hands-off conversion brief

Paste the entire content of this file as your **first message** to Claude Code (or any AI coding agent) once you've:

1. Unzipped your Webflow export into `webflow-source/`
2. Copied the `webflow-to-shopify-kit/` folder into the project root

The AI will run the conversion end-to-end. You just review the final result and push to GitHub.

---

## YOUR TASK

You're converting a Webflow static-site export into a publishable Shopify Online Store 2.0 theme. The toolkit at `webflow-to-shopify-kit/` has scripts that do most of the mechanical work — your job is to run those, then handle the judgement-call steps the scripts can't.

**Working directory**: the project root (contains `webflow-source/` and `webflow-to-shopify-kit/`).

**Source of truth for "how to do X"**: `webflow-to-shopify-kit/CONVERSION_GUIDE.md`. Re-read it whenever stuck.

---

## STEP-BY-STEP

### 1. Run the orchestrator

```bash
bash webflow-to-shopify-kit/scripts/convert-all.sh   # or .ps1 on Windows
```

This handles install-skills, audit, flatten, bootstrap, page extract, form conversion, and the required-files check. Expect it to take 1–2 minutes. If anything errors out, fix the underlying issue (usually a missing file) and re-run.

### 2. Fill `layout/theme.liquid` placeholders from `AUDIT.md`

Open `AUDIT.md`. Open `layout/theme.liquid` + `layout/password.liquid`. Replace every `<…>` placeholder:

- `<YOUR_WF_SITE_ID>` ← the **data-wf-site** value from AUDIT.md (one occurrence in theme.liquid, two in password.liquid because it appears in both the html attribute and jQuery src)
- `<WF_PAGE_INDEX>`, `<WF_PAGE_PRODUCT>`, `<WF_PAGE_COLLECTION>`, `<WF_PAGE_BLOG>`, `<WF_PAGE_ARTICLE>`, `<WF_PAGE_ABOUT>`, `<WF_PAGE_CONTACT>`, `<WF_PAGE_GENERIC_PAGE>`, `<WF_PAGE_404>`, `<WF_PAGE_401>` ← per-page **data-wf-page** values from AUDIT.md's table
- `<WEBFLOW_BUNDLE>.js` ← the JS bundle filename from AUDIT.md (e.g. `mysite-dev.js`). The string `<WEBFLOW_BUNDLE>` appears twice in each layout file.
- `'site.css'` ← rename to the actual primary CSS filename from AUDIT.md (e.g. `'mysite-dev.css'`). Only swap if the name differs.

Then **also update `CLAUDE.md`**: replace `<BRAND>` with the brand/project name and `<your-org>` with the GitHub org.

### 3. Build `sections/header.liquid` + `sections/footer.liquid` from `webflow-source/index.html`

These are unique per brand and the scripts can't auto-generate them.

**For header**:
1. Open `webflow-source/index.html`, find the `<header class="component_header">…</header>` block, copy it verbatim into `sections/header.liquid`.
2. Apply the asset-URL rewrites the convert script applies elsewhere: `src="images/X"` → `src="{{ 'X' | asset_url }}"`, and internal `href="X.html"` → matching `{{ routes.* }}` URL (see kit `CONVERSION_GUIDE §4.3` for the full mapping table).
3. Replace the inline logo `<img src=...>` / `<svg>...</svg>` with this conditional:
   ```liquid
   {%- if settings.logo != blank -%}
     <img src="{{ settings.logo | image_url: width: 400 }}" loading="lazy" alt="{{ shop.name | escape }}" class="component_header_logo"{% if settings.logo_width %} style="max-width:{{ settings.logo_width }}px;"{% endif %}>
   {%- else -%}
     <!-- keep original SVG/img here as fallback -->
   {%- endif -%}
   ```
4. For the nav: wrap each `<a href="X.html">` rewrite with a check for `linklists[section.settings.main_menu]` (kit `CONVERSION_GUIDE §C` has the full pattern).
5. For the cart icon: add `data-cart-open` to the anchor and a `<span data-cart-count>{{ cart.item_count }}</span>` badge inside the icon wrap (kit `§14`).
6. Append a `{% schema %}` block with settings for `logo` (image_picker), `main_menu` (link_list), `cta_label`/`cta_url`/`cta_product` (text + url + product), and a preset. Pattern in panthor-test's `sections/header.liquid` if you need a worked example.

**For footer**: same approach with `<footer class="component_footer">`. The social row should loop the 6 `settings.social_*_link` globals (`facebook`, `instagram`, `twitter`, `linkedin`, `youtube`, `tiktok`) and render via `{% render 'social-icon', platform: platform %}`. Worked example: panthor-test's `sections/footer.liquid`.

**Create `sections/header-group.json` + `sections/footer-group.json`** as OS 2.0 section group manifests (3-line JSON each — pattern in kit `§9`).

### 4. Wire commerce in `sections/page-product.liquid` + `sections/page-collection.liquid`

This is the most judgement-heavy step. The scripts extracted these pages with all the Webflow markup intact but no Shopify data wired. You need to:

**Product page** (`sections/page-product.liquid`):
- Find `<h1>…product name…</h1>` and replace static text with `{{ product.title | default: 'static name here' }}`
- Find the price element and replace with `{% if product != blank %}{{ product.price | money }}{% else %}static-price{% endif %}` — keep a `data-product-price` attribute for variant-switch JS
- Find the description block — `{% if product != blank and product.description != blank %}{{ product.description }}{% else %}…static…{% endif %}`
- Find the variant buttons (e.g. `<button>Bolt Down</button>` style elements) — convert to `<button type="button" data-product-variant="{{ variant.id }}" data-variant-price="{{ variant.price }}" class="...is-active if selected">…</button>` inside a `{% for variant in product.variants %}` loop
- Find the gallery — loop `{% for media in product.media %}` with the original `<div class="swiper-slide">` wrapper
- Find the "Add to cart" button — wrap the whole variant+qty+add-to-cart region in `{%- form 'product', product, id: 'wf-form-Product' -%}…{%- endform -%}`. Inside: `<input type="hidden" name="id" data-product-variant-id>`, qty input gets `name="quantity"`, the add button becomes `<button type="submit" name="add" data-product-add>`.
- After `{% endform %}`, paste the inline variant-switching script that updates price+total+hidden id on variant clicks. Worked example in panthor-test's `sections/page-product.liquid` lines ~165–225.

**Collection page** (`sections/page-collection.liquid`):
- Find the static product-card grid (multiple repeated `.component_product_card` divs)
- Wrap with `{%- if collection != blank and collection.products.size > 0 -%}{%- paginate collection.products by 24 -%}{%- for product in collection.products -%}…dynamic card markup using {{ product.title }}, {{ product.price | money }}, {{ product.featured_image | image_url: width: 700 }}, {{ product.url }}…{%- endfor -%}{{ paginate | default_pagination }}{%- endpaginate -%}{%- else -%}…original static cards as fallback…{%- endif -%}`
- The "+" quick-add buttons on each dynamic card become `<button type="button" data-cart-quick-add="{{ product.selected_or_first_available_variant.id }}" onclick="event.stopPropagation();event.preventDefault();">` — pattern in kit `§14`.

**Blog list** (`sections/page-blog.liquid`) and **article** (`sections/page-article.liquid`): same pattern with `blog.articles` and `article.title / article.image / article.content / article.tags / article.published_at`. Wrap dynamic loop in `{% if blog != blank %}…{% else %}static fallback{% endif %}`.

**Always preserve static fallback content** so the section never looks broken in the theme editor when there's no product/collection/blog assigned yet.

### 5. (Optional) Split the homepage into per-block sections

If the merchant should be able to reorder homepage blocks in the theme editor:

```bash
# Find boundaries
grep -n "<section\|</section>" sections/page-index.liquid

# Edit BOUNDARIES in webflow-to-shopify-kit/scripts/split-page.cjs
# (set PAGE_PREFIX='home' if it's the homepage; copy line numbers from grep)
# Mark each section as kind:'home' (page-specific) or kind:'component'
#   (matches Webflow's `component_*_section` class — reusable across pages)

node webflow-to-shopify-kit/scripts/split-page.cjs
rm sections/page-index.liquid
```

Then enrich each section's schema with editable text/image/CTA settings per kit `§6.1`. Default values should match the original static content so out-of-the-box rendering is identical.

### 6. Re-run the required-files check + JSON/Liquid validators

```bash
bash webflow-to-shopify-kit/scripts/check-required-files.sh

# Validate schema JSON inside every section
node -e "const fs=require('fs');for(const f of fs.readdirSync('sections').filter(x=>x.endsWith('.liquid'))){const c=fs.readFileSync('sections/'+f,'utf8');const m=c.match(/\\{%\\s*schema\\s*%\\}([\\s\\S]*?)\\{%\\s*endschema\\s*%\\}/);if(m){try{JSON.parse(m[1])}catch(e){console.log(f+': '+e.message)}}}"

# Liquid tag balance (one-liner adapted from CLAUDE.md template)
node -e "const fs=require('fs');for(const f of fs.readdirSync('sections').filter(x=>x.endsWith('.liquid'))){const c=fs.readFileSync('sections/'+f,'utf8');for(const [o,e] of [['form','endform'],['if','endif'],['for','endfor'],['case','endcase'],['paginate','endpaginate']]){const op=(c.match(new RegExp('\\\\{%[-\\\\s]*'+o+'\\\\b','g'))||[]).length;const cl=(c.match(new RegExp('\\\\{%[-\\\\s]*'+e+'\\\\b','g'))||[]).length;if(op!==cl)console.log(f+' UNBAL '+o+':'+op+'/'+cl)}}"
```

Fix anything flagged. Most common: a `{% if %}` you opened but didn't close, or a schema JSON with a trailing comma.

### 7. Report what you did + flag what needs the user

Summarize for the user:
- Which scripts ran cleanly
- Which placeholder values you filled (count, file list)
- Header + footer status (built / blocked on X)
- Per-page commerce wiring status (done / done with fallback only / blocked on…)
- Any forms beyond newsletter that need manual conversion (look for `wf-form-Enquiry-Form`, contact forms, etc. — list them in your report)
- Anything that didn't auto-resolve (e.g. a Webflow class name that doesn't match expectations, a missing image referenced by CSS)

The user will then:
- Review the diff
- `git add -A && git commit -m "..." && git push`
- Connect the repo to a Shopify dev store
- Import products + click Publish

---

## CONVENTIONS YOU MUST FOLLOW

These exist because they caused real bugs in past conversions — see kit `CONVERSION_GUIDE §13`.

- **Never modify** `assets/*.css` or `assets/*.js` (the Webflow files). Style overrides go in theme settings → Custom CSS.
- **Never rename a Webflow class** — they're load-bearing for both CSS and the bundled JS.
- **Never strip `data-wf-*` attributes** from any element.
- **Inside `{% liquid %}` tags**: one statement per line. Semicolons are NOT valid separators — they cause silent parse failure that Shopify reports as the cryptic "missing required file layout/theme.liquid" error.
- **Every image_picker setting needs a 3-tier fallback**: `image_picker → fallback_image filename → hard-coded asset`. Empty image pickers should NEVER render a broken `<img>`.
- **Every block-based section needs an `{% else %}` branch** with the original Webflow markup verbatim, so the page never looks empty when the merchant clears blocks.
- **Color settings should not have `default` values** unless verified against the actual CSS — wrong defaults override the dark-theme Webflow CSS and make text invisible (see kit `§13` for the dark-mode bug).
- **Commit format**: Conventional Commits per `CLAUDE.md`. e.g. `feat(home): split hero into its own section`.

---

## WHEN IN DOUBT

1. `webflow-to-shopify-kit/CONVERSION_GUIDE.md` — the full recipe with every gotcha
2. The Shopify AI skills installed in `.agents/skills/` (`shopify-dev`, `shopify-liquid`) — authoritative reference for Liquid filters, Shopify objects, theme architecture
3. The panthor-test repo (if available) — a worked example of every section type

Don't guess. Read the guide.
