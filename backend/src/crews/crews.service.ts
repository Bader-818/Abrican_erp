import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginate } from '../common/helpers/pagination.helper';
import { PrismaService } from '../prisma/prisma.service';
import { AddCrewMemberDto, UpdateCrewMemberDto } from './dto/crew-member.dto';
import { CreateCrewDto } from './dto/create-crew.dto';
import { CrewsQueryDto } from './dto/crews-query.dto';
import { UpdateCrewDto } from './dto/update-crew.dto';

const CREW_LIST_SELECT = {
  id: true,
  name: true,
  serviceCapability: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  supervisor: { select: { id: true, name: true } },
  _count: { select: { members: true, assignments: true } },
} satisfies Prisma.CrewSelect;

const CREW_DETAIL_SELECT = {
  ...CREW_LIST_SELECT,
  members: {
    select: {
      id: true,
      startDate: true,
      endDate: true,
      status: true,
      employee: { select: { id: true, name: true, role: true, availabilityStatus: true } },
    },
    orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
  },
} satisfies Prisma.CrewSelect;

@Injectable()
export class CrewsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: CrewsQueryDto) {
    const where: Prisma.CrewWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { serviceCapability: { contains: query.search, mode: 'insensitive' } },
              { supervisor: { name: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    return paginate(this.prisma.crew, query, {
      where,
      orderBy: { name: 'asc' },
      select: CREW_LIST_SELECT,
    });
  }

  async findOne(id: string) {
    const crew = await this.prisma.crew.findUnique({ where: { id }, select: CREW_DETAIL_SELECT });
    if (!crew) {
      throw new NotFoundException('Crew not found');
    }
    return crew;
  }

  async create(dto: CreateCrewDto) {
    await this.validateSupervisor(dto.supervisorId);
    return this.prisma.crew.create({ data: dto, select: CREW_DETAIL_SELECT });
  }

  async update(id: string, dto: UpdateCrewDto) {
    await this.ensureExists(id);
    if (dto.supervisorId) {
      await this.validateSupervisor(dto.supervisorId);
    }
    return this.prisma.crew.update({ where: { id }, data: dto, select: CREW_DETAIL_SELECT });
  }

  async remove(id: string) {
    const crew = await this.prisma.crew.findUnique({
      where: { id },
      select: { _count: { select: { assignments: true } } },
    });
    if (!crew) {
      throw new NotFoundException('Crew not found');
    }

    if (crew._count.assignments > 0) {
      throw new ConflictException(
        'Cannot delete a crew with assignments. Set it to INACTIVE instead.',
      );
    }

    await this.prisma.crew.delete({ where: { id } });
    return { success: true };
  }

  // --- Members ----------------------------------------------------------------

  async addMember(crewId: string, dto: AddCrewMemberDto) {
    await this.ensureExists(crewId);

    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
      select: { id: true },
    });
    if (!employee) {
      throw new BadRequestException('Invalid employeeId');
    }

    const existing = await this.prisma.crewMember.findFirst({
      where: { crewId, employeeId: dto.employeeId, status: 'ACTIVE' },
    });
    if (existing) {
      throw new ConflictException('Employee is already an active member of this crew');
    }

    this.validateMemberDates(dto.startDate, dto.endDate);

    return this.prisma.crewMember.create({
      data: {
        crewId,
        employeeId: dto.employeeId,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
      include: { employee: { select: { id: true, name: true, role: true } } },
    });
  }

  async updateMember(crewId: string, memberId: string, dto: UpdateCrewMemberDto) {
    const member = await this.ensureMemberExists(crewId, memberId);

    const startDate = dto.startDate ?? member.startDate.toISOString();
    const endDate = dto.endDate ?? member.endDate?.toISOString();
    this.validateMemberDates(startDate, endDate);

    return this.prisma.crewMember.update({
      where: { id: memberId },
      data: {
        ...(dto.startDate ? { startDate: new Date(dto.startDate) } : {}),
        ...(dto.endDate !== undefined
          ? { endDate: dto.endDate ? new Date(dto.endDate) : null }
          : {}),
        status: dto.status,
      },
      include: { employee: { select: { id: true, name: true, role: true } } },
    });
  }

  async removeMember(crewId: string, memberId: string) {
    await this.ensureMemberExists(crewId, memberId);
    await this.prisma.crewMember.delete({ where: { id: memberId } });
    return { success: true };
  }

  // --- Helpers ----------------------------------------------------------------

  private validateMemberDates(startDate: string, endDate?: string) {
    if (endDate && new Date(endDate) <= new Date(startDate)) {
      throw new BadRequestException('endDate must be after startDate');
    }
  }

  private async validateSupervisor(supervisorId?: string) {
    if (!supervisorId) {
      return;
    }
    const supervisor = await this.prisma.employee.findUnique({
      where: { id: supervisorId },
      select: { id: true },
    });
    if (!supervisor) {
      throw new BadRequestException('Invalid supervisorId');
    }
  }

  private async ensureExists(id: string) {
    const crew = await this.prisma.crew.findUnique({ where: { id }, select: { id: true } });
    if (!crew) {
      throw new NotFoundException('Crew not found');
    }
  }

  private async ensureMemberExists(crewId: string, memberId: string) {
    const member = await this.prisma.crewMember.findUnique({ where: { id: memberId } });
    if (!member || member.crewId !== crewId) {
      throw new NotFoundException('Crew member not found');
    }
    return member;
  }
}
