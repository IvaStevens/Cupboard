/**
 * The verbatim City of Chicago derivative-use disclaimer text (AC21),
 * LicencesView rendering it, and reachability from the Settings
 * placeholder. The filesystem-based drift guards (against the source
 * document and against README.md) live in
 * __tests__/licenceText.test.js - a plain .js file, since this
 * project's strict RN tsconfig (`"types": ["jest"]`) has no Node
 * `fs`/`path`/`__dirname` types available to a .tsx file.
 *
 * @format
 */

import * as React from 'react';
import renderer, {act} from 'react-test-renderer';
import {BobuttonsProvider} from 'bobuttons';

import {
  CHICAGO_DERIVATIVE_USE_DISCLAIMER,
  CHICAGO_NEIGHBOURHOODS_LICENCE_RECORD,
  CTA_CREDIT_NOTE,
} from '../src/licences/licenceText';
import LicencesView from '../src/views/LicencesView';
import PlaceholderView from '../src/views/PlaceholderView';

describe('CHICAGO_DERIVATIVE_USE_DISCLAIMER', () => {
  it("is the exact sentence beginning 'This site provides applications...' and ending '...being used at one's own risk.', no ellipsis", () => {
    expect(
      CHICAGO_DERIVATIVE_USE_DISCLAIMER.startsWith(
        'This site provides applications using data that has been modified for use from its original source, www.cityofchicago.org,',
      ),
    ).toBe(true);
    expect(
      CHICAGO_DERIVATIVE_USE_DISCLAIMER.endsWith("being used at one's own risk."),
    ).toBe(true);
    expect(CHICAGO_DERIVATIVE_USE_DISCLAIMER).not.toContain('...');
    expect(CHICAGO_DERIVATIVE_USE_DISCLAIMER).not.toContain('…');
  });
});

describe('LicencesView', () => {
  it('renders the CTA credit note and the City of Chicago licence record and disclaimer', () => {
    let instance!: renderer.ReactTestRenderer;
    act(() => {
      instance = renderer.create(
        <BobuttonsProvider>
          <LicencesView onReturn={() => {}} />
        </BobuttonsProvider>,
      );
    });
    const text = JSON.stringify(instance.toJSON());
    expect(text).toContain(CTA_CREDIT_NOTE);
    expect(text).toContain(CHICAGO_NEIGHBOURHOODS_LICENCE_RECORD);
    expect(text).toContain(CHICAGO_DERIVATIVE_USE_DISCLAIMER);
  });

  it('calls onReturn when "Back to Settings" is pressed', () => {
    const onReturn = jest.fn();
    let instance!: renderer.ReactTestRenderer;
    act(() => {
      instance = renderer.create(
        <BobuttonsProvider>
          <LicencesView onReturn={onReturn} />
        </BobuttonsProvider>,
      );
    });
    const button = instance.root.findAll(
      node => node.props && node.props.label === 'Back to Settings',
    )[0];
    act(() => {
      (button.props.onPress as () => void)();
    });
    expect(onReturn).toHaveBeenCalledTimes(1);
  });
});

describe('PlaceholderView reachability (AC21)', () => {
  it('renders a "Licences" action only when onShowLicences is supplied (Settings only)', () => {
    const onShowLicences = jest.fn();
    let withLicences!: renderer.ReactTestRenderer;
    act(() => {
      withLicences = renderer.create(
        <BobuttonsProvider>
          <PlaceholderView
            entryId="settings"
            onReturn={() => {}}
            onShowLicences={onShowLicences}
          />
        </BobuttonsProvider>,
      );
    });
    const licencesButton = withLicences.root.findAll(
      node => node.props && node.props.label === 'Licences',
    );
    expect(licencesButton).toHaveLength(1);
    act(() => {
      (licencesButton[0].props.onPress as () => void)();
    });
    expect(onShowLicences).toHaveBeenCalledTimes(1);

    let withoutLicences!: renderer.ReactTestRenderer;
    act(() => {
      withoutLicences = renderer.create(
        <BobuttonsProvider>
          <PlaceholderView entryId="places" onReturn={() => {}} />
        </BobuttonsProvider>,
      );
    });
    expect(
      withoutLicences.root.findAll(
        node => node.props && node.props.label === 'Licences',
      ),
    ).toHaveLength(0);
  });
});
