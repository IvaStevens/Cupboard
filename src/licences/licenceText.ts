/**
 * Licence/attribution text defined ONCE and shared by the in-app
 * licences view (src/views/LicencesView.tsx), the README's "###
 * Licences" section (kept in sync by a drift-guard test, see
 * __tests__/licences.test.tsx) and, for the CTA note, this app's
 * compliance record (see MAP-DATA-NOTE.md).
 *
 * @format
 */

/**
 * AC21: the City of Chicago's required derivative-use disclaimer,
 * reproduced VERBATIM and IN FULL (no ellipsis) - the exact sentence at
 * line 43 of 'Chicago Data Portal/TIF Information.html' (an HTTrack
 * mirror of webapps1.cityofchicago.org/ChicagoTif/disclaimer.html,
 * captured 2016-07-05 - see
 * android/app/src/main/assets/licences/chicago-terms-of-use.txt for the
 * surrounding USE OF DATA clause that requires it). Must be reproduced
 * "at the site where the software application ... can be accessed or
 * downloaded" (the City's own wording) - this app shows it on the
 * reachable LicencesView and README.md mirrors it for the repository/
 * download surface.
 */
export const CHICAGO_DERIVATIVE_USE_DISCLAIMER =
  "This site provides applications using data that has been modified for use from its original source, www.cityofchicago.org, the official website of the City of Chicago.  The City of Chicago makes no claims as to the content, accuracy, timeliness, or completeness of any of the data provided at this site.  The data provided at this site is subject to change at any time.  It is understood that the data provided at this site is being used at one's own risk.";

/**
 * AC20: the Neighborhoods_2012b dataset's licence metadata, read out of
 * the saved Data Portal landing page (not committed - see
 * android/app/src/main/assets/licences/neighbourhoods-dataset-licence.txt
 * for the full record and MAP-DATA-NOTE.md for provenance).
 */
export const CHICAGO_NEIGHBOURHOODS_LICENCE_RECORD =
  'Neighborhoods_2012b. Attribution: City of Chicago (cityofchicago.org). Licence: See Terms of Use.';

/**
 * AC22/III.6: the CTA credit note shown in the licences view, pointing
 * at the shipped agreement rather than restating its text (the
 * agreement itself is the committed, verbatim source of truth - see
 * android/app/src/main/assets/licences/cta-developer-license-agreement.html).
 */
export const CTA_CREDIT_NOTE =
  "Rail and bus data is provided by the Chicago Transit Authority (CTA) under its Developer License Agreement, committed in full in this app's assets. This app is not affiliated with, endorsed by or sponsored by CTA.";
