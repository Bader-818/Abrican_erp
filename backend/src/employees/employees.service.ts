import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginate } from '../common/helpers/pagination.helper';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { EmployeesQueryDto } from './dto/employees-query.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

const EMPLOYEE_SELECT = {
  id: true,
  name: true,
  role: true,
  department: true,
  costRate: true,
  availabilityStatus: true,
  phone: true,
  email: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  crewMemberships: {
    where: { status: 'ACTIVE' },
    select: { crew: { select: { id: true, name: true } } },
  },
  _count: { select: { assignments: true, crewsSupervised: true } },
} satisfies Prisma.EmployeeSelect;

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: EmployeesQueryDto) {
    const where: Prisma.EmployeeWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.availabilityStatus ? { availabilityStatus: query.availabilityStatus } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { role: { contains: query.search, mode: 'insensitive' } },
              { department: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return paginate(this.prisma.employee, query, {
      where,
      orderBy: { name: 'asc' },
      select: EMPLOYEE_SELECT,
    });
  }

  async findOne(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      select: EMPLOYEE_SELECT,
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    return employee;
  }

  async create(dto: CreateEmployeeDto) {
    return this.prisma.employee.create({ data: dto, select: EMPLOYEE_SELECT });
  }

  async update(id: string, dto: UpdateEmployeeDto) {
    await this.ensureExists(id);
    return this.prisma.employee.update({ where: { id }, data: dto, select: EMPLOYEE_SELECT });
  }

  async remove(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      select: {
        _count: { select: { assignments: true, crewMemberships: true, crewsSupervised: true } },
      },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const { assignments, crewMemberships, crewsSupervised } = employee._count;
    if (assignments > 0 || crewMemberships > 0 || crewsSupervised > 0) {
      throw new ConflictException(
        'Cannot delete an employee with assignments or crew links. Set them to INACTIVE instead.',
      );
    }

    await this.prisma.employee.delete({ where: { id } });
    return { success: true };
  }

  private async ensureExists(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
  }
}
