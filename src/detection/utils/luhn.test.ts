import { describe, expect, it } from 'vitest';
import { passesLuhn } from './luhn';

describe('passesLuhn', () => {
  it('validates known test PAN', () => {
    expect(passesLuhn('4532015112830366')).toBe(true);
  });

  it('rejects single-digit typo', () => {
    expect(passesLuhn('4532015112830367')).toBe(false);
  });
});