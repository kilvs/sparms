#!/usr/bin/env node
/**
 * Bulk-replaces Webflow newsletter forms in section files with Shopify's
 * {% form 'customer' %} equivalent (with a 'newsletter' tag).
 *
 * Matches forms with id="wf-form-Newsletter-Form" — most Webflow exports use
 * this convention across pages. Same markup wrapper, same classes, only the
 * <form> opening tag, input name attributes, and surrounding {% form %} blocks
 * change.
 *
 * Edit FILES to match your project's section file paths, then:
 *   node webflow-to-shopify-kit/scripts/convert-forms.cjs
 *
 * Contact / enquiry forms (e.g. wf-form-Enquiry-Form) require manual editing
 * — patterns vary per export. See CONVERSION_GUIDE.md §8.
 *
 * Safe to delete after running.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

// ────────────────────────────────────────────────────────────────────────────
// EDIT ME — sections that contain a wf-form-Newsletter-Form
// ────────────────────────────────────────────────────────────────────────────
const FILES = [
  'sections/page-404.liquid',
  'sections/page-about.liquid',
  'sections/page-blog.liquid',
  'sections/page-collection.liquid',
  'sections/page-product.liquid',
  'sections/page-article.liquid',
  'sections/page-legal.liquid',
  // Add your section paths here. If you've split components, also include
  // sections/component-newsletter.liquid.
].map(p => path.join(ROOT, p));

// ────────────────────────────────────────────────────────────────────────────
const newsletterRegex = /<form id="wf-form-Newsletter-Form"[^>]*>([\s\S]*?)<\/form>\s*<div class="w-form-done">\s*<div>[^<]*<\/div>\s*<\/div>\s*<div class="w-form-fail">\s*<div>[^<]*<\/div>\s*<\/div>/g;

let counter = 0;
function nextIds() {
  counter += 1;
  return {
    formId: `wf-form-Newsletter-${counter}`,
    emailId: `Email-Newsletter-${counter}`,
    termsId: `Newsletter-Terms-${counter}`,
  };
}

let ok = 0, miss = 0;
for (const file of FILES) {
  if (!fs.existsSync(file)) { console.warn(`SKIP (missing): ${file}`); miss++; continue; }
  let content = fs.readFileSync(file, 'utf8');
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

  const updated = content.replace(newsletterRegex, replacement);
  if (updated === content) { console.warn(`NO MATCH: ${path.basename(file)}`); miss++; }
  else { fs.writeFileSync(file, updated, 'utf8'); console.log(`OK ${path.basename(file)}`); ok++; }
}

console.log(`\nDone. ${ok} converted, ${miss} skipped.`);
