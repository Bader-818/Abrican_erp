import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginate } from '../common/helpers/pagination.helper';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { VehiclesQueryDto } from './dto/vehicles-query.dto';

const VEHICLE_SELECT = {
  id: true,
  plateNumber: true,
  vehicleType: true,
  make: true,
  model: true,
  year: true,
  ownershipType: true,
  status: true,
  odometer: true,
  fuelType: true,
  registrationExpiry: true,
  insuranceExpiry: true,
  inspectionExpiry: true,
  costRate: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { assignments: true } },
} satisfies Prisma.VehicleSelect;

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: VehiclesQueryDto) {
    const where: Prisma.VehicleWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.ownershipType ? { ownershipType: query.ownershipType } : {}),
      ...(query.search
        ? {
            OR: [
              { plateNumber: { contains: query.search, mode: 'insensitive' } },
              { vehicleType: { contains: query.search, mode: 'insensitive' } },
              { make: { contains: query.search, mode: 'insensitive' } },
              { model: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return paginate(this.prisma.vehicle, query, {
      where,
      orderBy: { plateNumber: 'asc' },
      select: VEHICLE_SELECT,
    });
  }

  async findOne(id: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id }, select: VEHICLE_SELECT });
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }
    return vehicle;
  }

  async create(dto: CreateVehicleDto) {
    await this.ensurePlateAvailable(dto.plateNumber);
    return this.prisma.vehicle.create({
      data: this.toPersistence(dto),
      select: VEHICLE_SELECT,
    });
  }

  async update(id: string, dto: UpdateVehicleDto) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }
    if (dto.plateNumber && dto.plateNumber !== vehicle.plateNumber) {
      await this.ensurePlateAvailable(dto.plateNumber);
    }
    return this.prisma.vehicle.update({
      where: { id },
      data: this.toPersistence(dto),
      select: VEHICLE_SELECT,
    });
  }

  async remove(id: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
      select: { _count: { select: { assignments: true } } },
    });
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    if (vehicle._count.assignments > 0) {
      throw new ConflictException(
        'Cannot delete a vehicle with assignments. Set it to OUT_OF_SERVICE instead.',
      );
    }

    await this.prisma.vehicle.delete({ where: { id } });
    return { success: true };
  }

  private toPersistence<T extends UpdateVehicleDto>(dto: T) {
    const { registrationExpiry, insuranceExpiry, inspectionExpiry, ...rest } = dto;
    return {
      ...rest,
      ...(registrationExpiry !== undefined
        ? { registrationExpiry: registrationExpiry ? new Date(registrationExpiry) : null }
        : {}),
      ...(insuranceExpiry !== undefined
        ? { insuranceExpiry: insuranceExpiry ? new Date(insuranceExpiry) : null }
        : {}),
      ...(inspectionExpiry !== undefined
        ? { inspectionExpiry: inspectionExpiry ? new Date(inspectionExpiry) : null }
        : {}),
    };
  }

  private async ensurePlateAvailable(plateNumber: string) {
    const existing = await this.prisma.vehicle.findUnique({ where: { plateNumber } });
    if (existing) {
      throw new ConflictException('Plate number already registered');
    }
  }
}
