import { Language } from './translations';

// Countries where Spanish is the primary language
const SPANISH_COUNTRIES = [
  'AR', // Argentina
  'BO', // Bolivia
  'CL', // Chile
  'CO', // Colombia
  'CR', // Costa Rica
  'CU', // Cuba
  'DO', // Dominican Republic
  'EC', // Ecuador
  'SV', // El Salvador
  'GQ', // Equatorial Guinea
  'ES', // Spain
  'GT', // Guatemala
  'HN', // Honduras
  'MX', // Mexico
  'NI', // Nicaragua
  'PA', // Panama
  'PY', // Paraguay
  'PE', // Peru
  'PR', // Puerto Rico
  'UY', // Uruguay
  'VE', // Venezuela
  'BZ', // Belize (Spanish is official)
  'PH', // Philippines (Spanish was official, some speakers remain)
];

// Country code to phone country code mapping
const COUNTRY_PHONE_CODES: { [key: string]: string } = {
  'AR': '+54', // Argentina
  'AU': '+61', // Australia
  'AT': '+43', // Austria
  'BE': '+32', // Belgium
  'BO': '+591', // Bolivia
  'BR': '+55', // Brazil
  'CA': '+1', // Canada
  'CL': '+56', // Chile
  'CN': '+86', // China
  'CO': '+57', // Colombia
  'CR': '+506', // Costa Rica
  'CU': '+53', // Cuba
  'CZ': '+420', // Czech Republic
  'DK': '+45', // Denmark
  'DO': '+1-809', // Dominican Republic
  'EC': '+593', // Ecuador
  'SV': '+503', // El Salvador
  'EE': '+372', // Estonia
  'FI': '+358', // Finland
  'FR': '+33', // France
  'DE': '+49', // Germany
  'GR': '+30', // Greece
  'GT': '+502', // Guatemala
  'HN': '+504', // Honduras
  'HK': '+852', // Hong Kong
  'HU': '+36', // Hungary
  'IN': '+91', // India
  'ID': '+62', // Indonesia
  'IE': '+353', // Ireland
  'IL': '+972', // Israel
  'IT': '+39', // Italy
  'JP': '+81', // Japan
  'KR': '+82', // South Korea
  'LV': '+371', // Latvia
  'LT': '+370', // Lithuania
  'LU': '+352', // Luxembourg
  'MY': '+60', // Malaysia
  'MX': '+52', // Mexico
  'NL': '+31', // Netherlands
  'NZ': '+64', // New Zealand
  'NI': '+505', // Nicaragua
  'NO': '+47', // Norway
  'PA': '+507', // Panama
  'PY': '+595', // Paraguay
  'PE': '+51', // Peru
  'PH': '+63', // Philippines
  'PL': '+48', // Poland
  'PT': '+351', // Portugal
  'PR': '+1-787', // Puerto Rico
  'RO': '+40', // Romania
  'RU': '+7', // Russia
  'SG': '+65', // Singapore
  'SK': '+421', // Slovakia
  'ES': '+34', // Spain
  'SE': '+46', // Sweden
  'CH': '+41', // Switzerland
  'TW': '+886', // Taiwan
  'TH': '+66', // Thailand
  'TR': '+90', // Turkey
  'UA': '+380', // Ukraine
  'AE': '+971', // United Arab Emirates
  'GB': '+44', // United Kingdom
  'US': '+1', // United States
  'UY': '+598', // Uruguay
  'VE': '+58', // Venezuela
  'VN': '+84', // Vietnam
};

/**
 * Detects the appropriate language based on country code
 * @param countryCode - ISO 3166-1 alpha-2 country code (e.g., 'ES', 'AR', 'US')
 * @returns 'es' if Spanish-speaking country, 'en' otherwise
 */
export const detectLanguageByCountry = (countryCode: string): Language => {
  const upperCode = countryCode.toUpperCase();
  return SPANISH_COUNTRIES.includes(upperCode) ? 'es' : 'en';
};

/**
 * Get phone country code by country code
 * @param countryCode - ISO 3166-1 alpha-2 country code
 * @returns Phone country code (e.g., '+1', '+34', '+57')
 */
export const getPhoneCodeByCountry = (countryCode: string): string => {
  const upperCode = countryCode.toUpperCase();
  return COUNTRY_PHONE_CODES[upperCode] || '';
};

/**
 * Get list of Spanish-speaking countries for dropdown
 */
export const getCountriesList = () => [
  { code: 'AR', name: 'Argentina' },
  { code: 'AU', name: 'Australia' },
  { code: 'AT', name: 'Austria' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BO', name: 'Bolivia' },
  { code: 'BR', name: 'Brazil' },
  { code: 'CA', name: 'Canada' },
  { code: 'CL', name: 'Chile' },
  { code: 'CN', name: 'China' },
  { code: 'CO', name: 'Colombia' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'CU', name: 'Cuba' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'DK', name: 'Denmark' },
  { code: 'DO', name: 'Dominican Republic' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'SV', name: 'El Salvador' },
  { code: 'EE', name: 'Estonia' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'GR', name: 'Greece' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'HN', name: 'Honduras' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IN', name: 'India' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IL', name: 'Israel' },
  { code: 'IT', name: 'Italy' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'LV', name: 'Latvia' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'MX', name: 'Mexico' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'NI', name: 'Nicaragua' },
  { code: 'NO', name: 'Norway' },
  { code: 'PA', name: 'Panama' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'PE', name: 'Peru' },
  { code: 'PH', name: 'Philippines' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'PR', name: 'Puerto Rico' },
  { code: 'RO', name: 'Romania' },
  { code: 'RU', name: 'Russia' },
  { code: 'SG', name: 'Singapore' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'ES', name: 'Spain' },
  { code: 'SE', name: 'Sweden' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'TH', name: 'Thailand' },
  { code: 'TR', name: 'Turkey' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'VN', name: 'Vietnam' },
];
