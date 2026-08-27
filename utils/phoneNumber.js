import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString
} from 'libphonenumber-js';

const countryAliases = {
  usa: 'US',
  'united states': 'US',
  uk: 'GB',
  'united kingdom': 'GB',
  uae: 'AE',
  'united arab emirates': 'AE',
  saudi: 'SA',
  ksa: 'SA',
  india: 'IN'
};

const normalizeCountryName = country => String(country || '')
  .toLowerCase()
  .trim()
  .replace(/[._-]+/g, ' ')
  .replace(/\s+/g, ' ');

const countryNames = new Map();
const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });

for (const countryCode of getCountries()) {
  const displayName = displayNames.of(countryCode);
  if (displayName) {
    countryNames.set(normalizeCountryName(displayName), countryCode);
  }
}

function isUsableCountryInput(country) {
  const raw = String(country || '').trim();
  return Boolean(raw) && !/^(unknown|n\/a|na|-)$/i.test(raw);
}

function getCountryCode(country) {
  if (!isUsableCountryInput(country)) {
    return undefined;
  }

  const isoCode = String(country).trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(isoCode) && getCountries().includes(isoCode)) {
    return isoCode;
  }

  const normalizedCountry = normalizeCountryName(country);
  return countryAliases[normalizedCountry] || countryNames.get(normalizedCountry);
}

export function normalizeRecipient(to, country, fallbackCountryCode = '91') {
  const digits = String(to || '').replace(/\D/g, '');
  if (!digits) {
    throw new Error('WhatsApp phone number is required.');
  }

  const countryCode = getCountryCode(country);
  const fallbackCountry = getCountries().find(code =>
    getCountryCallingCode(code) === String(fallbackCountryCode)
  );
  const defaultCountry = countryCode || (isUsableCountryInput(country) ? null : fallbackCountry);
  const input = String(to).trim();
  const phoneNumber = input.startsWith('+') || digits.length > 10
    ? parsePhoneNumberFromString(`+${digits}`)
    : defaultCountry
      ? parsePhoneNumberFromString(input, defaultCountry)
      : undefined;

  if (!phoneNumber || !phoneNumber.isValid()) {
    if (country && !countryCode) {
      throw new Error(`Country "${country}" is not recognized. Use the full country name or include the phone number with its +country code.`);
    }
    throw new Error('Enter a valid WhatsApp phone number with its country code, for example +919876543210.');
  }

  return phoneNumber.number.slice(1);
}
