import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// =============================================================================
// Permission catalogue (Phase 1)
// =============================================================================

const PERMISSIONS: { key: string; description: string }[] = [
  { key: 'auth.me', description: 'View own user profile and permissions' },
  { key: 'users.view', description: 'View user accounts' },
  { key: 'users.manage', description: 'Create, update, and delete user accounts' },
  { key: 'roles.view', description: 'View roles and their permissions' },
  { key: 'roles.manage', description: 'Create, update, and delete roles and permission assignments' },
  { key: 'audit_logs.view', description: 'View system audit logs' },
  { key: 'clients.view', description: 'View clients and their contacts' },
  { key: 'clients.manage', description: 'Create, update, and delete clients and contacts' },
  { key: 'contracts.view', description: 'View contracts and rate cards' },
  { key: 'contracts.manage', description: 'Create, update, and delete contracts and rate cards' },
  { key: 'purchase_orders.view', description: 'View purchase orders' },
  { key: 'purchase_orders.manage', description: 'Create, update, and delete purchase orders' },
  { key: 'jobs.view', description: 'View jobs and job details' },
  { key: 'jobs.manage', description: 'Create and update jobs' },
  { key: 'jobs.status_change', description: 'Change job status' },
  { key: 'jobs.status_override', description: 'Override job status transition rules' },
  { key: 'employees.view', description: 'View employees' },
  { key: 'employees.manage', description: 'Create, update, and delete employees' },
  { key: 'crews.view', description: 'View crews and crew members' },
  { key: 'crews.manage', description: 'Create, update, and delete crews and crew members' },
  { key: 'vehicles.view', description: 'View vehicles' },
  { key: 'vehicles.manage', description: 'Create, update, and delete vehicles' },
  { key: 'equipment.view', description: 'View equipment' },
  { key: 'equipment.manage', description: 'Create, update, and delete equipment' },
  { key: 'assignments.view', description: 'View resource assignments and schedule' },
  { key: 'assignments.manage', description: 'Create and update resource assignments' },
  { key: 'assignments.override', description: 'Override resource conflict and availability checks' },
  { key: 'documents.view', description: 'View documents' },
  { key: 'documents.manage', description: 'Upload, update, and delete documents' },
  { key: 'dashboard.operations.view', description: 'View operations dashboard' },
  { key: 'dashboard.assets.view', description: 'View assets dashboard' },
  // Phase 2 — Finance
  { key: 'estimates.view', description: 'View job estimates and quotations' },
  { key: 'estimates.manage', description: 'Create, edit, send, and convert estimates' },
  { key: 'estimates.approve', description: 'Approve or reject estimates' },
  { key: 'invoices.view', description: 'View invoices' },
  { key: 'invoices.manage', description: 'Create and edit invoices' },
  { key: 'invoices.approve', description: 'Approve and issue invoices' },
  { key: 'payments.view', description: 'View payments and receivables' },
  { key: 'payments.manage', description: 'Record payments against invoices' },
  { key: 'daily_reports.view', description: 'View daily field reports' },
  { key: 'daily_reports.manage', description: 'Create, edit, and submit daily reports' },
  { key: 'daily_reports.approve', description: 'Approve or reject daily reports' },
  { key: 'timesheets.view', description: 'View timesheets' },
  { key: 'timesheets.manage', description: 'Create, edit, and submit timesheets' },
  { key: 'timesheets.approve', description: 'Approve or reject timesheets' },
  { key: 'expenses.view', description: 'View expenses and reimbursements' },
  { key: 'expenses.manage', description: 'Create, edit, and submit expenses' },
  { key: 'expenses.approve', description: 'Approve, reject, post, and reimburse expenses' },
];

// =============================================================================
// Role -> permission matrix (Phase 1, see implementation plan §6.2)
// =============================================================================

const ALL_PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

