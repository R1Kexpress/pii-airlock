import type { PiiType } from '../detection/types';
import { piiTypeToPlaceholderLabel } from './placeholder';

export class PlaceholderVault {
  private readonly valueByToken = new Map<string, string>();
  private readonly tokenByTypeValue = new Map<string, string>();
  private readonly nextIndex = new Map<string, number>();

  getOrCreate(type: PiiType, value: string): string {
    const typeLabel = piiTypeToPlaceholderLabel(type);
    const dedupeKey = `${typeLabel}\0${value}`;
    const existing = this.tokenByTypeValue.get(dedupeKey);
    if (existing) {
      return existing;
    }

    const n = (this.nextIndex.get(typeLabel) ?? 0) + 1;
    this.nextIndex.set(typeLabel, n);
    const token = `[${typeLabel}_${n}]`;
    this.tokenByTypeValue.set(dedupeKey, token);
    this.valueByToken.set(token, value);
    return token;
  }

  lookup(placeholder: string): string | undefined {
    return this.valueByToken.get(placeholder);
  }

  clear(): void {
    this.valueByToken.clear();
    this.tokenByTypeValue.clear();
    this.nextIndex.clear();
  }
}