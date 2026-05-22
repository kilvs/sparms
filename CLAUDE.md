{%- comment -%}
After bootstrapping a new project from this kit, edit the PLACEHOLDERS in
this file (search for `<...>` brackets) so AI assistants — Claude Code,
GitHub Copilot, Cursor, Cline, Amp, Codex — write commits in this project's
voice.

Loaded automatically by Claude Code; most other AI tools also surface root
markdown files as project context.
{%- endcomment -%}

# Claude project guide

> **AI assistants — read these once before answering anything else:**
>
> 1. `webflow-to-shopify-kit/CONVERSION_GUIDE.md` — the full Webflow → Shopify recipe (~16 sections, every gotcha worth knowing)
> 2. `webflow-to-shopify-kit/CONVERT_PROMPT.md` — the hands-off conversion brief (steps, conventions, what NOT to do)
>
> They're ~30 KB combined. Reading them first means you won't re-invent the dark-mode bug, the `{% liquid %}` semicolon trap, or the "missing layout/theme.liquid" rabbit hole. If this is a fresh Webflow conversion, follow `CONVERT_PROMPT.md` end-to-end. If it's maintenance on an existing theme, the guide is your reference.

This file gives AI assistants the context they need to write good commit messages and PRs for this repo.

---

## User preferences

- **Commit messages**: don't prefix with `git add ...` instructions — just the message body in a copyable block. The user runs `git add` themselves.
- **Conventional Commits** format: `type(scope): summary` (see "Commit conventions" below).
- **Don't ask permission to read** the guide / prompt / shopify-liquid skill — read them when relevant.
- **Surface flagged-out-of-scope work** (gotchas the user might miss) rather than silently fixing everything.

---

## What this repo is

A **Shopify Online Store 2.0 theme** converted from a Webflow export for **SParms**. Shopify theme files (assets/, config/, layout/, sections/, snippets/, templates/) live at the repo root. The original Webflow export lives in `webflow-source/` for side-by-side verification and is excluded from theme deploys via `.shopifyignore`.

The conversion is **visual-parity first** — original Webflow CSS, JS bundle, class names, and `data-wf-*` attributes are preserved verbatim. See `CONVERSION_GUIDE.md` for the full recipe.

