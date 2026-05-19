# Webflow → Shopify OS 2.0 Kit

A self-contained starter kit that turns any Webflow static-site export into a publishable Shopify Online Store 2.0 theme. Visual parity first, merchant-editable second, commerce-functional third.

Drop this folder next to the unzipped Webflow export, run the scripts in order, fill in the placeholders in `starter-theme/`, and you have a working Shopify theme that passes publish-time validation.

---

## What's in this kit

```
webflow-to-shopify-kit/
├── README.md                 # this file
├── CONVERSION_GUIDE.md       # full ~700-line recipe with every step + gotcha
├── CONVERT_PROMPT.md              # paste into Claude Code for hands-off conversion
├── scripts/
│   ├── convert-all.{sh,ps1}       # ▶ orchestrator: runs every automatable step in sequence
│   ├── install-skills.{sh,ps1}    # Step 0 — installs shopify-dev + shopify-liquid AI skills
│   ├── audit-source.{sh,ps1}      # Step 2 — writes AUDIT.md with data-wf-* IDs + components
│   ├── flatten-assets.{sh,ps1}    # Step 3 — copies + rewrites webflow-source/ into flat assets/
│   ├── convert.cjs                # Step 6 — bulk page-content extractor (HTML → sections + templates)
│   ├── convert-forms.cjs          # Step 7 — bulk Webflow newsletter → Shopify {% form %} converter
│   ├── split-page.cjs             # Step 9 — splits monolithic page section into per-block sections
│   └── check-required-files.sh    # Step 10 — pre-push verifier
└── starter-theme/            # universal theme files you can copy verbatim
    ├── CLAUDE.md             # template AI commit-message context — edit <BRAND> placeholder
    ├── assets/
    │   ├── cart-ajax.js      # AJAX cart module — vanilla JS, no jQuery dep
    │   └── cart-drawer.css   # drawer styling, scoped under .cart-drawer__*
    ├── config/
    │   ├── settings_schema.json
    │   └── settings_data.json
    ├── layout/
    │   ├── theme.liquid      # PLACEHOLDERS for data-wf-site + per-template wf_page_id
    │   └── password.liquid
    ├── locales/
    │   └── en.default.json
    ├── sections/
    │   ├── main-cart.liquid
    │   ├── main-search.liquid
    │   ├── main-password.liquid
    │   └── main-list-collections.liquid
    ├── snippets/
    │   ├── cart-drawer.liquid
    │   ├── wf-form-states.liquid
    │   └── social-icon.liquid
    ├── templates/
    │   ├── 404.json
    │   ├── cart.json
    │   ├── search.json
    │   ├── password.json
    │   ├── list-collections.json
    │   ├── gift_card.liquid     # MUST be .liquid, not .json
    │   └── customers/
    │       ├── account.liquid
    │       ├── activate_account.liquid
    │       ├── addresses.liquid
    │       ├── login.liquid
    │       ├── order.liquid
    │       ├── register.liquid
    │       └── reset_password.liquid
    └── .shopifyignore
```

Brand-specific files (`sections/header.liquid`, `sections/footer.liquid`, `sections/page-*.liquid`) are NOT included — those come out of the source HTML via the scripts.

---

## Hands-off mode (recommended)

If you'd rather not run the steps yourself, do exactly this:

1. **Create a project folder.** `git init` it.
2. **Drop the kit folder in.** Copy `webflow-to-shopify-kit/` into the project root.
3. **Unzip your Webflow export into `webflow-source/`** at the project root.
4. **Open the project in Claude Code** (or another AI coding agent) and paste `webflow-to-shopify-kit/CONVERT_PROMPT.md` as your **first message**.

The AI runs the orchestrator (`bash webflow-to-shopify-kit/scripts/convert-all.sh`) for the mechanical steps, then handles the judgement-call steps (placeholder fill, header/footer build, commerce wiring) using the kit's `CONVERSION_GUIDE.md` and the installed Shopify AI skills. You review the result and push.

