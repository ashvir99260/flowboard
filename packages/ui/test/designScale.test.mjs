import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import * as UI from '../dist/index.js';

test('compact controls explicitly default to small outlined fields', () => {
  assert.equal(UI.designTokens.controlHeight, '3.6rem');
  assert.equal(UI.theme.components.MuiTextField.defaultProps.variant, 'outlined');
  assert.equal(UI.theme.components.MuiTextField.defaultProps.size, 'small');
  assert.equal(UI.theme.components.MuiFormControl.defaultProps.size, 'small');
});

test('application color literals belong to tokens rather than theme wiring', async () => {
  const source = await readFile(new URL('../src/modules/theme/theme.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /(?:hsla?|rgba?)\(\s*\d|#[\da-f]{3,8}\b/i);
  for (const mode of ['light', 'dark']) {
    const palette = UI.theme.colorSchemes[mode].palette;
    for (const semantic of ['error', 'warning', 'success', 'info']) {
      assert.equal(palette[semantic].main, UI.designTokens.palette[mode][semantic]);
    }
  }
});

test('MUI uses ten-pixel rem calibration and direct rem spacing', () => {
  assert.equal(UI.theme.typography.htmlFontSize, 10);
  assert.equal(UI.theme.typography.pxToRem(16), '1.6rem');
  assert.equal(UI.theme.typography.body1.fontSize, '1.4rem');
  assert.equal(UI.theme.typography.h1.fontSize, '2.2rem');
  assert.equal(UI.theme.spacing(1), '1rem');
  assert.equal(UI.theme.spacing(1.6), '1.6rem');
  assert.equal(UI.theme.spacing(-0.4, 'auto', 0, 2.4), '-0.4rem auto 0rem 2.4rem');
});

test('palette tokens are HSL while MUI receives valid RGB channels', () => {
  for (const palette of Object.values(UI.designTokens.palette))
    for (const color of Object.values(palette)) assert.match(color, /^hsl\(/);
  assert.equal(UI.theme.colorSchemes.light.palette.primary.mainChannel, '24 24 27');
  assert.equal(UI.theme.shape.borderRadius, 6);
});

test('rem media queries retain the equivalent browser-default breakpoints', () => {
  assert.equal(UI.theme.breakpoints.up('sm'), '@media (min-width:37.5rem)');
  assert.equal(UI.theme.breakpoints.up('md'), '@media (min-width:56.25rem)');
});

test('validated contract colors convert only at the display boundary', () => {
  assert.equal(typeof UI.toHslColor, 'function');
  assert.equal(UI.toHslColor('#FF0000'), 'hsl(0, 100%, 50%)');
  assert.equal(UI.toHslColor('#808080'), 'hsl(0, 0%, 50.1961%)');
  assert.equal(UI.toHslColor('var(--status-color)'), 'var(--status-color)');
});
