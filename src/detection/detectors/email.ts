import { scanRegex } from '../utils/scan';

const EMAIL_PATTERN =
  /\b[A-Za-z0-9._%+'-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+\b/g;

function validateEmail(matched: string): boolean {
  if (matched.startsWith('.') || matched.includes('..')) return false;
  const [local, domain] = matched.split('@');
  if (!local || !domain) return false;
  if (local.length > 64 || domain.length > 255) return false;
  if (!domain.includes('.')) return false;
  const tld = domain.split('.').pop() ?? '';
  if (tld.length < 2) return false;
  return true;
}

export function detectEmail(text: string) {
  return scanRegex(text, {
    type: 'email',
    pattern: EMAIL_PATTERN,
    confidence: 0.86,
    validate: (m) => validateEmail(m),
  });
}