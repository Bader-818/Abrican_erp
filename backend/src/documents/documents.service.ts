import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RelatedEntityType } from '@prisma/client';
import { computeDocumentStatus } from '../common/helpers/document-status.helper';
import { paginate } from '../common/helpers/pagination.helper';
import { PrismaService } from '../prisma/prisma.service';
import { IStorageService } from '../storage/storage.interface';
import { CreateDocumentDto } from './dto/create-document.dto';
import { DocumentsQueryDto } from './dto/documents-query.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';

export interface UploadedFileLike {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
  size: number;
}

type RelationField = 'employeeId' | 'vehicleId' | 'equipmentId' | 'contractId' | 'clientId';

// COMPANY documents are company-wide and carry no foreign key.
const RELATION_FIELD: Record<RelatedEntityType, RelationField | null> = {
  [RelatedEntityType.EMPLOYEE]: 'employeeId',
  [RelatedEntityType.VEHICLE]: 'vehicleId',
  [RelatedEntityType.EQUIPMENT]: 'equipmentId',
  [RelatedEntityType.CONTRACT]: 'contractId',
  [RelatedEntityType.CLIENT]: 'clientId',
  [RelatedEntityType.COMPANY]: null,
};

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_PREFIXES = ['image/'];
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
];

const DOCUMENT_SELECT = {
  id: true,
  relatedEntityType: true,
  employeeId: true,
  vehicleId: true,
  equipmentId: true,
  contractId: true,
  clientId: true,
  documentType: true,
  issueDate: true,
  expiryDate: true,
  fileUrl: true,
  notes: true,
  createdAt: true,
  employee: { select: { id: true, name: true } },
  vehicle: { select: { id: true, plateNumber: true } },
  equipment: { select: { id: true, name: true } },
  contract: { select: { id: true, contractNumber: true } },
  client: { select: { id: true, name: true } },
  uploadedBy: { select: { id: true, name: true } },
} satisfies Prisma.DocumentSelect;

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('IStorageService') private readonly storage: IStorageService,
  ) {}

  async findAll(query: DocumentsQueryDto) {
    const where: Prisma.DocumentWhereInput = {
      ...(query.relatedEntityType ? { relatedEntityType: query.relatedEntityType } : {}),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.vehicleId ? { vehicleId: query.vehicleId } : {}),
      ...(query.equipmentId ? { equipmentId: query.equipmentId } : {}),
      ...(query.contractId ? { contractId: query.contractId } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.search
        ? {
            OR: [
              { documentType: { contains: query.search, mode: 'insensitive' } },
              { notes: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...this.expiryFilter(query),
    };

    const result = await paginate(this.prisma.document, query, {
      where,
      orderBy: { createdAt: 'desc' },
      select: DOCUMENT_SELECT,
    });

    return { ...result, data: result.data.map((d) => this.withStatus(d)) };
  }

  async findOne(id: string) {
    const document = await this.prisma.document.findUnique({
      where: { id },
      select: DOCUMENT_SELECT,
    });
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    return this.withStatus(document);
  }

  async create(dto: CreateDocumentDto, file: UploadedFileLike | undefined, userId: string) {
    if (!file) {
      throw new BadRequestException('A file is required');
    }
    this.validateFile(file);
    const relation = this.resolveRelation(dto);
    await this.assertRelatedEntityExists(dto.relatedEntityType, relation);
    this.validateDates(dto.issueDate, dto.expiryDate);

    const stored = await this.storage.save(
      file.buffer,
      file.originalname,
      file.mimetype,
      `documents/${dto.relatedEntityType.toLowerCase()}`,
    );

    try {
      const document = await this.prisma.document.create({
        data: {
          relatedEntityType: dto.relatedEntityType,
          ...(relation ? { [relation.field]: relation.id } : {}),
          documentType: dto.documentType,
          issueDate: dto.issueDate ? new Date(dto.issueDate) : null,
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
          fileUrl: stored.url,
          notes: dto.notes,
          uploadedById: userId,
        },
        select: DOCUMENT_SELECT,
      });
      return this.withStatus(document);
    } catch (error) {
      // Roll back the orphaned file if the DB write fails.
      await this.storage.delete(stored.url).catch(() => undefined);
      throw error;
    }
  }

  async update(id: string, dto: UpdateDocumentDto) {
    const existing = await this.prisma.document.findUnique({
      where: { id },
      select: { id: true, issueDate: true, expiryDate: true },
    });
    if (!existing) {
      throw new NotFoundException('Document not found');
    }

    const issueDate = dto.issueDate ?? existing.issueDate?.toISOString();
    const expiryDate = dto.expiryDate ?? existing.expiryDate?.toISOString();
    this.validateDates(issueDate ?? undefined, expiryDate ?? undefined);

    const document = await this.prisma.document.update({
      where: { id },
      data: {
        ...(dto.documentType !== undefined ? { documentType: dto.documentType } : {}),
        ...(dto.issueDate !== undefined ? { issueDate: dto.issueDate ? new Date(dto.issueDate) : null } : {}),
        ...(dto.expiryDate !== undefined ? { expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
      select: DOCUMENT_SELECT,
    });
    return this.withStatus(document);
  }

  async remove(id: string) {
    const existing = await this.prisma.document.findUnique({
      where: { id },
      select: { id: true, fileUrl: true },
    });
    if (!existing) {
      throw new NotFoundException('Document not found');
    }

    await this.prisma.document.delete({ where: { id } });
    await this.storage.delete(existing.fileUrl).catch(() => undefined);
    return { success: true };
  }

  /** Returns the absolute filesystem path + metadata for streaming a download. */
  async getDownload(id: string) {
    const document = await this.prisma.document.findUnique({
      where: { id },
      select: { fileUrl: true, documentType: true },
    });
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    return {
      path: this.storage.getPath(document.fileUrl),
      filename: document.fileUrl.split('/').pop() ?? 'document',
    };
  }

  // --- Helpers ----------------------------------------------------------------

  private withStatus<T extends { expiryDate: Date | null }>(document: T) {
    return { ...document, expiryStatus: computeDocumentStatus(document.expiryDate) };
  }

  private expiryFilter(query: DocumentsQueryDto): Prisma.DocumentWhereInput {
    if (query.expired) {
      return { expiryDate: { not: null, lt: new Date() } };
    }
    if (query.expiringWithinDays !== undefined) {
      const horizon = new Date();
      horizon.setDate(horizon.getDate() + query.expiringWithinDays);
      return { expiryDate: { not: null, lte: horizon } };
    }
    return {};
  }

  private resolveRelation(dto: CreateDocumentDto): { field: RelationField; id: string } | null {
    const field = RELATION_FIELD[dto.relatedEntityType];
    const allFields: RelationField[] = ['employeeId', 'vehicleId', 'equipmentId', 'contractId', 'clientId'];

    if (field === null) {
      // COMPANY: no id should be supplied.
      const stray = allFields.find((f) => dto[f]);
      if (stray) {
        throw new BadRequestException('COMPANY documents must not reference a specific entity');
      }
      return null;
    }

    const id = dto[field];
    if (!id) {
      throw new BadRequestException(`${field} is required when relatedEntityType is ${dto.relatedEntityType}`);
    }
    const stray = allFields.filter((f) => f !== field).find((f) => dto[f]);
    if (stray) {
      throw new BadRequestException(`Only ${field} may be supplied for ${dto.relatedEntityType} documents`);
    }
    return { field, id };
  }

  private async assertRelatedEntityExists(
    type: RelatedEntityType,
    relation: { field: RelationField; id: string } | null,
  ) {
    if (!relation) return;

    const exists = await this.lookupEntity(type, relation.id);
    if (!exists) {
      throw new BadRequestException(`Invalid ${relation.field}`);
    }
  }

  private async lookupEntity(type: RelatedEntityType, id: string): Promise<boolean> {
    switch (type) {
      case RelatedEntityType.EMPLOYEE:
        return !!(await this.prisma.employee.findUnique({ where: { id }, select: { id: true } }));
      case RelatedEntityType.VEHICLE:
        return !!(await this.prisma.vehicle.findUnique({ where: { id }, select: { id: true } }));
      case RelatedEntityType.EQUIPMENT:
        return !!(await this.prisma.equipment.findUnique({ where: { id }, select: { id: true } }));
      case RelatedEntityType.CONTRACT:
        return !!(await this.prisma.contract.findUnique({ where: { id }, select: { id: true } }));
      case RelatedEntityType.CLIENT:
        return !!(await this.prisma.client.findUnique({ where: { id }, select: { id: true } }));
      case RelatedEntityType.COMPANY:
        return true;
    }
  }

  private validateDates(issueDate?: string, expiryDate?: string) {
    if (issueDate && expiryDate && new Date(expiryDate) < new Date(issueDate)) {
      throw new BadRequestException('expiryDate cannot be before issueDate');
    }
  }

  private validateFile(file: UploadedFileLike) {
    if (file.size > MAX_FILE_BYTES) {
      throw new BadRequestException('File exceeds the 10 MB limit');
    }
    const allowed =
      ALLOWED_MIME_TYPES.includes(file.mimetype) ||
      ALLOWED_MIME_PREFIXES.some((prefix) => file.mimetype.startsWith(prefix));
    if (!allowed) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }
  }
}
