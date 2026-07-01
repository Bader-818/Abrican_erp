/**
 * One-off, idempotent import of Saudi Aramco contract 6601000307 and its full
 * pricing attachment (Schedule C, Attachment I) as a ContractRateCard.
 * Run inside the backend container:
 *   docker compose exec backend node prisma/import-contract-6601000307.cjs
 *
 * NOTE: the contract envelope (dates, payment terms) is NOT in the pricing PDF —
 * placeholders below; edit them in the Contracts UI. Prices/units transcribed
 * from the PDF; verify against the source document.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CONTRACT_NUMBER = '6601000307';
const EFFECTIVE = new Date('2025-01-01');

// serviceLine, itemCode, description, unit, unitPrice (SAR). unit: MH=man-hour,
// EH=equipment-hour, EA=each, VAL=value/lump (rule items priced 0 — set at use).
const ITEMS = [
  ['Labor Rate', '1.1', 'Operator', 'MH', 110],
  ['Labor Rate', '1.2', 'Driver', 'MH', 35],
  ['Labor Rate', '1.3', 'Helper', 'MH', 20],
  ['Labor Rate', '1.4', 'Supervisor with work permit receiver certificate', 'MH', 120],
  ['Labor Rate', '1.5', 'Standby Time for Labor 100%', 'VAL', 0],

  ['Equipment Rate', '2.1', 'Nitrogen Unit Vaporizer 1,000 SCF/min.', 'EH', 170],
  ['Equipment Rate', '2.2', 'Nitrogen Unit Vaporizer 3,000 SCF/min.', 'EH', 742],
  ['Equipment Rate', '2.3', 'Nitrogen Unit Vaporizer 4,000 SCF/min.', 'EH', 742],
  ['Equipment Rate', '2.4', 'Nitrogen Unit Vaporizer 10,000 SCF/min.', 'EH', 742],
  ['Equipment Rate', '2.5', 'LN2 Tanker 2000 gallon/min.', 'EH', 49],
  ['Equipment Rate', '2.6', 'LN2 Tanker 4000 gallon/min.', 'EH', 110],
  ['Equipment Rate', '2.7', '100 Tanker 7000 gallon/min.', 'EH', 330],
  ['Equipment Rate', '2.8', 'Hydrotest Pump 168 gal/min.', 'EH', 500],
  ['Equipment Rate', '2.9', 'Hydrotest Pump 250 gal/min.', 'EH', 500],
  ['Equipment Rate', '2.10', 'Hydrotest Pump 300 gal/min.', 'EH', 500],
  ['Equipment Rate', '2.11', 'Hydrotest Pump 500 gal/min.', 'EH', 533],
  ['Equipment Rate', '2.12', 'Hydrotest Pump 750 gal/min.', 'EH', 533],
  ['Equipment Rate', '2.13', 'Hydrotest Pump 1,500 gal/min.', 'EH', 533],
  ['Equipment Rate', '2.14', 'Low flow high pressure Pump up to 3000 PSI', 'EH', 660],
  ['Equipment Rate', '2.15', 'Filling / Feeding Pump up to 1,500 gal/min', 'EH', 176],
  ['Equipment Rate', '2.16', 'Water or crude storage tanker 1000 gallon', 'EH', 16],
  ['Equipment Rate', '2.17', 'Water or crude storage tanker 3000 gallon', 'EH', 22],
  ['Equipment Rate', '2.18', 'Water or crude storage tanker 4000 gallon', 'EH', 24],
  ['Equipment Rate', '2.19', 'Water or crude storage tanker 7000 gallon', 'EH', 49],
  ['Equipment Rate', '2.20', 'Water or crude storage tanker 10000 gallon', 'EH', 49],
  ['Equipment Rate', '2.21', 'Water or crude storage tanker 15000 gallon', 'EH', 49],
  ['Equipment Rate', '2.22', 'Water or crude storage tanker 21000 gallon', 'EH', 60],
  ['Equipment Rate', '2.23', 'Water or crude storage tank 1000 gallon', 'EH', 16],
  ['Equipment Rate', '2.24', 'Water or crude storage tank 4000 gallon', 'EH', 24],
  ['Equipment Rate', '2.25', 'Water or crude storage tank 10000 gallon', 'EH', 49],
  ['Equipment Rate', '2.26', 'Water Filter', 'EH', 110],
  ['Equipment Rate', '2.27', 'Low volume de-cruding full system 500 to 1000 gal/min', 'EH', 176],
  ['Equipment Rate', '2.28', 'Low volume de-cruding shipper pumps and hoses', 'EH', 495],
  ['Equipment Rate', '2.29', 'Medium volume de-cruding full system 150 to 2500 gal/min', 'EH', 330],
  ['Equipment Rate', '2.30', 'Medium volume de-cruding shipper pumps and hoses', 'EH', 660],
  ['Equipment Rate', '2.31', 'Standby Time for Equipment 70%', 'VAL', 0],

  ['Floodlight', '3.1', 'Provide floodlight set', 'EA', 35],

  ['Hydratight Bolted Flange', '4.10', 'Hydratight bolted flange from 2-12 inch', 'EA', 150],
  ['Hydratight Bolted Flange', '4.20', 'Hydratight bolted flange from 14-18 inch', 'EA', 150],
  ['Hydratight Bolted Flange', '4.30', 'Hydratight bolted flange from 20-26 inch', 'EA', 150],
  ['Hydratight Bolted Flange', '4.40', 'Hydratight bolted flange from 28-32 inch', 'EA', 150],
  ['Hydratight Bolted Flange', '4.50', 'Hydratight bolted flange from 34-38 inch', 'EA', 150],
  ['Hydratight Bolted Flange', '4.60', 'Hydratight bolted flange from 40-46 inch', 'EA', 200],
  ['Hydratight Bolted Flange', '4.70', 'Hydratight bolted flange from 48-60 inch', 'EA', 200],

  ['Emergency Work', '5.10', 'Emergency Work as per Schedule "B" Paragraph 6', 'EA', 25000],

  ['Set Off', '6.10', 'Catering and Accommodation (SAR 100/employee/day deduction)', 'VAL', 0],
  ['Set Off', '6.20', 'Set off payments as per paragraph 9 of Schedule "C"', 'VAL', 0],
];

async function main() {
  const client = await prisma.client.findFirst({ where: { name: 'Saudi Aramco' }, select: { id: true } });
  if (!client) throw new Error('Saudi Aramco client not found — create it first.');

  const contract = await prisma.contract.upsert({
    where: { contractNumber: CONTRACT_NUMBER },
    update: {},
    create: {
      clientId: client.id,
      contractNumber: CONTRACT_NUMBER,
      title: 'Nitrogen Purging, Crude Displace or Hydrotesting',
      scope: 'Nitrogen purging, crude displacement and hydrotesting services (Schedule C, Attachment I).',
      startDate: EFFECTIVE,
      endDate: new Date('2027-12-31'), // placeholder — confirm in Contracts UI
      contractValue: 0, // unit-rate contract; no fixed total — placeholder
      paymentTermsDays: 60, // placeholder — confirm
      status: 'ACTIVE',
    },
    select: { id: true, contractNumber: true },
  });

  const existing = await prisma.contractRateCard.count({ where: { contractId: contract.id } });
  if (existing > 0) {
    console.log(`Contract ${contract.contractNumber} already has ${existing} rate-card items — skipping (idempotent).`);
    return;
  }

  await prisma.contractRateCard.createMany({
    data: ITEMS.map(([serviceLine, itemCode, description, unit, unitPrice]) => ({
      contractId: contract.id,
      serviceLine,
      itemCode,
      description,
      unit,
      unitPrice,
      currency: 'SAR',
      vatApplicable: serviceLine !== 'Set Off',
      effectiveDate: EFFECTIVE,
    })),
  });

  const count = await prisma.contractRateCard.count({ where: { contractId: contract.id } });
  console.log(`Loaded contract ${contract.contractNumber} with ${count} rate-card items.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