const ROLE_PERMISSIONS: Record<string, string[]> = {
  Admin: ALL_PERMISSION_KEYS,

  'CEO/GM': [
    'auth.me',
    'users.view',
    'roles.view',
    'audit_logs.view',
    'clients.view',
    'contracts.view',
    'purchase_orders.view',
    'jobs.view',
    'jobs.status_change',
    'jobs.status_override',
    'employees.view',
    'crews.view',
    'vehicles.view',
    'equipment.view',
    'assignments.view',
    'assignments.override',
    'documents.view',
    'dashboard.operations.view',
    'dashboard.assets.view',
    'estimates.view',
    'estimates.approve',
    'invoices.view',
    'invoices.approve',
    'payments.view',
    'daily_reports.view',
    'timesheets.view',
    'expenses.view',
  ],

  'Operations Manager': [
    'auth.me',
    'audit_logs.view',
    'clients.view',
    'clients.manage',
    'contracts.view',
    'contracts.manage',
    'purchase_orders.view',
    'purchase_orders.manage',
    'jobs.view',
    'jobs.manage',
    'jobs.status_change',
    'jobs.status_override',
    'employees.view',
    'crews.view',
    'crews.manage',
    'vehicles.view',
    'vehicles.manage',
    'equipment.view',
    'equipment.manage',
    'assignments.view',
    'assignments.manage',
    'assignments.override',
    'documents.view',
    'documents.manage',
    'dashboard.operations.view',
    'dashboard.assets.view',
    'estimates.view',
    'estimates.manage',
    'invoices.view',
    'daily_reports.view',
    'daily_reports.manage',
    'daily_reports.approve',
    'timesheets.view',
    'timesheets.manage',
    'timesheets.approve',
    'expenses.view',
    'expenses.manage',
  ],

  'Finance Manager': [
    'auth.me',
    'audit_logs.view',
    'clients.view',
    'contracts.view',
    'contracts.manage',
    'purchase_orders.view',
    'purchase_orders.manage',
    'jobs.view',
    'dashboard.operations.view',
    'estimates.view',
    'estimates.manage',
    'estimates.approve',
    'invoices.view',
    'invoices.manage',
    'invoices.approve',
    'payments.view',
    'payments.manage',
    'daily_reports.view',
    'timesheets.view',
    'expenses.view',
    'expenses.manage',
    'expenses.approve',
  ],

  Accountant: [
    'auth.me',
    'clients.view',
    'contracts.view',
    'purchase_orders.view',
    'estimates.view',
    'invoices.view',
    'invoices.manage',
    'payments.view',
    'payments.manage',
    'daily_reports.view',
    'timesheets.view',
    'expenses.view',
    'expenses.manage',
  ],

  'Field Supervisor': [
    'auth.me',
    'jobs.view',
    'employees.view',
    'crews.view',
    'vehicles.view',
    'equipment.view',
    'assignments.view',
    'documents.view',
    'documents.manage',
    'daily_reports.view',
    'daily_reports.manage',
    'timesheets.view',
    'timesheets.manage',
    'expenses.view',
    'expenses.manage',
  ],

  'Maintenance Manager': [
    'auth.me',
    'jobs.view',
    'employees.view',
    'crews.view',
    'vehicles.view',
    'vehicles.manage',
    'equipment.view',
    'equipment.manage',
    'assignments.view',
    'assignments.override',
    'documents.view',
    'documents.manage',
    'dashboard.operations.view',
    'dashboard.assets.view',
  ],

  'HR/Admin Officer': [
    'auth.me',
    'users.view',
    'jobs.view',
    'employees.view',
    'employees.manage',
    'crews.view',
    'crews.manage',
    'vehicles.view',
    'equipment.view',
    'assignments.view',
    'documents.view',
    'documents.manage',
    'dashboard.assets.view',
  ],

  'Procurement Officer': [
    'auth.me',
    'clients.view',
    'contracts.view',
    'purchase_orders.view',
    'purchase_orders.manage',
    'jobs.view',
    'documents.view',
    'documents.manage',
  ],

  'Viewer/Auditor': [
    'auth.me',
    'users.view',
    'roles.view',
    'audit_logs.view',
    'clients.view',
    'contracts.view',
    'purchase_orders.view',
    'jobs.view',
    'employees.view',
    'crews.view',
    'vehicles.view',
    'equipment.view',
    'assignments.view',
    'documents.view',
    'dashboard.operations.view',
    'dashboard.assets.view',
    'estimates.view',
    'invoices.view',
    'payments.view',
    'daily_reports.view',
    'timesheets.view',
    'expenses.view',
  ],
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  Admin: 'Full system access',
  'CEO/GM': 'Executive oversight: broad view access plus job status override authority',
  'Operations Manager':
    'Manages day-to-day operations: clients, contracts, jobs, resources, and scheduling',
  'Finance Manager': 'Manages contracts and purchase orders, with financial oversight of jobs',
  Accountant: 'Views client, contract, and purchase order records',
  'Field Supervisor': 'Views jobs and resources, manages job-site documents',
  'Maintenance Manager': 'Manages vehicles, equipment, and maintenance-related documents',
  'HR/Admin Officer': 'Manages employee and crew records',
  'Procurement Officer': 'Manages purchase orders and procurement documents',
  'Viewer/Auditor': 'Read-only access across the system',
};

async function main() {
  console.log('Seeding permissions...');
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: { description: permission.description },
      create: permission,
    });
  }

  console.log('Seeding roles and role-permission assignments...');
  for (const [roleName, permissionKeys] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: { description: ROLE_DESCRIPTIONS[roleName] },
      create: { name: roleName, description: ROLE_DESCRIPTIONS[roleName] },
    });

    const permissions = await prisma.permission.findMany({
      where: { key: { in: permissionKeys } },
    });

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
      skipDuplicates: true,
    });
  }

  console.log('Seeding admin user...');
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'Admin' } });
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@abrican.local';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'Admin@12345';
  const adminName = process.env.ADMIN_NAME ?? 'System Administrator';
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: adminName,
      email: adminEmail,
      passwordHash,
      roleId: adminRole.id,
      status: 'ACTIVE',
    },
  });

  await seedClientsContractsAndPurchaseOrders();
  await seedJobs();
  await seedResources();
  await seedAssignments();
  await seedDocuments();

  console.log('Seed completed.');
}

