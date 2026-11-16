import { describe, expect, it, beforeEach } from 'vitest';
import type { DetectionSpan } from '../detection/types';
import { createPreviewPanel, defaultRedactMap } from './preview-panel';

const sampleText = 'say test@example.com now';
const spans: DetectionSpan[] = [
  {
    type: 'email',
    start: 4,
    end: 20,
    confidence: 0.9,
    source: 'regex',
  },
];

describe('createPreviewPanel', () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
  });

  it('shows empty state without text', () => {
    createPreviewPanel(host, {
      text: '  ',
      spans: [],
      redactByIndex: {},
      state: 'empty',
    });
    expect(host.textContent).toContain('No prompt');
  });

  it('renders highlights and actions', () => {
    createPreviewPanel(host, {
      text: sampleText,
      spans,
      redactByIndex: defaultRedactMap(spans),
      state: 'ready',
    });
    expect(host.querySelector('mark')?.textContent).toContain('test@example.com');
    expect(host.textContent).toContain('Send protected');
  });

  it('renders loading and error states', () => {
    const panel = createPreviewPanel(host, {
      text: '',
      spans: [],
      redactByIndex: {},
      state: 'loading',
    });
    expect(host.textContent).toContain('Loading preview');
    panel.update({ state: 'error', errorMessage: 'boom' });
    expect(host.textContent).toContain('boom');
  });
});