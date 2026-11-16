import { describe, expect, it } from 'vitest';
import { PlaceholderVault } from './vault';

describe('PlaceholderVault', () => {
  it('allocates typed numbered placeholders', () => {
    const vault = new PlaceholderVault();
    const a = vault.getOrCreate('ssn', '111-11-1111');
    const b = vault.getOrCreate('email', 'a@b.co');
    expect(a).toBe('[SSN_1]');
    expect(b).toBe('[EMAIL_1]');
  });

  it('reuses the same placeholder for the same type and value', () => {
    const vault = new PlaceholderVault();
    const first = vault.getOrCreate('email', 'x@y.z');
    const second = vault.getOrCreate('email', 'x@y.z');
    expect(first).toBe(second);
    expect(first).toBe('[EMAIL_1]');
  });

  it('increments counters per type independently', () => {
    const vault = new PlaceholderVault();
    expect(vault.getOrCreate('phone', '111')).toBe('[PHONE_1]');
    expect(vault.getOrCreate('phone', '222')).toBe('[PHONE_2]');
    expect(vault.getOrCreate('ssn', '333')).toBe('[SSN_1]');
  });

  it('lookup returns the original value and undefined when unknown', () => {
    const vault = new PlaceholderVault();
    const token = vault.getOrCreate('api_key', 'sk-test');
    expect(vault.lookup(token)).toBe('sk-test');
    expect(vault.lookup('[EMAIL_99]')).toBeUndefined();
  });

  it('clear removes all mappings', () => {
    const vault = new PlaceholderVault();
    const token = vault.getOrCreate('iban', 'DE001');
    expect(vault.lookup(token)).toBe('DE001');
    vault.clear();
    expect(vault.lookup(token)).toBeUndefined();
    expect(vault.getOrCreate('iban', 'DE001')).toBe('[IBAN_1]');
  });
});