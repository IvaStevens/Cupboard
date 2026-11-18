#!/usr/bin/env node
'use strict';

/**
 * Developer-run CLI: deterministic, offline production of the three
 * sanitised licence/terms assets committed next to the map data (see
 * MAP-DATA-NOTE.md for the exact command and provenance for each). Reads
 * from the gitignored CTA/ and 'Chicago Data Portal/' folders (main
 * checkout only); never fetches anything over the network; never wired
 * into Gradle or Metro.
 *
 * Usage:
 *   node tools/convertLicences.js "<repo root containing CTA/ and 'Chicago Data Portal/'>"
 *
 * Produces:
 *  - android/app/src/main/assets/licences/cta-developer-license-agreement.html
 *    (AC18: CTA/developers_license_agreement.htm, verbatim text,
 *    re-encoded Windows-1252 -> UTF-8, injected ad-block <style> and the
 *    three <img> references removed)
 *  - android/app/src/main/assets/licences/chicago-terms-of-use.txt
 *    (AC19: 'Chicago Data Portal/TIF Information.html' lines 36-50,
 *    verbatim, as text, with its HTTrack provenance recorded)
 *  - android/app/src/main/assets/licences/neighbourhoods-dataset-licence.txt
 *    (AC20: the Neighborhoods_2012b dataset's licence metadata, as a
 *    short text record)
 *
 * @format
 */

const fs = require('fs');
const path = require('path');

// Windows-1252's upper range (0x80-0x9F) differs from Latin-1; every
// other byte maps 1:1 to the same code point. Hand-rolled rather than
// `new TextDecoder('windows-1252')`: verified in this toolchain's Node
// build that the label resolves without throwing but decodes this range
// as an IDENTITY (Latin-1) mapping, which would leave the source
// document's curly quotes as C1 control characters instead of the
// intended punctuation. Table is the WHATWG Encoding Standard's
// windows-1252 index (undefined code points, e.g. 0x81, are left as the
// byte's own value - none of them occur in the source document).
const WINDOWS_1252_EXTRA = Object.freeze({
  0x80: 0x20ac,
  0x82: 0x201a,
  0x83: 0x0192,
  0x84: 0x201e,
  0x85: 0x2026,
  0x86: 0x2020,
  0x87: 0x2021,
  0x88: 0x02c6,
  0x89: 0x2030,
  0x8a: 0x0160,
  0x8b: 0x2039,
  0x8c: 0x0152,
  0x8e: 0x017d,
  0x91: 0x2018,
  0x92: 0x2019,
  0x93: 0x201c,
  0x94: 0x201d,
  0x95: 0x2022,
  0x96: 0x2013,
  0x97: 0x2014,
  0x98: 0x02dc,
  0x99: 0x2122,
  0x9a: 0x0161,
  0x9b: 0x203a,
  0x9c: 0x0153,
  0x9e: 0x017e,
  0x9f: 0x0178,
});

function decodeWindows1252(buffer) {
  let out = '';
  for (const byte of buffer) {
    const mapped = WINDOWS_1252_EXTRA[byte];
    out += String.fromCodePoint(mapped === undefined ? byte : mapped);
  }
  return out;
}

