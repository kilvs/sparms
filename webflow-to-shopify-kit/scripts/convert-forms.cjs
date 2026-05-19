#!/usr/bin/env node
/**
 * Bulk-replaces Webflow newsletter forms in section files with Shopify's
 * {% form 'customer' %} equivalent (with a 'newsletter' tag).
 *
 * Different Webflow exports use different form IDs:
 *   - wf-form-Newsletter-Form   (Webflow's default "Newsletter" component)
 *   - wf-form-Subscribe-Form
 *   - wf-form-Email-Form
 *   - wf-form-Signup-Form
 *
 * Pass the project's form ID as the first CLI arg, or set FORM_ID below.
 *
 *   node webflow-to-shopify-kit/scripts/convert-forms.cjs                       # uses default
 *   node webflow-to-shopify-kit/scripts/convert-forms.cjs wf-form-Subscribe-Form
 *
 * Contact / enquiry forms (anything not matching the newsletter pattern)
 * require manual editing -- patterns vary per export. See
 * CONVERSION_GUIDE.md section 8.
 *
 * Safe to delete after running.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

// ----------------------------------------------------------------------------
// EDIT ME -- the form ID and the sections that contain it
// ----------------------------------------------------------------------------

// CLI override: `node convert-forms.cjs <FORM_ID>`. Falls back to the default
// below. The audit script (audit-source.{sh,ps1}) lists every wf-form-* ID
// found in the export -- copy the newsletter one in here.
const FORM_ID = process.argv[2] || 'wf-form-Newsletter-Form';

// Where to look. Default sweep covers every section file; narrow this if
// you want to limit scope. The script no-ops on files that don't contain
// the form ID, so leaving the wildcard is safe.
const FILE_GLOB = process.argv[3] || 'sections/*.liquid';

// ----------------------------------------------------------------------------
function escapeForRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Match <form id="<FORM_ID>" ...>...</form> followed by Webflow's done/fail blocks.
const formRegex = new RegExp(
  `<form id="${escapeForRegex(FORM_ID)}"[^>]*>([\\s\\S]*?)<\\/form>\\s*` +
    `<div class="w-form-done">\\s*<div>[^<]*<\\/div>\\s*<\\/div>\\s*` +
    `<div class="w-form-fail">\\s*<div>[^<]*<\\/div>\\s*<\\/div>`,
  'g'
);

let counter = 0;
function nextIds() {
  counter += 1;
  return {
    formId: `wf-form-Newsletter-${counter}`,
    emailId: `Email-Newsletter-${counter}`,
    termsId: `Newsletter-Terms-${counter}`,
  };
}

// Expand glob: support 'sections/*.liquid' style patterns (single directory).
function expandGlob(pattern) {
  const m = pattern.match(/^([^*]+\/)\*\.(\w+)$/);
  if (!m) return [path.join(ROOT, pattern)];
  const dir = path.join(ROOT, m[1]);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.' + m[2]))
    .map(f => path.join(dir, f));
}

const files = expandGlob(FILE_GLOB);
if (files.length === 0) {
  console.warn(`No files matched: ${FILE_GLOB}`);
  process.exit(0);
}

console.log(`Looking for <form id="${FORM_ID}"> in ${files.length} file(s)...`);

let ok = 0, miss = 0;
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  if (!content.includes(`id="${FORM_ID}"`)) { miss++; continue; }
  const { formId, emailId, termsId } = nextIds();

  const replacement = `{%- form 'customer', id: '${formId}', class: 'component_newsletter_form' -%}
    <input type="hidden" name="contact[tags]" value="newsletter">
    <label for="${emailId}" class="form_label">Email</label>
    <input class="form_input w-input" maxlength="256" name="contact[email]" type="email" id="${emailId}" required="">
    <div class="spacer-medium"></div>
    <label class="w-checkbox form_checkbox_field"><input type="checkbox" name="contact[accepts_marketing]" id="${termsId}" required="" class="w-checkbox-input form_checkbox"><span class="text-size-tiny w-form-label" for="${termsId}">I confirm I wish to receive emails. You may opt out at any time.</span></label>
    <div class="spacer-medium"></div>
    <div class="button-group"><input type="submit" data-wait="Please wait..." class="button-tertiary w-button" value="Submit"></div>
    {% render 'wf-form-states', form: form %}
  {%- endform -%}`;

  const updated = content.replace(formRegex, replacement);
  if (updated === content) { console.warn(`NO MATCH: ${path.basename(file)}`); miss++; }
  else { fs.writeFileSync(file, updated, 'utf8'); console.log(`OK ${path.basename(file)}`); ok++; }
}

console.log(`\nDone. ${ok} converted, ${miss} skipped (no match).`);
if (ok === 0 && miss > 0) {
  console.log('');
  console.log('No matches. Check that:');
  console.log(`  1. The form ID is correct (you passed: ${FORM_ID})`);
  console.log('  2. Run audit-source.{sh,ps1} -- it lists every wf-form-* ID in the export.');
  console.log('  3. The form is in a section/*.liquid file (not still in webflow-source/).');
}