Bootstrapped from [webflow-to-shopify-kit](https://github.com/kilvs/webflow-to-shopify-kit). When in doubt, the kit's `CONVERSION_GUIDE.md` is the source of truth for "how do I…?".

---

## Repo layout

**Shopify theme files** (at repo root — picked up by Shopify CLI / GitHub integration):

| Path | What lives here |
|---|---|
| `assets/` | Flat folder — CSS, JS, fonts, images. Shopify forbids subdirs. |
| `config/` | `settings_schema.json` (theme settings) + `settings_data.json` (values). |
| `layout/` | `theme.liquid` (main wrapper) + `password.liquid`. |
| `locales/` | i18n strings (`en.default.json`). |
| `sections/` | `header.liquid`, `footer.liquid`, `home-*` (page-specific homepage blocks), `component-*` (reusable across pages), `page-*` (static pages), `main-*` (cart / search / 404 / password / list-collections). |
| `snippets/` | `cart-drawer.liquid`, `social-icon.liquid`, `wf-form-states.liquid`, `theme-variables.liquid` (custom-CSS bridge). |
| `templates/` | OS 2.0 JSON templates; `customers/*.liquid` (required); `gift_card.liquid` (must be .liquid, not .json). |
| `.shopifyignore` | Excludes `webflow-source/`, conversion scripts, and docs from theme uploads. |

**Source + tooling** (excluded from theme deploys):

| Path | What lives here |
|---|---|
| `webflow-source/` | Original Webflow export — all `*.html` plus `css/`, `js/`, `images/`, `fonts/`. Reference only, never deployed. |
| `.agents/skills/` | Shopify's official AI-assistant skills (shopify-dev, shopify-liquid). |
| `CONVERSION_GUIDE.md` | Full Webflow→Shopify recipe with every gotcha. |
| `CLAUDE.md` | This file. |

---

## Commit message conventions

Use **Conventional Commits**: `type(scope): short imperative summary`. Keep the summary ≤ 72 chars; add a body only when the *why* needs explaining.

### Types

| Type | When to use |
|---|---|
| `feat` | New section, new template, new merchant-editable setting. |
| `fix` | Broken layout, missing asset, wrong Liquid output, form submitting incorrectly. |
| `style` | CSS-level adjustments only (rare — most styles come from the Webflow CSS). |
| `refactor` | Restructure sections, extract snippets, rename schema settings without changing output. |
| `chore` | Asset re-flattening, dependency bumps, conversion script tweaks, `.shopifyignore` edits. |
| `docs` | Updates to `CONVERSION_GUIDE.md`, `CLAUDE.md`, inline comments. |
| `content` | Default copy/image swaps in section schemas. |
| `perf` | Image format swaps, lazy-load tweaks, removing unused JS. |

### Scopes

Pick the narrowest scope that fits. Common scopes for this kind of repo:

- `theme` — `layout/theme.liquid`, `layout/password.liquid`
- `header`, `footer` — header/footer sections + section groups
- `home`, `product`, `collection`, `blog`, `article`, `cart`, `search`, `404` — corresponding section + template
- `page-<name>` — static pages: `page-about`, `page-contact`, `page-legal`, etc.
- `component-<name>` — reusable cross-page sections: `component-newsletter`, `component-faq`, etc.
- `forms` — newsletter / contact / password form wiring across files
- `assets` — anything inside `assets/`
- `config` — `settings_schema.json` / `settings_data.json`
- `locales` — translation files
- `snippets` — `snippets/*.liquid`
- `cart` — `cart-ajax.js`, cart drawer, cart wiring
- `guide` — `CONVERSION_GUIDE.md` or `CLAUDE.md`
- `webflow-bridge` — preserving Webflow JS bundle / `data-wf-*` attributes / `w-mod-*` classes
- `kit` — changes to scripts/docs inside `webflow-to-shopify-kit/` (gotchas captured, scripts fixed, README/CONVERSION_GUIDE updates)

### Examples

```
feat(home): split hero into its own section so merchants can swap the image
fix(product): wire Add to Cart button into {% form 'product' %} block
fix(forms): map newsletter email field to contact[email]
refactor(footer): move social SVGs into snippets/social-icon
chore(assets): re-flatten new font files from latest Webflow export
docs(guide): add filename-collision check to step 3
feat(cart): wire AJAX add-to-cart with custom Webflow drawer markup
fix(webflow-bridge): force w-mod-ix3 so typewriter isn't hidden
```

### When NOT to bundle

- Don't mix a new section with a footer fix — split into two commits.
- Don't bundle asset re-flattening with template edits — they're independent.
- Cross-page form rewiring is fine as one commit if it's the same pattern applied uniformly.

---

## Things to check before committing

1. **CSS edits**: if the diff touches `assets/*.css`, double-check — the rule is **don't modify Webflow CSS**. Style adjustments belong in `theme settings → Custom CSS` (which `snippets/theme-variables.liquid` emits to `<head>`), or in a new asset file you load after.
2. **`data-wf-*` attributes**: never strip from `<html>` or any element. Webflow's JS keys off them.
3. **Class names**: don't rename. They're load-bearing for both CSS and the bundled JS.
4. **Schema JSON**: every `{% schema %}` block must be valid JSON. Bulk-validator one-liner:
   ```bash
   node -e "const fs=require('fs');for(const f of fs.readdirSync('sections').filter(x=>x.endsWith('.liquid'))){const c=fs.readFileSync('sections/'+f,'utf8');const m=c.match(/\\{%\\s*schema\\s*%\\}([\\s\\S]*?)\\{%\\s*endschema\\s*%\\}/);if(m){try{JSON.parse(m[1])}catch(e){console.log(f+': '+e.message)}}}"
   ```
5. **`{% liquid %}` tags**: one statement per line. Semicolons are NOT valid separators — they cause silent parse failure that Shopify reports as "missing required file layout/theme.liquid".
6. **Liquid tag balance**: `{% form %}` / `{% endform %}`, `{% if %}` / `{% endif %}`, etc. must balance. If you edited a section with a Shopify form, verify both ends.
7. **Asset references**: new images go in `assets/` (flat). Reference them with `{{ 'filename.ext' | asset_url }}`, never with a hard-coded path.
8. **Routes**: use `{{ routes.* }}` (`routes.root_url`, `routes.cart_url`, `routes.collections_url`, etc.) — never hard-code `/cart`, `/collections/all`, etc.
9. **Theme settings**: when adding a setting that overrides CSS, always `{% if settings.X != blank %}…{% endif %}` so the design's defaults survive an empty value. Never hard-code `"default": "#…"` on a color setting unless verified against the actual CSS.
10. **Required Shopify files**: before publishing, run the kit's checker:
    ```bash
    bash webflow-to-shopify-kit/scripts/check-required-files.sh
    ```
    All 7 `customers/*.liquid`, `gift_card.liquid` (must be `.liquid`), `list-collections.json`, `password.json` must exist or publish fails with the misleading "missing layout/theme.liquid" error.
11. **Block-based sections need both seeded template blocks AND `{% else %}` fallbacks.** Adding `schema.blocks` to a section file doesn't seed those blocks into existing template-instantiated sections (`presets.blocks` only fires when a merchant adds a section fresh from the editor). After enriching schemas, run `node webflow-to-shopify-kit/scripts/seed-template-blocks.cjs` to write block instances into `templates/*.json`, AND make sure every `{% for block in section.blocks %}` has an `{% else %}` branch with verbatim Webflow markup as a fallback. Skipping either causes blank sections in production.
12. **Swiper v12 `enabled: false` breakpoint config is broken.** The original Webflow may use `breakpoints: { 0: { enabled: false, ... } }` to disable mobile swipe; in v12 that disables the entire carousel and ignores the desktop override. Drop the `enabled` toggle.
13. **`videos/` and `documents/` need to be in `assets/` too.** `flatten-assets.{sh,ps1}` now handles them, but if you see a 404 on a hero video or PDF, check whether the files made it in.
14. **`.home_hero_load` and similar fullscreen overlays must end at `display: none`, not `autoAlpha: 0`.** GSAP's `autoAlpha: 0` sets `visibility: hidden` — the element stays in the DOM. For fixed-positioned hero loaders, that's enough to silently capture clicks. The first-visit timeline needs `onComplete: () => loadEl.style.display = 'none'`, and the second-visit `hasSeenIntro` shortcut should go straight to `display: none`.
15. **Section schema `tag` value matters.** Valid: `article`, `aside`, `div`, `footer`, `header`, `section`, or property omitted (defaults to `<div>`). `"tag": null` silently kills section rendering — no error, just an invisible section. Grep `"tag":\s*null` in `sections/*.liquid` before committing. Sparms uses `tag: "header"` on `sections/header.liquid` and `tag: "div"` on `sections/footer.liquid` (because the footer markup already opens with `<footer>`).
16. **Sparms renders header + footer via direct `{% section %}` calls, not section groups.** `theme.liquid` uses `{% section 'header' %}` (singular) and `{% section 'footer' %}` to render `sections/header.liquid` and `sections/footer.liquid` directly. There are no `header-group.json` / `footer-group.json` files. Do not introduce them without asking — see the section setup memory for the trade-off rationale. Critical distinction: `{% sections %}` (plural) loads a section group manifest `.json`; `{% section %}` (singular) loads a section file `.liquid`. Don't mix them.

---

## PR / multi-commit guidance

When grouping commits into a PR, the title follows the same convention as the strongest individual commit. The description should call out:

- What user-facing thing changed (or didn't — visual parity)
- Whether the original Webflow markup was touched
- Any new schema settings merchants will see in the theme editor
- Verification: which routes were spot-checked

If unsure whether something deserves its own commit, ask: "would I want to revert this change independently?" If yes → own commit.
