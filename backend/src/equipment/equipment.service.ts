import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginate } from '../common/helpers/pagination.helper';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { EquipmentQueryDto } from './dto/equipment-query.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';

const EQUIPMENT_SELECT = {
  id: true,
  name: true,
  equipmentType: true,
  serialNumber: true,
  status: true,
  ownershipType: true,
  costRate: true,
  currentLocation: true,
  calibrationExpiry: true,
  maintenanceDueDate: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { assignments: true } },
} satisfies Prisma.EquipmentSelect;

@Injectable()
export class EquipmentService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: EquipmentQueryDto) {
    const where: Prisma.EquipmentWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.ownershipType ? { ownershipType: query.ownershipType } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { equipmentType: { contains: query.search, mode: 'insensitive' } },
              { serialNumber: { contains: query.search, mode: 'insensitive' } },
              { currentLocation: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return paginate(this.prisma.equipment, query, {
      where,
      orderBy: { name: 'asc' },
      select: EQUIPMENT_SELECT,
    });
  }

  async findOne(id: string) {
    const equipment = await this.prisma.equipment.findUnique({
      where: { id },
      select: EQUIPMENT_SELECT,
    });
    if (!equipment) {
      throw new NotFoundException('Equipment not found');
    }
    return equipment;
  }

  async create(dto: CreateEquipmentDto) {
    return this.prisma.equipment.create({
      data: this.toPersistence(dto),
      select: EQUIPMENT_SELECT,
    });
  }

  async update(id: string, dto: UpdateEquipmentDto) {
    await this.ensureExists(id);
    return this.prisma.equipment.update({
      where: { id },
      data: this.toPersistence(dto),
      select: EQUIPMENT_SELECT,
    });
  }

  async remove(id: string) {
    const equipment = await this.prisma.equipment.findUnique({
      where: { id },
      select: { _count: { select: { assignments: true } } },
    });
    if (!equipment) {
      throw new NotFoundException('Equipment not found');
    }

    if (equipment._count.assignments > 0) {
      throw new ConflictException(
        'Cannot delete equipment with assignments. Set it to OUT_OF_SERVICE instead.',
      );
    }

    await this.prisma.equipment.delete({ where: { id } });
    return { success: true };
  }

  private toPersistence<T extends UpdateEquipmentDto>(dto: T) {
    const { calibrationExpiry, maintenanceDueDate, ...rest } = dto;
    return {
      ...rest,
      ...(calibrationExpiry !== undefined
        ? { calibrationExpiry: calibrationExpiry ? new Date(calibrationExpiry) : null }
        : {}),
      ...(maintenanceDueDate !== undefined
        ? { maintenanceDueDate: maintenanceDueDate ? new Date(maintenanceDueDate) : null }
        : {}),
    };
  }

  private async ensureExists(id: string) {
    const equipment = await this.prisma.equipment.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!equipment) {
      throw new NotFoundException('Equipment not found');
    }
  }
}