// =============================================================================
// Sprint 4 demo data: employees, crews, vehicles, equipment
// =============================================================================

async function seedResources() {
  if ((await prisma.employee.count()) > 0) {
    console.log('Resources already seeded, skipping demo data.');
    return;
  }

  console.log('Seeding demo employees, crews, vehicles, and equipment...');

  const [
    omar,
    faisal,
    yousef,
    salem,
    nasser,
    hamad,
    rashid,
    tariq,
  ] = await Promise.all(
    [
      { name: 'Omar Al-Shehri', role: 'Site Supervisor', department: 'Operations', costRate: 95, phone: '+966 50 111 2233' },
      { name: 'Faisal Al-Dossary', role: 'Pipeline Technician', department: 'Operations', costRate: 65 },
      { name: 'Yousef Khan', role: 'Pipeline Technician', department: 'Operations', costRate: 62 },
      { name: 'Salem Al-Qahtani', role: 'Coating Specialist', department: 'Operations', costRate: 70 },
      { name: 'Nasser Al-Amri', role: 'Mechanical Fitter', department: 'Mechanical', costRate: 68 },
      { name: 'Hamad Al-Subaie', role: 'Scaffolder', department: 'Mechanical', costRate: 55 },
      { name: 'Rashid Iqbal', role: 'Heavy Vehicle Driver', department: 'Logistics', costRate: 48 },
      {
        name: 'Tariq Al-Zahrani',
        role: 'Crane Operator',
        department: 'Logistics',
        costRate: 80,
        availabilityStatus: 'ON_LEAVE' as const,
      },
    ].map((employee) => prisma.employee.create({ data: employee })),
  );

  const pipelineCrew = await prisma.crew.create({
    data: {
      name: 'Pipeline Crew A',
      supervisorId: omar.id,
      serviceCapability: 'Pipeline maintenance, pigging, valve overhaul',
      status: 'AVAILABLE',
    },
  });
  const mechanicalCrew = await prisma.crew.create({
    data: {
      name: 'Mechanical Crew B',
      supervisorId: nasser.id,
      serviceCapability: 'Turnaround mechanical support, scaffolding',
      status: 'AVAILABLE',
    },
  });

  await prisma.crewMember.createMany({
    data: [
      { crewId: pipelineCrew.id, employeeId: faisal.id, startDate: new Date('2025-01-01') },
      { crewId: pipelineCrew.id, employeeId: yousef.id, startDate: new Date('2025-01-01') },
      { crewId: pipelineCrew.id, employeeId: salem.id, startDate: new Date('2025-06-01') },
      { crewId: mechanicalCrew.id, employeeId: hamad.id, startDate: new Date('2025-03-01') },
      {
        crewId: mechanicalCrew.id,
        employeeId: rashid.id,
        startDate: new Date('2025-03-01'),
        endDate: new Date('2025-12-31'),
        status: 'INACTIVE',
      },
    ],
  });

  await prisma.vehicle.createMany({
    data: [
      {
        plateNumber: 'ABR-7821',
        vehicleType: 'Flatbed Truck',
        make: 'Mercedes-Benz',
        model: 'Actros 3340',
        year: 2022,
        ownershipType: 'OWNED',
        status: 'AVAILABLE',
        odometer: 84_500,
        fuelType: 'Diesel',
        registrationExpiry: new Date('2026-11-30'),
        insuranceExpiry: new Date('2026-09-15'),
        inspectionExpiry: new Date('2026-08-01'),
        costRate: 180,
      },
      {
        plateNumber: 'ABR-5512',
        vehicleType: 'Crew Bus',
        make: 'Toyota',
        model: 'Coaster',
        year: 2023,
        ownershipType: 'OWNED',
        status: 'AVAILABLE',
        odometer: 41_200,
        fuelType: 'Diesel',
        registrationExpiry: new Date('2027-02-28'),
        insuranceExpiry: new Date('2026-07-10'),
        costRate: 90,
      },
      {
        plateNumber: 'ABR-9034',
        vehicleType: 'Pickup',
        make: 'Toyota',
        model: 'Hilux',
        year: 2021,
        ownershipType: 'LEASED',
        status: 'IN_USE',
        odometer: 132_800,
        fuelType: 'Diesel',
        registrationExpiry: new Date('2026-06-25'),
        insuranceExpiry: new Date('2026-06-30'),
        costRate: 60,
      },
      {
        plateNumber: 'ABR-3377',
        vehicleType: 'Vacuum Tanker',
        make: 'MAN',
        model: 'TGS 33.360',
        year: 2019,
        ownershipType: 'OWNED',
        status: 'MAINTENANCE',
        odometer: 215_000,
        fuelType: 'Diesel',
        registrationExpiry: new Date('2026-10-01'),
        insuranceExpiry: new Date('2026-12-01'),
        costRate: 220,
        notes: 'Gearbox overhaul in progress at Dammam workshop.',
      },
      {
        plateNumber: 'ABR-1209',
        vehicleType: 'Mobile Crane',
        make: 'Liebherr',
        model: 'LTM 1050',
        year: 2017,
        ownershipType: 'RENTED',
        status: 'OUT_OF_SERVICE',
        costRate: 450,
        notes: 'Awaiting third-party inspection renewal.',
      },
    ],
  });

  await prisma.equipment.createMany({
    data: [
      {
        name: 'Pig Launcher Skid #1',
        equipmentType: 'Pigging Unit',
        serialNumber: 'PLS-2201',
        status: 'AVAILABLE',
        ownershipType: 'OWNED',
        costRate: 120,
        currentLocation: 'Dammam yard',
        maintenanceDueDate: new Date('2026-10-15'),
      },
      {
        name: 'Diesel Welding Machine 400A',
        equipmentType: 'Welding Machine',
        serialNumber: 'WM-400-07',
        status: 'AVAILABLE',
        ownershipType: 'OWNED',
        costRate: 45,
        currentLocation: 'Dammam yard',
        calibrationExpiry: new Date('2026-08-20'),
      },
      {
        name: 'Air Compressor 750 CFM',
        equipmentType: 'Compressor',
        serialNumber: 'AC-750-03',
        status: 'IN_USE',
        ownershipType: 'LEASED',
        costRate: 85,
        currentLocation: 'Buqayq corridor site',
        maintenanceDueDate: new Date('2026-07-05'),
      },
      {
        name: 'Holiday Detector Kit',
        equipmentType: 'Inspection Tool',
        serialNumber: 'HD-115',
        status: 'AVAILABLE',
        ownershipType: 'OWNED',
        costRate: 15,
        currentLocation: 'Dammam yard',
        calibrationExpiry: new Date('2026-06-28'),
        notes: 'Calibration expiring soon — book recalibration.',
      },
      {
        name: 'Hydraulic Torque Wrench Set',
        equipmentType: 'Torquing Tool',
        serialNumber: 'HTW-22',
        status: 'MAINTENANCE',
        ownershipType: 'OWNED',
        costRate: 30,
        currentLocation: 'Dammam workshop',
        maintenanceDueDate: new Date('2026-06-10'),
        notes: 'Pump seal replacement.',
      },
    ],
  });
}

