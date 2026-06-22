import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as QRCode from 'qrcode';
import { COMPANY } from './company.config';

export interface PdfParty {
  nameEn: string;
  nameAr?: string | null;
  crNumber?: string | null;
  vatNumber?: string | null;
  addressLines?: string[];
}

export interface PdfLine {
  code: string;
  description: string;
  unit: string;
  qty: number;
  unitPrice: number;
  total: number; // qty × unit price (before VAT)
  vat: number;
  net: number; // total + VAT
}

export interface FinancialDocumentPdf {
  docTypeEn: string; // e.g. "TAX INVOICE"
  docTypeAr: string; // e.g. "فاتورة ضريبية"
  number: string;
  issueDate: Date;
  issueTime?: string | null;
  contractNo?: string | null;
  poNo?: string | null;
  siteLocation?: string | null;
  vendorNo?: string | null;
  extNo?: string | null;
  startJobDate?: Date | null;
  endJobDate?: Date | null;
  buyer: PdfParty;
  lines: PdfLine[];
  currency: string;
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  showBank?: boolean;
  notes?: string | null;
}

const GOTENBERG_URL = process.env.GOTENBERG_URL ?? 'http://gotenberg:3000';

let logoCache: string | null | undefined;
function logoDataUri(): string {
  if (logoCache !== undefined) return logoCache ?? '';
  try {
    const p = COMPANY.logoPath.startsWith('/') ? COMPANY.logoPath : join(process.cwd(), COMPANY.logoPath);
    logoCache = `data:image/png;base64,${readFileSync(p).toString('base64')}`;
  } catch {
    logoCache = null;
  }
  return logoCache ?? '';
}

const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d?: Date | null) => (d ? new Date(d).toISOString().slice(0, 10).replace(/-/g, '/') : '—');

// --- minimal English number-to-words for the "amount in words" line ---------
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function threeDigits(n: number): string {
  let out = '';
  if (n >= 100) {
    out += `${ONES[Math.floor(n / 100)]} Hundred`;
    n %= 100;
    if (n) out += ' ';
  }
  if (n >= 20) {
    out += TENS[Math.floor(n / 10)];
    if (n % 10) out += `-${ONES[n % 10]}`;
  } else if (n > 0) {
    out += ONES[n];
  }
  return out;
}
function intToWords(n: number): string {
  if (n === 0) return 'Zero';
  const parts: string[] = [];
  const scales = [['Million', 1_000_000], ['Thousand', 1_000]] as const;
  for (const [name, value] of scales) {
    if (n >= value) {
      parts.push(`${threeDigits(Math.floor(n / value))} ${name}`);
      n %= value;
    }
  }
  if (n > 0) parts.push(threeDigits(n));
  return parts.join(' ');
}
function amountInWords(total: number, currency: string): string {
  const whole = Math.floor(total);
  const cents = Math.round((total - whole) * 100);
  return `${intToWords(whole)} ${currency} and ${String(cents).padStart(2, '0')}/100 Only`;
}

/**
 * Renders quotation / tax-invoice PDFs from a bilingual (Arabic/English) HTML
 * template, converted to PDF by the Gotenberg sidecar (headless Chromium).
 * The public contract — `renderFinancialDocument(doc): Promise<Buffer>` — is
 * unchanged, so callers (estimates, invoices, streaming, issue-snapshot) are
 * untouched if the template or engine changes again.
 */