**Your total active time: ~20 minutes** (drop files in + review the AI's diff + commit + connect Shopify + import products + publish). Everything else runs without you.

If you want to follow along step-by-step instead, the manual quickstart is below.

---

## Manual quickstart

### Prerequisites
- Node.js 18+ (with `pnpm` or `npx`)
- The Webflow export unzipped at a known location
- A Shopify dev store (`shopify.dev/themes/getting-started`)

### Step 0 — install Shopify's AI-assistant skills (recommended)

From your new project's root, run the bundled installer to drop **shopify-dev** + **shopify-liquid** skills into `.agents/skills/`:

```bash
# Unix / git-bash
bash webflow-to-shopify-kit/scripts/install-skills.sh

# Windows PowerShell
pwsh webflow-to-shopify-kit/scripts/install-skills.ps1
```

These are Shopify's official skills for AI coding assistants (Claude Code, GitHub Copilot, Cursor, Amp, Cline, Codex, etc.). Once installed, any AI agent working on the repo has authoritative reference for Liquid tags, Shopify objects, the cart/customer/product APIs, and theme architecture — meaning fewer hallucinated Liquid filters, less guessing about schema settings, faster, more correct PRs.

Commit `.agents/` so collaborators get them too:

```powershell
git add .agents
git commit -m "chore: add shopify-dev + shopify-liquid skills"
```

Skip this step if you're not using AI tooling — nothing else in the kit depends on it.

### Step 1 — drop the Webflow export into `webflow-source/`

Unzip your Webflow export and place the contents in `webflow-source/` at the project root. The structure inside is the raw export — `*.html` files plus `css/`, `js/`, `images/`, `fonts/` subfolders:

```
your-project/
├── webflow-source/         ← here
│   ├── index.html
│   ├── product-template.html
│   ├── …other.html
│   ├── css/  js/  images/  fonts/
└── webflow-to-shopify-kit/
```

This keeps Shopify-required files at the repo root (where Shopify expects them) and the Webflow originals isolated for reference + side-by-side comparison. `.shopifyignore` excludes `webflow-source/` from theme uploads.

### Step 2 — audit the source (one command)

```bash
# Unix / git-bash
bash webflow-to-shopify-kit/scripts/audit-source.sh

# Windows PowerShell
pwsh webflow-to-shopify-kit/scripts/audit-source.ps1
```

Writes `AUDIT.md` at the project root containing:
- `data-wf-site` (constant)
- `data-wf-page` ID per HTML page (as a table)
- Reusable `component_*_section` classes per page
- Webflow JS bundle filename
- CSS filenames
- Form IDs needing manual conversion

You'll reference these values in Step 7 when filling layout placeholders. Keep `AUDIT.md` open in another tab.

### Step 3 — flatten assets (one command)

```bash
# Unix / git-bash
bash webflow-to-shopify-kit/scripts/flatten-assets.sh

# Windows PowerShell
pwsh webflow-to-shopify-kit/scripts/flatten-assets.ps1
```

Copies `webflow-source/{css,js,images,fonts}/*` → `assets/`, rewrites `url('../fonts/X')` and `url('../images/X')` in CSS to bare filenames, and checks for filename collisions. Exits with an error (no destructive overwrite) if any are found.

### Step 4 — copy the kit's starter-theme

```bash
cp -r webflow-to-shopify-kit/starter-theme/* .
```

This drops in every Shopify-required file: layout, customer templates, gift_card, password, list-collections, AJAX cart, snippets, config, locales, **plus a `CLAUDE.md` template** so AI assistants on this project know its conventions immediately.

### Step 5 — fill placeholders

Three files have `<…>` placeholders:

| File | What to replace |
|---|---|
| `layout/theme.liquid` | `<YOUR_WF_SITE_ID>` (constant `data-wf-site` from step 1), `<WF_PAGE_*>` (per-template `data-wf-page` IDs from step 1), `<WEBFLOW_BUNDLE>.js` (filename of your site's main JS bundle in assets/), and `'site.css'` (rename to your CSS filename if different) |
| `layout/password.liquid` | Same `<YOUR_WF_SITE_ID>` and `<WEBFLOW_BUNDLE>` placeholders |
| `CLAUDE.md` | `<BRAND>` (your project / client name) and `<your-org>` in the kit link |

### Step 6 — extract page content

Edit `webflow-to-shopify-kit/scripts/convert.cjs` to list your source HTML files in the `PAGES` array, then:

```bash
node webflow-to-shopify-kit/scripts/convert.cjs
```

Produces `sections/page-*.liquid` and `templates/*.json` for each page. Internal `*.html` links and `images/*` asset references are rewritten to Shopify routes and `{{ 'foo.png' | asset_url }}`.

### Step 7 — convert Webflow forms

```bash
node webflow-to-shopify-kit/scripts/convert-forms.cjs
```

Bulk-replaces Webflow newsletter forms with Shopify's `{% form 'customer' %}` carrying a `newsletter` tag. Contact forms (Webflow's `wf-form-Enquiry-Form`) need manual conversion — see `CONVERSION_GUIDE.md §8`.

### Step 8 — build header + footer sections

These need to be hand-built from each export because the logo SVG, nav menu, and footer socials are unique per brand. See `CONVERSION_GUIDE.md §C` for the template — copy `<header class="component_header">` from your `index.html` verbatim into `sections/header.liquid` and add a `{% schema %}` block.

### Step 9 — split high-traffic pages (optional but recommended)

For the homepage and any landing page where the merchant should be able to reorder blocks in the theme editor:

```bash
# Edit BOUNDARIES in split-page.cjs to point at your monolithic section
node webflow-to-shopify-kit/scripts/split-page.cjs
```

Output: `sections/<page>-NN-<slug>.liquid` for page-specific blocks, `sections/component-<slug>.liquid` for reusable ones (matched by Webflow's `component_*_section` class prefix).

### Step 10 — verify required files

```bash
bash webflow-to-shopify-kit/scripts/check-required-files.sh
```

Lists any Shopify-required file that's missing. Must be empty before you try to publish.

### Step 11 — preview + ship

```bash
shopify theme dev --store <your-store>.myshopify.com
# Visit /, /products/<test>, /collections/all, /pages/about, /cart, /search, /404, /password
shopify theme check  # fix flagged issues WITHOUT touching original Webflow markup
shopify theme push --unpublished
```

In Shopify Admin → Themes → publish. If you get **"Role can't be set to main: missing required file layout/theme.liquid"** the file isn't actually missing — it's a parse error OR another required file is missing. See `CONVERSION_GUIDE.md §13`.

---

## What the kit does NOT do

- Re-style anything. Webflow CSS ships as-is.
- Touch the JS bundle (`*-dev.js` from the export).
- Migrate Webflow CMS collections to Shopify metafields.
- Wire Klaviyo / Mailchimp newsletter sync.
- Auto-generate header/footer sections (logos and nav are unique per brand).
- Generate the brand's `data-wf-page` table (you provide these from step 1).

---

## Sanity checks per stage

| After step | Run this | Expected output |
|---|---|---|
| 2 | open `AUDIT.md` | data-wf-site + per-page data-wf-page table populated |
| 3 | `ls assets/ \| sort \| uniq -d` | empty (no collisions) |
| 3 | `grep -c "\.\./" assets/*.css` | 0 |
| 5 | open `layout/theme.liquid` | no `<...>` placeholders left |
| 6 | `ls sections/page-*.liquid` | one per source HTML |
| 7 | `grep -l "<form\b" sections/*.liquid` | no Webflow newsletter forms remain |
| 10 | `bash webflow-to-shopify-kit/scripts/check-required-files.sh` | "All required files present." |
| 11 | DevTools console | no 404s on fonts/images; `document.documentElement.className` contains `w-mod-js w-mod-ix3` |

---

## Reading order

1. This README for the high-level pipeline
2. `CONVERSION_GUIDE.md` for the full recipe and every gotcha worth knowing
3. The script source — each is under 200 lines and heavily commented

If you hit something not in the guide, that's a new gotcha — please log it back to `CONVERSION_GUIDE.md §13 Common gotchas` for the next conversion.
