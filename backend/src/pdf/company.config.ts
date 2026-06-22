/**
 * Seller (Abrican) profile printed on quotations and tax invoices.
 *
 * Template-first: these are sensible defaults taken from the company's real
 * invoice, each overridable by an env var. Phase 2's "data later" pass can move
 * this into a CompanySettings table without touching the PDF template.
 */
const env = (key: string, fallback: string) => process.env[key] ?? fallback;

export const COMPANY = {
  nameEn: env('COMPANY_NAME_EN', 'Abrican Co. Ltd.'),
  nameAr: env('COMPANY_NAME_AR', 'شركة أبركان المحدودة'),
  crNumber: env('COMPANY_CR', '2051038164'),
  vatNumber: env('COMPANY_VAT', '310918089300003'),
  chamberOfCommerce: env('COMPANY_COC', '124494'),
  address: {
    buildingNo: env('COMPANY_BUILDING_NO', '7169'),
    streetEn: env('COMPANY_STREET_EN', 'King Abdulaziz Rd.'),
    streetAr: env('COMPANY_STREET_AR', 'طريق الملك عبدالعزيز'),
    districtEn: env('COMPANY_DISTRICT_EN', 'Al Khubar Ash Shamaliyah'),
    districtAr: env('COMPANY_DISTRICT_AR', 'الخبر الشمالية'),
    cityEn: env('COMPANY_CITY_EN', 'Khobar'),
    cityAr: env('COMPANY_CITY_AR', 'الخبر'),
    postalCode: env('COMPANY_POSTAL', '34428'),
    additionalNo: env('COMPANY_ADDITIONAL_NO', '2670'),
    countryEn: env('COMPANY_COUNTRY_EN', 'Kingdom of Saudi Arabia'),
    countryAr: env('COMPANY_COUNTRY_AR', 'المملكة العربية السعودية'),
  },
  bank: {
    nameEn: env('COMPANY_BANK_EN', 'SAUDI NATIONAL BANK'),
    nameAr: env('COMPANY_BANK_AR', 'البنك الأهلي السعودي'),
    iban: env('COMPANY_IBAN', 'SA6210000096400000793604'),
    accountNo: env('COMPANY_ACCOUNT_NO', '96400000793604'),
  },
  footer: env(
    'COMPANY_FOOTER',
    'Tel: +966 (013) 865 5436 / 5106 - Fax: +966 (013) 855 4532 - P.O.Box 2670 - Al Khobar 31952 - Kingdom of Saudi Arabia',
  ),
  /** Path to the brand mark, resolved at runtime; embedded as base64 if found. */
  logoPath: env('COMPANY_LOGO_PATH', 'src/pdf/assets/abrican-logo.png'),
};
