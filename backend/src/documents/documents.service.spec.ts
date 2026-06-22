import { BadRequestException } from '@nestjs/common';
import { DocumentsService, UploadedFileLike } from './documents.service';

function makeFile(overrides: Partial<UploadedFileLike> = {}): UploadedFileLike {
  return {
    originalname: 'cert.pdf',
    buffer: Buffer.from('%PDF-1.4 test'),
    mimetype: 'application/pdf',
    size: 13,
    ...overrides,
  };
}

describe('DocumentsService', () => {
  let prisma: any;
  let storage: { save: jest.Mock; getPath: jest.Mock; delete: jest.Mock };
  let service: DocumentsService;

  beforeEach(() => {
    prisma = {
      employee: { findUnique: jest.fn().mockResolvedValue({ id: 'emp-1' }) },
      vehicle: { findUnique: jest.fn() },
      equipment: { findUnique: jest.fn() },
      contract: { findUnique: jest.fn() },
      client: { findUnique: jest.fn() },
      document: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'doc-1', expiryDate: data.expiryDate ?? null, ...data }),
        ),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    storage = {
      save: jest.fn().mockResolvedValue({ url: '/files/documents_employee/abc-cert.pdf' }),
      getPath: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    service = new DocumentsService(prisma, storage as any);
  });

  const empDto = {
    relatedEntityType: 'EMPLOYEE' as const,
    employeeId: 'emp-1',
    documentType: 'Safety Passport',
  };

  describe('file validation', () => {
    it('requires a file', async () => {
      await expect(service.create(empDto, undefined, 'user-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects files over 10 MB', async () => {
      const big = makeFile({ size: 11 * 1024 * 1024 });
      await expect(service.create(empDto, big, 'user-1')).rejects.toThrow(/10 MB/);
    });

    it('rejects unsupported mime types', async () => {
      const exe = makeFile({ mimetype: 'application/x-msdownload' });
      await expect(service.create(empDto, exe, 'user-1')).rejects.toThrow(/Unsupported file type/);
    });

    it('accepts images', async () => {
      const img = makeFile({ mimetype: 'image/png' });
      await expect(service.create(empDto, img, 'user-1')).resolves.toBeDefined();
    });
  });

  describe('polymorphic relation', () => {
    it('requires the id matching the entity type', async () => {
      await expect(
        service.create({ relatedEntityType: 'EMPLOYEE', documentType: 'X' } as any, makeFile(), 'u'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an id on a COMPANY document', async () => {
      await expect(
        service.create(
          { relatedEntityType: 'COMPANY', documentType: 'ISO', employeeId: 'emp-1' } as any,
          makeFile(),
          'u',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a non-existent related entity', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);
      await expect(service.create(empDto, makeFile(), 'u')).rejects.toThrow(/Invalid employeeId/);
    });

    it('allows a COMPANY document with no entity id', async () => {
      const doc = await service.create(
        { relatedEntityType: 'COMPANY', documentType: 'ISO 9001' } as any,
        makeFile(),
        'u',
      );
      expect(doc.id).toBe('doc-1');
    });
  });

  describe('create', () => {
    it('saves the file then writes the record and returns a computed status', async () => {
      const doc = await service.create(
        { ...empDto, expiryDate: '2020-01-01' },
        makeFile(),
        'user-1',
      );
      expect(storage.save).toHaveBeenCalledTimes(1);
      expect(prisma.document.create).toHaveBeenCalledTimes(1);
      expect(doc.expiryStatus).toBe('EXPIRED');
    });

    it('rolls back the stored file if the DB write fails', async () => {
      prisma.document.create.mockRejectedValue(new Error('db down'));
      await expect(service.create(empDto, makeFile(), 'user-1')).rejects.toThrow('db down');
      expect(storage.delete).toHaveBeenCalledWith('/files/documents_employee/abc-cert.pdf');
    });

    it('rejects an expiry date before the issue date', async () => {
      await expect(
        service.create(
          { ...empDto, issueDate: '2026-06-01', expiryDate: '2026-05-01' },
          makeFile(),
          'u',
        ),
      ).rejects.toThrow(/expiryDate cannot be before issueDate/);
    });
  });

  describe('findAll expiry filter', () => {
    it('filters to expired documents', async () => {
      await service.findAll({ expired: true } as any);
      const where = prisma.document.findMany.mock.calls[0][0].where;
      expect(where.expiryDate.lt).toBeInstanceOf(Date);
    });

    it('filters to documents expiring within N days', async () => {
      await service.findAll({ expiringWithinDays: 30 } as any);
      const where = prisma.document.findMany.mock.calls[0][0].where;
      expect(where.expiryDate.lte).toBeInstanceOf(Date);
    });
  });
});