// =============================================================================
// Sprint 2 demo data: clients, contacts, contracts, rate cards, purchase orders
// =============================================================================

async function seedClientsContractsAndPurchaseOrders() {
  if ((await prisma.client.count()) > 0) {
    console.log('Clients already seeded, skipping demo data.');
    return;
  }

  console.log('Seeding demo clients, contracts, and purchase orders...');

  const aramco = await prisma.client.create({
    data: {
      name: 'Saudi Aramco',
      clientType: 'GOVERNMENT',
      vatNumber: '300000000000003',
      crNumber: '2052101150',
      billingAddress: 'P.O. Box 5000, Dhahran 31311, Saudi Arabia',
      paymentTermsDays: 60,
      status: 'ACTIVE',
      notes: 'Strategic account. All work orders via SAP Ariba.',
      contacts: {
        create: [
          {
            name: 'Khalid Al-Otaibi',
            role: 'Procurement Lead',
            phone: '+966 13 872 0000',
            email: 'khalid.otaibi@example.com',
          },
          {
            name: 'Sarah Al-Ghamdi',
            role: 'Field Coordinator',
            phone: '+966 13 872 1111',
            email: 'sarah.ghamdi@example.com',
          },
        ],
      },
    },
  });

  const sabic = await prisma.client.create({
    data: {
      name: 'SABIC',
      clientType: 'SEMI_GOVERNMENT',
      vatNumber: '300000000000011',
      crNumber: '1010010813',
      billingAddress: 'P.O. Box 5101, Riyadh 11422, Saudi Arabia',
      paymentTermsDays: 45,
      status: 'ACTIVE',
      contacts: {
        create: [
          {
            name: 'Fahad Al-Mutairi',
            role: 'Contracts Manager',
            phone: '+966 11 225 8000',
            email: 'fahad.mutairi@example.com',
          },
        ],
      },
    },
  });

  const alkhorayef = await prisma.client.create({
    data: {
      name: 'Alkhorayef Petroleum',
      clientType: 'PRIVATE',
      vatNumber: '300000000000029',
      crNumber: '1010005599',
      billingAddress: 'P.O. Box 305, Riyadh 11411, Saudi Arabia',
      paymentTermsDays: 30,
      status: 'ACTIVE',
      contacts: {
        create: [
          {
            name: 'Mohammed Al-Harbi',
            role: 'Operations Director',
            phone: '+966 11 401 0044',
            email: 'mohammed.harbi@example.com',
          },
        ],
      },
    },
  });

  await prisma.client.create({
    data: {
      name: 'Gulf Coast Contracting',
      clientType: 'CONTRACTOR',
      paymentTermsDays: 30,
      status: 'INACTIVE',
      notes: 'Dormant since 2024. Reactivate on new subcontract award.',
    },
  });

  const aramcoContract = await prisma.contract.create({
    data: {
      clientId: aramco.id,
      contractNumber: 'CNT-2025-001',
      title: 'Pipeline Maintenance Services — Eastern Province',
      scope:
        'Scheduled and corrective maintenance of crude transfer pipelines, including pigging, coating repair, and valve servicing.',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2027-12-31'),
      contractValue: 12_500_000,
      paymentTermsDays: 60,
      status: 'ACTIVE',
      rateCards: {
        create: [
          {
            serviceLine: 'Pipeline Maintenance',
            itemCode: 'PM-001',
            description: 'Pipeline pigging run (per km)',
            unit: 'km',
            unitPrice: 4_500,
            effectiveDate: new Date('2025-01-01'),
          },
          {
            serviceLine: 'Pipeline Maintenance',
            itemCode: 'PM-002',
            description: 'Valve overhaul (per valve, up to 24")',
            unit: 'each',
            unitPrice: 18_000,
            effectiveDate: new Date('2025-01-01'),
          },
          {
            serviceLine: 'Coating & Insulation',
            itemCode: 'CI-001',
            description: 'External coating repair (per m²)',
            unit: 'm2',
            unitPrice: 950,
            effectiveDate: new Date('2025-01-01'),
          },
        ],
      },
    },
  });

  const sabicContract = await prisma.contract.create({
    data: {
      clientId: sabic.id,
      contractNumber: 'CNT-2025-014',
      title: 'Plant Turnaround Support — Jubail',
      scope: 'Mechanical and scaffolding support services for scheduled plant turnarounds.',
      startDate: new Date('2025-06-01'),
      endDate: new Date('2026-05-31'),
      contractValue: 4_200_000,
      paymentTermsDays: 45,
      status: 'ACTIVE',
      rateCards: {
        create: [
          {
            serviceLine: 'Mechanical Services',
            itemCode: 'MS-010',
            description: 'Skilled technician (per hour)',
            unit: 'hour',
            unitPrice: 210,
            effectiveDate: new Date('2025-06-01'),
          },
          {
            serviceLine: 'Scaffolding',
            itemCode: 'SC-001',
            description: 'Scaffold erection and dismantling (per m³)',
            unit: 'm3',
            unitPrice: 75,
            effectiveDate: new Date('2025-06-01'),
          },
        ],
      },
    },
  });

  await prisma.contract.create({
    data: {
      clientId: alkhorayef.id,
      contractNumber: 'CNT-2024-087',
      title: 'ESP Workover Support Services',
      scope: 'Electric submersible pump retrieval and installation support.',
      startDate: new Date('2024-03-01'),
      endDate: new Date('2026-02-28'),
      contractValue: 1_800_000,
      paymentTermsDays: 30,
      status: 'EXPIRED',
    },
  });

  await prisma.purchaseOrder.createMany({
    data: [
      {
        clientId: aramco.id,
        contractId: aramcoContract.id,
        poNumber: 'PO-4501234567',
        poValue: 2_400_000,
        issueDate: new Date('2026-01-15'),
        expiryDate: new Date('2026-12-31'),
        status: 'ACTIVE',
      },
      {
        clientId: aramco.id,
        contractId: aramcoContract.id,
        poNumber: 'PO-4501198765',
        poValue: 1_750_000,
        issueDate: new Date('2025-02-01'),
        expiryDate: new Date('2025-12-31'),
        status: 'EXPIRED',
      },
      {
        clientId: sabic.id,
        contractId: sabicContract.id,
        poNumber: 'PO-SB-88102',
        poValue: 950_000,
        issueDate: new Date('2026-03-01'),
        expiryDate: new Date('2026-09-30'),
        status: 'ACTIVE',
      },
      {
        clientId: alkhorayef.id,
        poNumber: 'PO-AKP-2026-31',
        poValue: 320_000,
        issueDate: new Date('2026-05-20'),
        expiryDate: new Date('2026-11-20'),
        status: 'DRAFT',
      },
    ],
  });
}

