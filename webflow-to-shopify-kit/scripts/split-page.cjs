#!/usr/bin/env node
/**
 * Splits a monolithic sections/page-<name>.liquid into per-block sections.
 *
 * Webflow's classes use two patterns:
 *   - <section class="<page>_*_section">       → page-specific → sections/<page>-NN-<slug>.liquid
 *   - <section class="component_*_section">    → REUSABLE      → sections/component-<slug>.liquid
 *
 * Component sections are reused across pages — they get a flat name without
 * page prefix so any page's JSON template can reference the same type.
 *
 * Step 1: list the top-level sections in the source file with:
 *   grep -n "<section\|</section>" sections/page-<name>.liquid
 *
 * Step 2: edit SRC and BOUNDARIES below to match those line numbers + slugs.
 *
 * Step 3: run:
 *   node webflow-to-shopify-kit/scripts/split-page.cjs
 *
 * Step 4: verify rendering, then delete the original sections/page-<name>.liquid.
 *
 * Safe to delete after running.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

// ────────────────────────────────────────────────────────────────────────────
// EDIT ME — the monolithic source section + page prefix + boundaries
// ────────────────────────────────────────────────────────────────────────────
const SRC = path.join(ROOT, 'sections', 'page-index.liquid');
const PAGE_PREFIX = 'home';   // e.g. 'home', 'about', 'product'
const TEMPLATE = path.join(ROOT, 'templates', 'index.json');

// Each entry: kind 'home' (page-specific) or 'component' (reusable),
// the slug (used in filename + schema name), and 1-based inclusive line range.
const BOUNDARIES = [
  { kind: 'home',      orderIdx: 1, slug: 'hero',            name: 'Home — Hero',            startLine: 3,    endLine: 64   },
  { kind: 'component',              slug: 'logo',            name: 'Logo strip',             startLine: 65,   endLine: 131  },
  { kind: 'home',      orderIdx: 2, slug: 'product-slider',  name: 'Home — Product slider',  startLine: 132,  endLine: 494  },
  { kind: 'component',              slug: 'feature',         name: 'Feature',                startLine: 495,  endLine: 628  },
  { kind: 'component',              slug: 'collection',      name: 'Collection swiper',      startLine: 629,  endLine: 970  },
  { kind: 'component',              slug: 'ambassadors',     name: 'Ambassadors',            startLine: 971,  endLine: 1256 },
  { kind: 'component',              slug: 'testimonial',     name: 'Testimonial',            startLine: 1257, endLine: 1711 },
  { kind: 'component',              slug: 'cta',             name: 'CTA',                    startLine: 1712, endLine: 1733 },
  { kind: 'component',              slug: 'community',       name: 'Community',              startLine: 1734, endLine: 1800 },
];

// ────────────────────────────────────────────────────────────────────────────
function pad2(n) { return n < 10 ? '0' + n : String(n); }
function fileNameFor(b) {
  return b.kind === 'home'
    ? `${PAGE_PREFIX}-${pad2(b.orderIdx)}-${b.slug}.liquid`
    : `component-${b.slug}.liquid`;
}
function schemaFor(b) {
  const cls = b.kind === 'home'
    ? `shopify-section-${PAGE_PREFIX}-${b.slug}`
    : `shopify-section-component-${b.slug}`;
  return {
    name: b.name, tag: 'section', class: cls,
    settings: [
      { type: 'checkbox', id: 'show_section', label: 'Show this section', default: true },
      { type: 'paragraph', content: 'Imported from Webflow. To make text/images editable, add settings here or split into blocks — see CONVERSION_GUIDE §6.1.' }
    ],
    presets: [{ name: b.name }]
  };
}

if (!fs.existsSync(SRC)) {
  console.error(`SOURCE NOT FOUND: ${SRC}`);
  console.error(`Run from your project root, or edit SRC at the top of this script.`);
  process.exit(1);
}

const src = fs.readFileSync(SRC, 'utf8');
const lines = src.split(/\r?\n/);
const orderKeys = [];
const sectionsManifest = {};

for (const b of BOUNDARIES) {
  const slice = lines.slice(b.startLine - 1, b.endLine).join('\n');
  const fileName = fileNameFor(b);
  const schemaBlock = `\n\n{% schema %}\n${JSON.stringify(schemaFor(b), null, 2)}\n{% endschema %}\n`;
  const content =
`{%- if section.settings.show_section -%}
${slice}
{%- endif -%}${schemaBlock}`;
  fs.writeFileSync(path.join(ROOT, 'sections', fileName), content, 'utf8');
  console.log(`WROTE sections/${fileName}`);

  const sectionType = fileName.replace(/\.liquid$/, '');
  orderKeys.push(b.slug);
  sectionsManifest[b.slug] = { type: sectionType, settings: { show_section: true } };
}

fs.writeFileSync(TEMPLATE, JSON.stringify({ sections: sectionsManifest, order: orderKeys }, null, 2) + '\n', 'utf8');
console.log(`WROTE ${path.relative(ROOT, TEMPLATE)}`);
console.log(`\nDone. Verify rendering, then delete ${path.relative(ROOT, SRC)}.`);
