#!/usr/bin/env node
/**
 * Webflow → Shopify bulk page-content extractor.
 *
 * For each source HTML file in PAGES, slices content between </header> and
 * <footer> (the "main"), rewrites asset paths and internal links to Shopify
 * equivalents, and writes:
 *   - sections/page-<slug>.liquid  (verbatim Webflow markup with show-section toggle)
 *   - templates/<name>.json        (OS 2.0 template pointing at that section)
 *
 * Page-specific dynamic data wiring (product/collection/blog/article) is
 * applied AFTER this script runs — see CONVERSION_GUIDE.md §E.
 *
 * Edit PAGES + HREF_MAP below for your project, then:
 *   node webflow-to-shopify-kit/scripts/convert.cjs
 *
 * Safe to delete after the first conversion.
 */
const fs = require('fs');
const path = require('path');

// Project root (where layout/, sections/, templates/ etc. live)
const ROOT = process.cwd();
// Where the unzipped Webflow export lives. Default: webflow-source/ at the
// project root. Change to '' if your HTML files are at the root, or to a
// nested path if your export is structured differently.
const SOURCE_DIR = path.join(ROOT, 'webflow-source');

// ────────────────────────────────────────────────────────────────────────────
// EDIT ME — your source pages and where they should end up in Shopify
// ────────────────────────────────────────────────────────────────────────────
const PAGES = [
  { html: 'index.html',             section: 'page-index',        templateFile: 'templates/index.json' },
  { html: 'product-template.html',  section: 'page-product',      templateFile: 'templates/product.json' },
  { html: 'shop.html',              section: 'page-collection',   templateFile: 'templates/collection.json' },
  { html: 'blog.html',              section: 'page-blog',         templateFile: 'templates/blog.json' },
  { html: 'article-template.html',  section: 'page-article',      templateFile: 'templates/article.json' },
  { html: 'about.html',             section: 'page-about',        templateFile: 'templates/page.about.json' },
  { html: 'contact.html',           section: 'page-contact',      templateFile: 'templates/page.contact.json' },
  { html: 'legal.html',             section: 'page-legal',        templateFile: 'templates/page.json' },
  { html: '404.html',               section: 'page-404',          templateFile: 'templates/404.json' },
];

// Map every internal *.html link to its Shopify route
const HREF_MAP = {
  'index.html':            "{{ routes.root_url }}",
  'about.html':            "{{ routes.root_url }}pages/about",
  'shop.html':             "{{ routes.collections_url }}/all",
  'blog.html':             "{{ routes.root_url }}blogs/news",
  'contact.html':          "{{ routes.root_url }}pages/contact",
  'legal.html':            "{{ routes.root_url }}pages/legal",
  '404.html':              "/404",
  '401.html':              "/password",
  'product-template.html': "{{ routes.collections_url }}/all",
  'article-template.html': "{{ routes.root_url }}blogs/news",
  // Add more here for your project's static pages
};

// ────────────────────────────────────────────────────────────────────────────
// Implementation (usually unchanged across projects)
// ────────────────────────────────────────────────────────────────────────────
function extractMain(html) {
  const hEnd = html.indexOf('</header>');
  const fStart = html.indexOf('<footer');
  if (hEnd !== -1 && fStart !== -1 && fStart > hEnd) {
    return html.substring(hEnd + '</header>'.length, fStart).trim();
  }
  const mStart = html.search(/<main\b/);
  const mEnd = html.indexOf('</main>');
  if (mStart !== -1 && mEnd !== -1) {
    return html.substring(mStart, mEnd + '</main>'.length).trim();
  }
  const bStart = html.indexOf('<body');
  const bEnd = html.indexOf('</body>');
  if (bStart !== -1 && bEnd !== -1) {
    const bodyOpen = html.indexOf('>', bStart) + 1;
    return html.substring(bodyOpen, bEnd).trim();
  }
  return html;
}

function extractTrailingScript(html) {
  const bEnd = html.indexOf('</body>');
  const fEnd = html.indexOf('</footer>');
  const startMarker = fEnd !== -1 ? fEnd + '</footer>'.length : 0;
  if (bEnd === -1) return '';
  const tail = html.substring(startMarker, bEnd);
  const scripts = [];
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(tail)) !== null) scripts.push(m[0]);
  return scripts.join('\n');
}

function rewriteAssets(html) {
  html = html.replace(/src="images\/([^"]+)"/g, (_, f) => `src="{{ '${f}' | asset_url }}"`);
  html = html.replace(/srcset="([^"]*images\/[^"]+)"/g, (_, sset) => {
    const fixed = sset.replace(/images\/([^\s,]+)/g, (_, file) => `{{ '${file}' | asset_url }}`);
    return `srcset="${fixed}"`;
  });
  html = html.replace(/href="images\/([^"]+)"/g, (_, f) => `href="{{ '${f}' | asset_url }}"`);
  html = html.replace(/url\(images\/([^)]+)\)/g, (_, f) => `url({{ '${f}' | asset_url }})`);
  return html;
}

function rewriteHrefs(html) {
  return html.replace(/href="([^"#?]+\.html)"/g, (orig, href) => {
    const repl = HREF_MAP[href];
    return repl ? `href="${repl}"` : orig;
  });
}

function wrapSection(content, sectionName, displayName, trailingScript) {
  const schema = {
    name: displayName,
    settings: [
      { type: 'checkbox', id: 'show_section', label: 'Show this section', default: true },
      { type: 'paragraph', content: `Imported from Webflow. Markup is preserved verbatim. To make text/images merchant-editable, split this into smaller sections — see CONVERSION_GUIDE §6.1.` }
    ],
    presets: [{ name: displayName }]
  };
  return `{%- if section.settings.show_section -%}\n${content}${trailingScript ? `\n${trailingScript}` : ''}\n{%- endif -%}\n\n{% schema %}\n${JSON.stringify(schema, null, 2)}\n{% endschema %}\n`;
}

function buildTemplateJson(sectionType) {
  return { sections: { main: { type: sectionType, settings: {} } }, order: ['main'] };
}

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
ensureDir(path.join(ROOT, 'sections'));
ensureDir(path.join(ROOT, 'templates'));

let ok = 0, missing = 0;
for (const p of PAGES) {
  const srcPath = path.join(SOURCE_DIR, p.html);
  if (!fs.existsSync(srcPath)) { console.warn(`MISSING: ${p.html}`); missing++; continue; }
  const raw = fs.readFileSync(srcPath, 'utf8');
  let main = extractMain(raw);
  const trailing = extractTrailingScript(raw);
  main = rewriteAssets(main);
  main = rewriteHrefs(main);

  const displayName = p.section.replace(/^page-/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Page';
  const sectionContent = wrapSection(main, p.section, displayName, trailing);
  fs.writeFileSync(path.join(ROOT, 'sections', `${p.section}.liquid`), sectionContent, 'utf8');

  const tplPath = path.join(ROOT, p.templateFile);
  ensureDir(path.dirname(tplPath));
  fs.writeFileSync(tplPath, JSON.stringify(buildTemplateJson(p.section), null, 2) + '\n', 'utf8');

  console.log(`OK  ${p.html}  →  sections/${p.section}.liquid + ${p.templateFile}`);
  ok++;
}

console.log(`\nDone. ${ok} converted, ${missing} missing.`);