// =============================================================================
// Sprint 3 demo data: jobs across lifecycle statuses, with status history
// =============================================================================

async function seedJobs() {
  if ((await prisma.job.count()) > 0) {
    console.log('Jobs already seeded, skipping demo data.');
    return;
  }

  console.log('Seeding demo jobs...');

  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: process.env.ADMIN_EMAIL ?? 'admin@abrican.local' },
  });
  const aramco = await prisma.client.findFirstOrThrow({ where: { name: 'Saudi Aramco' } });
  const sabic = await prisma.client.findFirstOrThrow({ where: { name: 'SABIC' } });
  const alkhorayef = await prisma.client.findFirstOrThrow({
    where: { name: 'Alkhorayef Petroleum' },
  });
  const aramcoContract = await prisma.contract.findUniqueOrThrow({
    where: { contractNumber: 'CNT-2025-001' },
  });
  const sabicContract = await prisma.contract.findUniqueOrThrow({
    where: { contractNumber: 'CNT-2025-014' },
  });
  const aramcoPo = await prisma.purchaseOrder.findUniqueOrThrow({
    where: { poNumber: 'PO-4501234567' },
  });
  const sabicPo = await prisma.purchaseOrder.findUniqueOrThrow({ where: { poNumber: 'PO-SB-88102' } });

  type SeedJob = {
    jobCode: string;
    title: string;
    clientId: string;
    contractId?: string;
    purchaseOrderId?: string;
    serviceType: string;
    location: string;
    region?: string;
    plannedStartDate: Date;
    plannedEndDate: Date;
    actualStartDate?: Date;
    actualEndDate?: Date;
    jobValue?: number;
    costBudget?: number;
    description?: string;
    // Lifecycle path from DRAFT to the final status; history rows are written per hop.
    statusPath: import('@prisma/client').JobStatus[];
  };

  const jobs: SeedJob[] = [
    {
      jobCode: 'JOB-2026-0001',
      title: 'Valve overhaul — Abqaiq manifold station',
      clientId: aramco.id,
      contractId: aramcoContract.id,
      purchaseOrderId: aramcoPo.id,
      serviceType: 'Pipeline Maintenance',
      location: 'Abqaiq',
      region: 'Eastern Province',
      plannedStartDate: new Date('2026-07-01'),
      plannedEndDate: new Date('2026-07-20'),
      jobValue: 180_000,
      costBudget: 110_000,
      description: 'Overhaul of 8 transfer valves at the Abqaiq manifold station.',
      statusPath: [],
    },
    {
      jobCode: 'JOB-2026-0002',
      title: 'Pigging run — Dhahran-Ras Tanura line section 4',
      clientId: aramco.id,
      contractId: aramcoContract.id,
      purchaseOrderId: aramcoPo.id,
      serviceType: 'Pipeline Maintenance',
      location: 'Ras Tanura',
      region: 'Eastern Province',
      plannedStartDate: new Date('2026-07-10'),
      plannedEndDate: new Date('2026-07-25'),
      jobValue: 225_000,
      costBudget: 140_000,
      statusPath: ['PLANNED'],
    },
    {
      jobCode: 'JOB-2026-0003',
      title: 'Scaffolding — SABIC Jubail turnaround phase 1',
      clientId: sabic.id,
      contractId: sabicContract.id,
      purchaseOrderId: sabicPo.id,
      serviceType: 'Scaffolding',
      location: 'Jubail Industrial City',
      region: 'Eastern Province',
      plannedStartDate: new Date('2026-08-01'),
      plannedEndDate: new Date('2026-09-15'),
      jobValue: 310_000,
      costBudget: 205_000,
      statusPath: ['PLANNED', 'APPROVED'],
    },
    {
      jobCode: 'JOB-2026-0004',
      title: 'Mechanical support — SABIC compressor C-201 overhaul',
      clientId: sabic.id,
      contractId: sabicContract.id,
      purchaseOrderId: sabicPo.id,
      serviceType: 'Mechanical Services',
      location: 'Jubail Industrial City',
      region: 'Eastern Province',
      plannedStartDate: new Date('2026-06-20'),
      plannedEndDate: new Date('2026-07-10'),
      jobValue: 145_000,
      costBudget: 95_000,
      statusPath: ['PLANNED', 'APPROVED', 'SCHEDULED'],
    },
    {
      jobCode: 'JOB-2026-0005',
      title: 'Coating repair — Aramco crude line KM 88-95',
      clientId: aramco.id,
      contractId: aramcoContract.id,
      purchaseOrderId: aramcoPo.id,
      serviceType: 'Coating & Insulation',
      location: 'Buqayq corridor',
      region: 'Eastern Province',
      plannedStartDate: new Date('2026-06-01'),
      plannedEndDate: new Date('2026-06-30'),
      actualStartDate: new Date('2026-06-03'),
      jobValue: 96_000,
      costBudget: 58_000,
      description: 'External coating repair across 7 km of pipeline.',
      statusPath: ['PLANNED', 'APPROVED', 'SCHEDULED', 'ACTIVE'],
    },
    {
      jobCode: 'JOB-2026-0006',
      title: 'ESP retrieval — Alkhorayef well AK-117',
      clientId: alkhorayef.id,
      serviceType: 'ESP Workover',
      location: 'AK-117 wellsite',
      region: 'Eastern Province',
      plannedStartDate: new Date('2026-05-01'),
      plannedEndDate: new Date('2026-05-12'),
      actualStartDate: new Date('2026-05-02'),
      actualEndDate: new Date('2026-05-11'),
      jobValue: 78_000,
      costBudget: 49_000,
      statusPath: ['PLANNED', 'APPROVED', 'SCHEDULED', 'ACTIVE', 'COMPLETED'],
    },
    {
      jobCode: 'JOB-2026-0007',
      title: 'Standby crane support — cancelled by client',
      clientId: sabic.id,
      serviceType: 'Lifting & Rigging',
      location: 'Jubail Industrial City',
      region: 'Eastern Province',
      plannedStartDate: new Date('2026-06-15'),
      plannedEndDate: new Date('2026-06-18'),
      jobValue: 22_000,
      statusPath: ['PLANNED', 'CANCELLED'],
    },
  ];

  for (const seedJob of jobs) {
    const { statusPath, ...data } = seedJob;
    const finalStatus = statusPath[statusPath.length - 1] ?? 'DRAFT';
    const job = await prisma.job.create({ data: { ...data, status: finalStatus } });

    let fromStatus: import('@prisma/client').JobStatus = 'DRAFT';
    let timestamp = new Date(data.plannedStartDate.getTime() - 14 * 24 * 60 * 60 * 1000);
    for (const toStatus of statusPath) {
      await prisma.jobStatusHistory.create({
        data: {
          jobId: job.id,
          fromStatus,
          toStatus,
          changedById: admin.id,
          createdAt: timestamp,
          ...(toStatus === 'CANCELLED' ? { reason: 'Client cancelled the work order' } : {}),
        },
      });
      fromStatus = toStatus;
      timestamp = new Date(timestamp.getTime() + 2 * 24 * 60 * 60 * 1000);
    }
  }
}

