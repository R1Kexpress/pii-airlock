import { describe, expect, it } from 'vitest';
import { createDefaultSettings } from '../settings/storage';
import { renderOptions } from './options-view';

describe('options view', () => {
  it('renders preset cards', () => {
    const html = renderOptions({
      viewState: 'ready',
      settings: createDefaultSettings(),
    });
    expect(html).toContain('Personal');
    expect(html).toContain('data-category="email"');
  });

  it('shows loading state', () => {
    const html = renderOptions({ viewState: 'loading' });
    expect(html).toContain('Loading settings');
  });
});