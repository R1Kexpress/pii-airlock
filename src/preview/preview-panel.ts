import type { DetectionSpan } from '../detection/types';
import { labelForPiiType } from '../ui/format';
import { buildHighlightedSegments } from './highlight';

export type PreviewPanelState = 'empty' | 'loading' | 'error' | 'ready';

export interface PreviewPanelProps {
  text: string;
  spans: DetectionSpan[];
  /** true = redact this span when sending protected */
  redactByIndex: Record<number, boolean>;
  state?: PreviewPanelState;
  errorMessage?: string;
  onRedactChange?: (spanIndex: number, redact: boolean) => void;
  onSendProtected?: () => void;
  onSendOriginal?: () => void;
}

export interface PreviewPanelHandle {
  update(props: Partial<PreviewPanelProps>): void;
  destroy(): void;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function createPreviewPanel(
  container: HTMLElement,
  initial: PreviewPanelProps,
): PreviewPanelHandle {
  let props = { state: 'ready' as PreviewPanelState, ...initial };

  const root = document.createElement('article');
  root.className = 'preview-panel card';
  container.replaceChildren(root);

  const rerender = (): void => {
    root.replaceChildren();
    const state = props.state ?? 'ready';

    if (state === 'loading') {
      const block = document.createElement('div');
      block.className = 'state-block';
      block.innerHTML = '<div class="spinner" aria-hidden="true"></div>Loading preview…';
      root.append(block);
      return;
    }

    if (state === 'error') {
      const block = document.createElement('div');
      block.className = 'state-block error';
      block.textContent = props.errorMessage ?? 'Preview failed.';
      root.append(block);
      return;
    }

    if (state === 'empty' || !props.text.trim()) {
      const block = document.createElement('div');
      block.className = 'state-block';
      block.textContent = 'No prompt to preview yet.';
      root.append(block);
      return;
    }

    const header = document.createElement('div');
    header.className = 'preview-header';
    header.innerHTML =
      '<h2>Preview</h2><p class="muted">Review detections before send. Text stays on this page only.</p>';
    root.append(header);

    const prompt = document.createElement('div');
    prompt.className = 'preview-prompt';
    prompt.setAttribute('aria-label', 'Prompt preview');

    const segments = buildHighlightedSegments(props.text, props.spans);
    for (const segment of segments) {
      if (segment.kind === 'plain') {
        prompt.append(document.createTextNode(segment.text));
        continue;
      }
      const mark = document.createElement('mark');
      mark.className = 'pii-mark';
      mark.textContent = segment.text;
      if (segment.spanIndex !== undefined) {
        mark.dataset.spanIndex = String(segment.spanIndex);
      }
      prompt.append(mark);
    }
    root.append(prompt);

    if (props.spans.length === 0) {
      const none = document.createElement('p');
      none.className = 'muted';
      none.textContent = 'No sensitive spans detected.';
      root.append(none);
    } else {
      const list = document.createElement('ul');
      list.className = 'detection-list';
      props.spans.forEach((span, index) => {
        const item = document.createElement('li');
        const redact = props.redactByIndex[index] !== false;
        item.className = 'detection-item';
        item.innerHTML = `<div class="detection-meta"><strong>${escapeHtml(labelForPiiType(span.type))}</strong><span class="muted">${span.source} · ${Math.round(span.confidence * 100)}%</span></div>`;

        const toggle = document.createElement('label');
        toggle.className = 'redact-toggle';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = redact;
        input.addEventListener('change', () => {
          props.onRedactChange?.(index, input.checked);
        });
        toggle.append(input, document.createTextNode(redact ? 'Redact' : 'Allow'));
        input.addEventListener('change', () => {
          toggle.lastChild!.textContent = input.checked ? 'Redact' : 'Allow';
        });
        item.append(toggle);
        list.append(item);
      });
      root.append(list);
    }

    const actions = document.createElement('div');
    actions.className = 'preview-actions';
    const sendProtected = document.createElement('button');
    sendProtected.type = 'button';
    sendProtected.className = 'btn primary';
    sendProtected.textContent = 'Send protected';
    sendProtected.addEventListener('click', () => props.onSendProtected?.());
    const sendOriginal = document.createElement('button');
    sendOriginal.type = 'button';
    sendOriginal.className = 'btn ghost';
    sendOriginal.textContent = 'Send original';
    sendOriginal.addEventListener('click', () => props.onSendOriginal?.());
    actions.append(sendProtected, sendOriginal);
    root.append(actions);
  };

  rerender();

  return {
    update(next) {
      props = { ...props, ...next };
      rerender();
    },
    destroy() {
      container.replaceChildren();
    },
  };
}

export function defaultRedactMap(spans: DetectionSpan[]): Record<number, boolean> {
  return Object.fromEntries(spans.map((_, i) => [i, true]));
}