// =============================================================================
// Sprint 5 demo data: resource assignments (scheduling)
// =============================================================================

async function seedAssignments() {
  if ((await prisma.jobAssignment.count()) > 0) {
    console.log('Assignments already seeded, skipping demo data.');
    return;
  }

  console.log('Seeding demo resource assignments...');

  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: process.env.ADMIN_EMAIL ?? 'admin@abrican.local' },
  });

  const job = async (jobCode: string) =>
    prisma.job.findUniqueOrThrow({ where: { jobCode }, select: { id: true } });
  const employee = async (name: string) =>
    prisma.employee.findFirstOrThrow({ where: { name }, select: { id: true } });
  const crew = async (name: string) =>
    prisma.crew.findFirstOrThrow({ where: { name }, select: { id: true } });
  const vehicle = async (plateNumber: string) =>
    prisma.vehicle.findUniqueOrThrow({ where: { plateNumber }, select: { id: true } });
  const equipment = async (name: string) =>
    prisma.equipment.findFirstOrThrow({ where: { name }, select: { id: true } });

  const [j1, j4, j5, j6] = await Promise.all([
    job('JOB-2026-0001'),
    job('JOB-2026-0004'),
    job('JOB-2026-0005'),
    job('JOB-2026-0006'),
  ]);

  const assignments = [
    // Active coating job (June): one specialist + one technician + flatbed.
    {
      jobId: j5.id,
      resourceType: 'EMPLOYEE' as const,
      employeeId: (await employee('Salem Al-Qahtani')).id,
      startDatetime: new Date('2026-06-08T06:00:00Z'),
      endDatetime: new Date('2026-06-20T16:00:00Z'),
      plannedHours: 96,
      actualHours: 88,
      status: 'ACTIVE' as const,
    },
    {
      jobId: j5.id,
      resourceType: 'EMPLOYEE' as const,
      employeeId: (await employee('Faisal Al-Dossary')).id,
      startDatetime: new Date('2026-06-10T06:00:00Z'),
      endDatetime: new Date('2026-06-18T16:00:00Z'),
      plannedHours: 72,
      status: 'ACTIVE' as const,
    },
    // Scheduled mechanical job (late June -> early July): crew + flatbed truck.
    {
      jobId: j4.id,
      resourceType: 'CREW' as const,
      crewId: (await crew('Mechanical Crew B')).id,
      startDatetime: new Date('2026-06-20T06:00:00Z'),
      endDatetime: new Date('2026-07-05T16:00:00Z'),
      plannedHours: 120,
      status: 'PLANNED' as const,
    },
    {
      jobId: j4.id,
      resourceType: 'VEHICLE' as const,
      vehicleId: (await vehicle('ABR-7821')).id,
      startDatetime: new Date('2026-06-20T06:00:00Z'),
      endDatetime: new Date('2026-06-28T16:00:00Z'),
      plannedHours: 64,
      status: 'PLANNED' as const,
    },
    // Upcoming valve overhaul (July): pipeline crew + torque wrench set.
    {
      jobId: j1.id,
      resourceType: 'CREW' as const,
      crewId: (await crew('Pipeline Crew A')).id,
      startDatetime: new Date('2026-07-01T06:00:00Z'),
      endDatetime: new Date('2026-07-15T16:00:00Z'),
      plannedHours: 110,
      status: 'PLANNED' as const,
    },
    {
      jobId: j1.id,
      resourceType: 'EQUIPMENT' as const,
      equipmentId: (await equipment('Hydraulic Torque Wrench Set')).id,
      startDatetime: new Date('2026-07-01T06:00:00Z'),
      endDatetime: new Date('2026-07-12T16:00:00Z'),
      plannedHours: 88,
      status: 'PLANNED' as const,
    },
    // Completed ESP workover (May): technician with logged actual hours.
    {
      jobId: j6.id,
      resourceType: 'EMPLOYEE' as const,
      employeeId: (await employee('Yousef Khan')).id,
      startDatetime: new Date('2026-05-02T06:00:00Z'),
      endDatetime: new Date('2026-05-11T16:00:00Z'),
      plannedHours: 80,
      actualHours: 82,
      status: 'COMPLETED' as const,
    },
  ];

  for (const a of assignments) {
    await prisma.jobAssignment.create({ data: { ...a, createdById: admin.id } });
  }
}