@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  async renderFinancialDocument(doc: FinancialDocumentPdf): Promise<Buffer> {
    // Tax invoices carry a ZATCA Phase-1 (generation) QR; quotations do not.
    const qr = doc.showBank ? await this.buildZatcaQr(doc) : null;
    const html = this.buildHtml(doc, qr);
    const form = new FormData();
    form.append('files', new Blob([html], { type: 'text/html' }), 'index.html');
    form.append('paperWidth', '8.27');
    form.append('paperHeight', '11.69');
    form.append('marginTop', '0.3');
    form.append('marginBottom', '0.3');
    form.append('marginLeft', '0.3');
    form.append('marginRight', '0.3');
    form.append('printBackground', 'true');

    const res = await fetch(`${GOTENBERG_URL}/forms/chromium/convert/html`, { method: 'POST', body: form });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      this.logger.error(`Gotenberg failed (${res.status}): ${detail}`);
      throw new Error(`PDF rendering failed (${res.status})`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  /**
   * ZATCA Phase-1 (generation) QR: a Base64-encoded TLV of 5 fields —
   * seller name, VAT number, ISO timestamp, total (incl. VAT), and VAT total —
   * rendered as a PNG data-URI. Phase-2 cryptographic tags (6–9) are out of
   * scope until full ZATCA onboarding (Phase 3).
   */
  private async buildZatcaQr(doc: FinancialDocumentPdf): Promise<string | null> {
    const tlv = (tag: number, value: string) => {
      const v = Buffer.from(value, 'utf8');
      return Buffer.concat([Buffer.from([tag, v.length]), v]);
    };
    const payload = Buffer.concat([
      tlv(1, COMPANY.nameAr || COMPANY.nameEn),
      tlv(2, COMPANY.vatNumber),
      tlv(3, new Date(doc.issueDate).toISOString()),
      tlv(4, doc.totalAmount.toFixed(2)),
      tlv(5, doc.vatAmount.toFixed(2)),
    ]).toString('base64');
    try {
      return await QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 1, width: 220 });
    } catch (error) {
      this.logger.warn(`ZATCA QR generation failed: ${(error as Error).message}`);
      return null;
    }
  }

  private buildHtml(doc: FinancialDocumentPdf, qr: string | null): string {
    const a = COMPANY.address;
    const logo = logoDataUri();

    const metaRow = (en: string, value: string, ar: string) =>
      `<div class="mrow"><span class="en">${esc(en)}</span><span class="val">${esc(value)}</span><span class="ar">${ar}</span></div>`;

    const leftMeta = [
      metaRow('Contract No.:', doc.contractNo ?? '—', 'رقم العقد'),
      metaRow('P.O. No.:', doc.poNo ?? '—', 'رقم طلب الشراء'),
      metaRow('Site Location:', doc.siteLocation ?? '—', 'الموقع'),
      metaRow('Ext. No.:', doc.extNo ?? '—', 'الرقم التسلسلي'),
      metaRow('Vendor No.:', doc.vendorNo ?? '—', 'رقم المورد'),
    ].join('');

    const rightMeta = [
      metaRow('Invoice No.:', doc.number, 'رقم الفاتورة'),
      metaRow('Issue Date:', fmtDate(doc.issueDate), 'تاريخ الإصدار'),
      metaRow('Issue Time:', doc.issueTime ?? '—', 'وقت الإصدار'),
      metaRow('Starting Job Date:', fmtDate(doc.startJobDate), 'تاريخ بدء العمل'),
      metaRow('End Job Date:', fmtDate(doc.endJobDate), 'تاريخ انتهاء العمل'),
    ].join('');

    const party = (titleEn: string, titleAr: string, p: PdfParty, full?: typeof COMPANY) => {
      const rows = full
        ? [
            metaRow('CR No.:', full.crNumber, 'رقم سجل تجاري'),
            metaRow('Vat Reg. No.:', full.vatNumber, 'رقم التسجيل الضريبي'),
            metaRow('Building No.:', full.address.buildingNo, 'رقم المبنى'),
            metaRow('Street Name:', full.address.streetEn, 'اسم الشارع'),
            metaRow('District Name:', full.address.districtEn, 'اسم الحي'),
            metaRow('City Name:', full.address.cityEn, 'اسم المدينة'),
            metaRow('Postal Code:', full.address.postalCode, 'الرمز البريدي'),
            metaRow('Additional No.:', full.address.additionalNo, 'الرقم الإضافي'),
            metaRow('Country:', full.address.countryEn, 'الدولة'),
          ].join('')
        : [
            metaRow('CR No.:', p.crNumber ?? '—', 'رقم سجل تجاري'),
            metaRow('Vat Reg. No.:', p.vatNumber ?? '—', 'رقم التسجيل الضريبي'),
            ...(p.addressLines ?? []).map(
              (l) => `<div class="mrow"><span class="addr">${esc(l)}</span></div>`,
            ),
          ].join('');
      const nameAr = full ? full.nameAr : p.nameAr;
      return `
        <div class="party">
          <div class="party-head"><span>${esc(titleEn)} :</span><span class="ar">: ${titleAr}</span></div>
          <div class="party-name">${esc(full ? full.nameEn : p.nameEn)}${nameAr ? ` <span class="ar">${nameAr}</span>` : ''}</div>
          ${rows}
        </div>`;
    };

    const lineRows = doc.lines
      .map(
        (l) => `
        <tr>
          <td class="c">${esc(l.code)}</td>
          <td>${esc(l.description)}</td>
          <td class="c">${esc(l.unit)}</td>
          <td class="r">${money(l.qty)}</td>
          <td class="r">${money(l.unitPrice)}</td>
          <td class="r">${money(l.total)}</td>
          <td class="r">${money(l.vat)}</td>
          <td class="r">${money(l.net)}</td>
        </tr>`,
      )
      .join('');

    const bankBlock = doc.showBank
      ? `
      <div class="bank">
        <div class="bank-head"><span>BANK DETAILS</span><span class="ar">تفاصيل البنك</span></div>
        ${metaRow('Bank Name:', `${COMPANY.bank.nameEn}`, `اسم البنك ${COMPANY.bank.nameAr}`)}
        ${metaRow('IBAN:', COMPANY.bank.iban, 'آيبان')}
        ${metaRow('ACC. NO.:', COMPANY.bank.accountNo, 'رقم الحساب')}
      </div>`
      : '';

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;700&family=Noto+Sans:wght@400;600;700&display=swap" rel="stylesheet" />
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Noto Sans', Arial, sans-serif; color: #111; font-size: 10px; margin: 0; }
  .ar { font-family: 'Noto Naskh Arabic', 'Noto Sans', serif; direction: rtl; }
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #1f3b8c; padding-bottom: 8px; }
  .brand-en { font-weight: 700; color: #1f3b8c; }
  .brand-en .big { font-size: 20px; }
  .brand-ar { text-align: right; font-weight: 700; color: #1f3b8c; }
  .brand-ar .big { font-size: 18px; }
  .logo { height: 64px; }
  .title { text-align: center; font-size: 16px; font-weight: 700; margin: 10px 0; letter-spacing: 0.5px; }
  .meta { display: flex; gap: 10px; }
  .meta .box { flex: 1; border: 1px solid #333; }
  .mrow { display: flex; justify-content: space-between; align-items: center; gap: 6px; padding: 2px 6px; border-bottom: 1px solid #ddd; }
  .mrow:last-child { border-bottom: none; }
  .mrow .en { color: #333; white-space: nowrap; }
  .mrow .val { font-weight: 700; text-align: center; flex: 1; }
  .mrow .ar { color: #333; white-space: nowrap; }
  .mrow .addr { color: #333; }
  .parties { display: flex; gap: 10px; margin-top: 8px; }
  .party { flex: 1; border: 1px solid #333; padding: 4px 0; }
  .party-head { display: flex; justify-content: space-between; font-weight: 700; padding: 2px 6px; background: #f1f4fb; }
  .party-name { font-weight: 700; padding: 3px 6px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #333; padding: 3px 5px; font-size: 9.5px; }
  th { background: #dfe6f5; text-align: center; }
  th .ar { display: block; font-weight: 700; }
  td.c { text-align: center; }
  td.r { text-align: right; }
  .totals { margin-top: 6px; }
  .totals .trow { display: flex; justify-content: space-between; border: 1px solid #333; border-top: none; padding: 3px 8px; font-weight: 700; }
  .totals .trow:first-child { border-top: 1px solid #333; }
  .totals .label-en { flex: 1; }
  .totals .label-ar { flex: 1; text-align: right; }
  .totals .amount { width: 120px; text-align: right; }
  .lower { display: flex; gap: 10px; margin-top: 8px; }
  .qr { width: 96px; height: 96px; object-fit: contain; border: 1px solid #ccc; padding: 2px; }
  .words { flex: 1; border: 1px solid #333; padding: 6px; }
  .bank { border: 1px solid #333; margin-top: 8px; }
  .bank-head { display: flex; justify-content: space-between; font-weight: 700; background: #f1f4fb; padding: 2px 6px; }
  .footer { margin-top: 12px; border-top: 2px solid #1f3b8c; padding-top: 6px; text-align: center; color: #1f3b8c; font-size: 9px; }
  .notes { margin-top: 8px; font-size: 9px; color: #444; }
</style>
</head>
<body>
  <div class="header">
    <div class="brand-en"><div class="big">${esc(COMPANY.nameEn)}</div><div>C.R. ${esc(COMPANY.crNumber)}</div><div>Chamber of Comm. No. ${esc(COMPANY.chamberOfCommerce)}</div></div>
    ${logo ? `<img class="logo" src="${logo}" alt="logo" />` : ''}
    <div class="brand-ar"><div class="big ar">${COMPANY.nameAr}</div><div class="ar">س.ت ${esc(COMPANY.crNumber)}</div><div class="ar">الغرفة التجارية رقم ${esc(COMPANY.chamberOfCommerce)}</div></div>
  </div>

  <div class="title">${esc(doc.docTypeEn)} / <span class="ar">${doc.docTypeAr}</span></div>

  <div class="meta">
    <div class="box">${leftMeta}</div>
    <div class="box">${rightMeta}</div>
  </div>

  <div class="parties">
    ${party('TO', 'إلى', doc.buyer)}
    ${party('FROM', 'من', { nameEn: COMPANY.nameEn, nameAr: COMPANY.nameAr }, COMPANY)}
  </div>

  <table>
    <thead>
      <tr>
        <th>Code<span class="ar">الكود</span></th>
        <th>Product / Description<span class="ar">الوصف / المنتج</span></th>
        <th>Unit<span class="ar">الوحدة</span></th>
        <th>Qty<span class="ar">الكمية</span></th>
        <th>Unit Price<span class="ar">سعر الوحدة</span></th>
        <th>Total<span class="ar">القيمة</span></th>
        <th>VAT 15%<span class="ar">الضريبة 15%</span></th>
        <th>Net Amount<span class="ar">الصافي</span></th>
      </tr>
    </thead>
    <tbody>${lineRows}</tbody>
  </table>

  <div class="totals">
    <div class="trow"><span class="label-en">Invoice Gross Amount</span><span class="label-ar ar">قيمة الفاتورة الإجمالية</span><span class="amount">${money(doc.subtotal)}</span></div>
    <div class="trow"><span class="label-en">Tax (VAT) 15%</span><span class="label-ar ar">ضريبة القيمة المضافة 15%</span><span class="amount">${money(doc.vatAmount)}</span></div>
    <div class="trow"><span class="label-en">Total Include Vat</span><span class="label-ar ar">الإجمالي شامل الضريبة</span><span class="amount">${money(doc.totalAmount)}</span></div>
    <div class="trow"><span class="label-en">Net Amount Payable - ${esc(doc.currency)}</span><span class="label-ar ar">المبلغ المستحق</span><span class="amount">${money(doc.totalAmount)}</span></div>
  </div>

  <div class="lower">
    ${qr ? `<img class="qr" src="${qr}" alt="ZATCA QR" />` : ''}
    <div class="words">( Just ${esc(amountInWords(doc.totalAmount, doc.currency))} )</div>
  </div>

  ${bankBlock}
  ${doc.notes ? `<div class="notes"><b>Notes:</b> ${esc(doc.notes)}</div>` : ''}

  <div class="footer">${esc(COMPANY.footer)}</div>
</body>
</html>`;
  }
}
