#!/usr/bin/env node
/**
 * Seeds template JSON files with block instances from each section's preset.
 *
 * THE PROBLEM
 *   `schema.presets.blocks` only seeds blocks when a merchant clicks "Add
 *   section" from the theme editor on a fresh section. Sections that come
 *   from a JSON template (templates/index.json, templates/page.about.json,
 *   etc.) start with whatever blocks the JSON declares -- empty if blocks
 *   aren't specified.
 *
 *   Result: after running split-page.cjs and then enriching schemas with
 *   `schema.blocks` (per CONVERSION_GUIDE section 6.1), the homepage renders
 *   with empty sections because the template was generated before the
 *   blocks existed.
 *
 * THE FIX
 *   This script reads every section file referenced in a template, extracts
 *   the first `presets.blocks` array from each section's schema, and writes
 *   those block instances into the template's section entry as
 *   `blocks` + `block_order`.
 *
 *   Run this AFTER you've finished the section.6.1 enrichment pass, but
 *   BEFORE pushing to Shopify -- once a template is in a live theme, the
 *   merchant's customizations take precedence.
 *
 * USAGE
 *   # All JSON templates in templates/
 *   node webflow-to-shopify-kit/scripts/seed-template-blocks.cjs
 *
 *   # Specific template
 *   node webflow-to-shopify-kit/scripts/seed-template-blocks.cjs templates/index.json
 *
 *   # Dry-run (show what would change, don't write)
 *   node webflow-to-shopify-kit/scripts/seed-template-blocks.cjs --dry
 *
 *  GOTCHAS
 *   - Only re-seeds sections that don't already have `blocks` declared in
 *     the template. Won't overwrite merchant customizations stored in the
 *     template.
 *   - Section files must have valid `schema.presets[0].blocks`. If the
 *     preset has no blocks, the section is skipped.
 *   - Block IDs are auto-generated as "<sectionId>-<blockType>-<N>".
 *
 *  Safe to delete after running.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const args = process.argv.slice(2);
const dryRun = args.includes('--dry');
const targets = args.filter(a => !a.startsWith('--'));

function extractSchema(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const src = fs.readFileSync(filePath, 'utf8');
  const m = src.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch (e) {
    console.warn(`WARN: invalid schema JSON in ${filePath}: ${e.message}`);
    return null;
  }
}

function findFirstPresetBlocks(schema) {
  if (!schema || !Array.isArray(schema.presets)) return null;
  for (const p of schema.presets) {
    if (Array.isArray(p.blocks) && p.blocks.length > 0) return p.blocks;
  }
  return null;
}

function loadJsonTemplate(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  // Shopify allows /* ... */ comments at the top of JSON templates; strip
  // them before parsing, preserve them when writing.
  const commentMatch = raw.match(/^(\s*\/\*[\s\S]*?\*\/\s*)/);
  const comment = commentMatch ? commentMatch[1] : '';
  const body = comment ? raw.slice(comment.length) : raw;
  let parsed;
  try { parsed = JSON.parse(body); }
  catch (e) { throw new Error(`${filePath}: ${e.message}`); }
  return { parsed, comment };
}

function seedTemplate(templatePath) {
  if (!templatePath.endsWith('.json')) return { changed: false, reason: 'not a JSON template' };
  const { parsed: tpl, comment } = loadJsonTemplate(templatePath);
  if (!tpl.sections) return { changed: false, reason: 'no `sections` key' };

  let changed = false;
  const seededLog = [];

  for (const [sectionId, sectionData] of Object.entries(tpl.sections)) {
    if (!sectionData || !sectionData.type) continue;
    if (sectionData.blocks && Object.keys(sectionData.blocks).length > 0) continue; // already has blocks

    const sectionFile = path.join(ROOT, 'sections', `${sectionData.type}.liquid`);
    const schema = extractSchema(sectionFile);
    if (!schema) continue;
    const presetBlocks = findFirstPresetBlocks(schema);
    if (!presetBlocks) continue;

    const blocks = {};
    const order = [];
    const counters = {};
    for (const pb of presetBlocks) {
      const type = pb.type || 'block';
      counters[type] = (counters[type] || 0) + 1;
      const id = `${sectionId}-${type}-${counters[type]}`;
      blocks[id] = { type, settings: pb.settings || {} };
      order.push(id);
    }
    sectionData.blocks = blocks;
    sectionData.block_order = order;
    seededLog.push(`  ${sectionId} (${sectionData.type}): ${order.length} block(s)`);
    changed = true;
  }

  if (!changed) return { changed: false, reason: 'no sections needed seeding' };

  if (!dryRun) {
    const out = comment + JSON.stringify(tpl, null, 2) + '\n';
    fs.writeFileSync(templatePath, out, 'utf8');
  }
  return { changed: true, seededLog };
}

function listTemplates() {
  const tplDir = path.join(ROOT, 'templates');
  if (!fs.existsSync(tplDir)) return [];
  const out = [];
  for (const f of fs.readdirSync(tplDir)) {
    if (f.endsWith('.json')) out.push(path.join(tplDir, f));
  }
  // Also customers/ subdir? Customer templates are .liquid only, no JSON, so skip.
  return out;
}

const templates = targets.length
  ? targets.map(t => path.isAbsolute(t) ? t : path.join(ROOT, t))
  : listTemplates();

if (templates.length === 0) {
  console.warn('No JSON templates found. Run from project root, or pass paths.');
  process.exit(0);
}

console.log(`${dryRun ? '[DRY RUN] ' : ''}Seeding blocks for ${templates.length} template(s)...\n`);
let totalChanged = 0;
for (const tpl of templates) {
  try {
    const res = seedTemplate(tpl);
    if (res.changed) {
      console.log(`${dryRun ? 'WOULD UPDATE' : 'UPDATED'}: ${path.relative(ROOT, tpl)}`);
      res.seededLog.forEach(l => console.log(l));
      totalChanged++;
    } else {
      console.log(`SKIP  ${path.relative(ROOT, tpl)} (${res.reason})`);
    }
  } catch (e) {
    console.error(`ERROR ${path.relative(ROOT, tpl)}: ${e.message}`);
  }
}

console.log(`\nDone. ${totalChanged} template(s) ${dryRun ? 'would be ' : ''}updated.`);
if (dryRun) console.log('Re-run without --dry to apply.');