// =============================================================================
// Sprint 6 demo data: documents (with placeholder files on the storage volume)
// =============================================================================

async function seedDocuments() {
  if ((await prisma.document.count()) > 0) {
    console.log('Documents already seeded, skipping demo data.');
    return;
  }

  console.log('Seeding demo documents...');

  const storageRoot = path.resolve(process.env.STORAGE_ROOT ?? './storage');
  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: process.env.ADMIN_EMAIL ?? 'admin@abrican.local' },
  });

  // Writes a tiny placeholder PDF to the storage volume, mirroring
  // StorageService's path scheme, and returns the public fileUrl.
  const placeholder = async (subPath: string, label: string): Promise<string> => {
    const safeSub = subPath.replace(/[^a-zA-Z0-9._-]/g, '_');
    const dir = path.join(storageRoot, safeSub);
    await fs.mkdir(dir, { recursive: true });
    const filename = `${randomUUID()}-${label.replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf`;
    await fs.writeFile(path.join(dir, filename), `%PDF-1.4\n% Demo document: ${label}\n`);
    return `/files/${safeSub}/${filename}`;
  };

  const daysFromNow = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d;
  };

  const omar = await prisma.employee.findFirstOrThrow({ where: { name: 'Omar Al-Shehri' } });
  const tariq = await prisma.employee.findFirstOrThrow({ where: { name: 'Tariq Al-Zahrani' } });
  const flatbed = await prisma.vehicle.findUniqueOrThrow({ where: { plateNumber: 'ABR-7821' } });
  const wrench = await prisma.equipment.findFirstOrThrow({
    where: { name: 'Hydraulic Torque Wrench Set' },
  });
  const aramcoContract = await prisma.contract.findUniqueOrThrow({
    where: { contractNumber: 'CNT-2025-001' },
  });

  const docs: Array<{
    relatedEntityType: import('@prisma/client').RelatedEntityType;
    employeeId?: string;
    vehicleId?: string;
    equipmentId?: string;
    contractId?: string;
    documentType: string;
    issueDate?: Date;
    expiryDate?: Date | null;
    notes?: string;
    sub: string;
  }> = [
    {
      relatedEntityType: 'EMPLOYEE',
      employeeId: omar.id,
      documentType: 'Safety Passport',
      issueDate: daysFromNow(-300),
      expiryDate: daysFromNow(25), // EXPIRING_30
      notes: 'H2S + confined space',
      sub: 'documents/employee',
    },
    {
      relatedEntityType: 'EMPLOYEE',
      employeeId: tariq.id,
      documentType: 'Heavy Vehicle Licence',
      issueDate: daysFromNow(-800),
      expiryDate: daysFromNow(-15), // EXPIRED
      notes: 'Renewal overdue',
      sub: 'documents/employee',
    },
    {
      relatedEntityType: 'VEHICLE',
      vehicleId: flatbed.id,
      documentType: 'Istimara (Registration)',
      issueDate: daysFromNow(-200),
      expiryDate: daysFromNow(170), // VALID
      sub: 'documents/vehicle',
    },
    {
      relatedEntityType: 'VEHICLE',
      vehicleId: flatbed.id,
      documentType: 'Insurance Policy',
      issueDate: daysFromNow(-100),
      expiryDate: daysFromNow(80), // EXPIRING_90
      sub: 'documents/vehicle',
    },
    {
      relatedEntityType: 'EQUIPMENT',
      equipmentId: wrench.id,
      documentType: 'Calibration Certificate',
      issueDate: daysFromNow(-180),
      expiryDate: daysFromNow(50), // EXPIRING_60
      sub: 'documents/equipment',
    },
    {
      relatedEntityType: 'CONTRACT',
      contractId: aramcoContract.id,
      documentType: 'Signed Contract',
      issueDate: daysFromNow(-365),
      expiryDate: null, // NO_EXPIRY
      sub: 'documents/contract',
    },
    {
      relatedEntityType: 'COMPANY',
      documentType: 'ISO 9001 Certificate',
      issueDate: daysFromNow(-120),
      expiryDate: daysFromNow(600), // VALID
      sub: 'documents/company',
    },
  ];

  for (const doc of docs) {
    const { sub, ...data } = doc;
    const fileUrl = await placeholder(sub, doc.documentType);
    await prisma.document.create({
      data: { ...data, fileUrl, uploadedById: admin.id },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
