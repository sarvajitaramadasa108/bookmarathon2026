import { devotees } from './content.js';

export function normalizeMobile(value) {
  let digits = String(value ?? '').replace(/[\s()+-]/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  return digits;
}

export function validateRegistration(input) {
  const text = value => typeof value === 'string' ? value.trim() : '';
  const data = {
    name: text(input.name), mobile: normalizeMobile(input.mobile), age: Number(input.age),
    gender: text(input.gender), area: text(input.area), devotee: text(input.devotee),
    participation: text(input.participation), consent: input.consent === true,
    language: input.language === 'te' ? 'te' : 'en',
  };
  const errors = {};
  if (data.name.length < 2 || data.name.length > 100 || /[\u0000-\u001f]/u.test(data.name)) errors.name = 'nameError';
  if (!/^[6-9]\d{9}$/.test(data.mobile)) errors.mobile = 'mobileError';
  if (!Number.isInteger(data.age) || data.age < 1 || data.age > 120) errors.age = 'ageError';
  if (!['male', 'female', 'other', 'prefer_not_say'].includes(data.gender)) errors.gender = 'genderError';
  if (data.area.length < 2 || data.area.length > 150 || /[\u0000-\u001f]/u.test(data.area)) errors.area = 'areaError';
  if (!devotees.some(([name]) => name === data.devotee)) errors.devotee = 'devoteeError';
  if (!['full_day', 'evenings', 'weekends'].includes(data.participation)) errors.participation = 'participationError';
  if (!data.consent) errors.consent = 'consentError';
  return { data, errors, valid: Object.keys(errors).length === 0 };
}
