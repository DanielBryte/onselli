import { getCountries, type CountryCode } from 'libphonenumber-js';

const countryCodes = getCountries();
const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });

export const creatorCountries = countryCodes
  .map((code) => ({ code, name: countryNames.of(code) ?? code }))
  .sort((a, b) => a.name.localeCompare(b.name));

const creatorCountryCodeSet = new Set<string>(countryCodes);

export function isCreatorCountryCode(value: unknown): value is CountryCode {
  return typeof value === 'string' && creatorCountryCodeSet.has(value);
}