function sanitiseCtaAgreement(sourcePath) {
  const buffer = fs.readFileSync(sourcePath);
  let html = decodeWindows1252(buffer);

  const beforeCharset = html;
  html = html.replace(
    '<meta http-equiv="content-type" content="text/html; charset=windows-1252">',
    '<meta http-equiv="content-type" content="text/html; charset=utf-8">',
  );
  if (html === beforeCharset) {
    throw new Error(
      'sanitiseCtaAgreement: expected charset meta tag was not found - source document may have changed',
    );
  }

  const beforeStyle = html;
  html = html.replace(/<style>:is\(\[id\*='google_ads_iframe'[\s\S]*?<\/style>/, '');
  if (html === beforeStyle) {
    throw new Error(
      'sanitiseCtaAgreement: injected ad-block <style> tag was not found to remove',
    );
  }

  const imgMatches = html.match(/<img[^>]*developers_license_agreement_files\/[^>]*>/g) || [];
  if (imgMatches.length !== 3) {
    throw new Error(
      `sanitiseCtaAgreement: expected exactly 3 <img> references into developers_license_agreement_files/, found ${imgMatches.length}`,
    );
  }
  html = html.replace(/<img[^>]*developers_license_agreement_files\/[^>]*>/g, '');

  return html;
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, '');
}

function decodeHtmlEntities(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/**
 * Extracts the 4 verbatim paragraphs from lines 36-50 (1-indexed) of
 * 'Chicago Data Portal/TIF Information.html': DISCLAIMER OF LIABILITY,
 * USE OF DATA, RESERVATION OF RIGHTS, INDEMNITY. HTML line-wrapping
 * inside a <p> (a soft wrap, not an intentional space) collapses to one
 * space; a real double space already present in the source (as between
 * sentences) is left alone - see the `\n` vs ` ` distinction below.
 */
const CHICAGO_TERMS_HEADINGS = Object.freeze([
  'DISCLAIMER OF LIABILITY',
  'USE OF DATA',
  'RESERVATION OF RIGHTS',
  'INDEMNITY',
]);

/**
 * Returns the 4 body paragraphs, in order. Each heading (DISCLAIMER OF
 * LIABILITY, USE OF DATA, RESERVATION OF RIGHTS, INDEMNITY) is its own
 * `<p><b>...</b></p>` in the source, so the raw paragraph scan yields 8
 * non-empty paragraphs (4 headings + 4 bodies, plus the `<p>&nbsp;</p>`
 * spacers, which decode to whitespace and are dropped); the headings are
 * filtered out here by exact match against CHICAGO_TERMS_HEADINGS rather
 * than by position, so a reordering in the source would fail loudly
 * (wrong count) instead of silently mislabelling a paragraph.
 */
function extractChicagoTermsParagraphs(sourcePath) {
  const lines = fs.readFileSync(sourcePath, 'utf8').split('\n');
  const sliceStartLine = 36; // 1-indexed, inclusive
  const sliceEndLine = 50; // 1-indexed, inclusive
  const slice = lines.slice(sliceStartLine - 1, sliceEndLine).join('\n');

  const paragraphs = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/g;
  let match;
  while ((match = pRegex.exec(slice))) {
    const withoutLineWraps = match[1].replace(/[\t\r\n]+/g, ' ');
    const text = decodeHtmlEntities(stripTags(withoutLineWraps)).trim();
    if (text) {
      paragraphs.push(text);
    }
  }
  return paragraphs.filter(text => !CHICAGO_TERMS_HEADINGS.includes(text));
}

function buildChicagoTermsText(paragraphs) {
  const headerLines = [
    'City of Chicago Terms of Use - DISCLAIMER OF LIABILITY, USE OF DATA,',
    'RESERVATION OF RIGHTS and INDEMNITY',
    '',
    "Provenance: this text is lines 36-50 of 'Chicago Data Portal/TIF Information.html'" +
      ' in this repository, which is an HTTrack mirror of the City of Chicago TIF web' +
      " application's disclaimer page, NOT a saved copy of the Data Portal's own Terms of" +
      ' Use page (the Data Portal landing page for this dataset links to no such page -' +
      ' see MAP-DATA-NOTE.md). The mirrored page records two capture timestamps in its' +
      ' own HTML comment:',
    '  - webapps1int.cityofchicago.org/ChicagoTif/disclaimer.html, captured 2016-06-22',
    '  - webapps1.cityofchicago.org/ChicagoTif/disclaimer.html, captured 2016-07-05',
    'This text is committed verbatim and unaltered apart from stripping the source\'s' +
      ' HTML markup; no part of the surrounding page chrome or its TIF Information_files/' +
      ' directory (including chicago.gov-logo_H_lB.png and the bootstrap/jQuery/USWDS/' +
      'font-awesome assets) is included.',
    '',
  ];
  const body = [];
  for (let i = 0; i < CHICAGO_TERMS_HEADINGS.length; i += 1) {
    body.push(CHICAGO_TERMS_HEADINGS[i]);
    body.push('');
    body.push(paragraphs[i] || '');
    body.push('');
  }
  return [...headerLines, ...body].join('\n').trimEnd() + '\n';
}

function buildNeighbourhoodsLicenceText() {
  return [
    'Neighborhoods_2012b dataset licence record',
    '',
    'Values read from the saved landing page' +
      " 'Chicago Data Portal/Neighborhoods_2012b _ City of Chicago _ Data Portal.html'" +
      ' (not committed - 4.9 MB plus its _files/ directory; this short record is' +
      ' committed instead, and no City of Chicago logo is shipped):',
    '',
    '  dataset:         Neighborhoods_2012b',
    '  attribution:      City of Chicago',
    '  attributionLink:  http://www.cityofchicago.org',
    '  licence:          See Terms of Use',
    '  licenseId:        SEE_TERMS_OF_USE',
    '',
    'The landing page links to no Terms of Use page, so the authoritative Data Portal' +
      ' terms document is not on disk and fetching it is out of scope for this ticket' +
      ' (see MAP-DATA-NOTE.md). The City of Chicago TIF disclaimer committed alongside' +
      ' this file as chicago-terms-of-use.txt is the only City terms text shipped; its' +
      " USE OF DATA clause's required derivative-use disclaimer is reproduced in this" +
      " app's licences view and in README.md's Licences section.",
    '',
  ].join('\n');
}

function main() {
  const repoRootArg = process.argv[2];
  if (!repoRootArg) {
    console.error(
      'Usage: node tools/convertLicences.js "<repo root containing CTA/ and \'Chicago Data Portal/\'>"',
    );
    process.exitCode = 1;
    return;
  }
  const repoRoot = path.resolve(repoRootArg);
  const ctaAgreementSource = path.join(
    repoRoot,
    'CTA',
    'developers_license_agreement.htm',
  );
  const chicagoTermsSource = path.join(
    repoRoot,
    'Chicago Data Portal',
    'TIF Information.html',
  );

  for (const sourcePath of [ctaAgreementSource, chicagoTermsSource]) {
    if (!fs.existsSync(sourcePath)) {
      console.error(`convertLicences: missing source file ${sourcePath}`);
      process.exitCode = 1;
      return;
    }
  }

  const outputDir = path.resolve(
    __dirname,
    '..',
    'android',
    'app',
    'src',
    'main',
    'assets',
    'licences',
  );
  fs.mkdirSync(outputDir, {recursive: true});

  const sanitisedAgreement = sanitiseCtaAgreement(ctaAgreementSource);
  const agreementOutputPath = path.join(
    outputDir,
    'cta-developer-license-agreement.html',
  );
  fs.writeFileSync(agreementOutputPath, sanitisedAgreement, 'utf8');
  console.log(
    `convertLicences: wrote ${agreementOutputPath} (${Buffer.byteLength(
      sanitisedAgreement,
      'utf8',
    )} bytes)`,
  );

  const paragraphs = extractChicagoTermsParagraphs(chicagoTermsSource);
  if (paragraphs.length !== 4) {
    throw new Error(
      `convertLicences: expected 4 paragraphs (DISCLAIMER OF LIABILITY, USE OF DATA, RESERVATION OF RIGHTS, INDEMNITY), found ${paragraphs.length}`,
    );
  }
  const termsText = buildChicagoTermsText(paragraphs);
  const termsOutputPath = path.join(outputDir, 'chicago-terms-of-use.txt');
  fs.writeFileSync(termsOutputPath, termsText, 'utf8');
  console.log(`convertLicences: wrote ${termsOutputPath}`);

  const neighbourhoodsLicenceText = buildNeighbourhoodsLicenceText();
  const neighbourhoodsOutputPath = path.join(
    outputDir,
    'neighbourhoods-dataset-licence.txt',
  );
  fs.writeFileSync(neighbourhoodsOutputPath, neighbourhoodsLicenceText, 'utf8');
  console.log(`convertLicences: wrote ${neighbourhoodsOutputPath}`);
}

// Guarded so `require('./convertLicences')` from a unit test can reuse
// the pure helpers below without re-running the CLI (and its filesystem
// writes) as a side effect of the import.
if (require.main === module) {
  main();
}

module.exports = {
  decodeWindows1252,
  sanitiseCtaAgreement,
  extractChicagoTermsParagraphs,
  buildChicagoTermsText,
  buildNeighbourhoodsLicenceText,
};
