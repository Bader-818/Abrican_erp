import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

const ROLE_INCLUDE = {
  permissions: { include: { permission: true } },
  _count: { select: { users: true } },
} satisfies Prisma.RoleInclude;

type RoleWithRelations = Prisma.RoleGetPayload<{ include: typeof ROLE_INCLUDE }>;

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const roles = await this.prisma.role.findMany({
      include: ROLE_INCLUDE,
      orderBy: { name: 'asc' },
    });
    return roles.map((role) => this.mapRole(role));
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id }, include: ROLE_INCLUDE });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return this.mapRole(role);
  }

  async listPermissions() {
    return this.prisma.permission.findMany({ orderBy: { key: 'asc' } });
  }

  async create(dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({ where: { name: dto.name } });
    if (existing) {
      throw new ConflictException('A role with this name already exists');
    }

    const permissions = await this.resolvePermissions(dto.permissionKeys);

    const role = await this.prisma.role.create({
      data: {
        name: dto.name,
        description: dto.description,
        permissions: { create: permissions.map((p) => ({ permissionId: p.id })) },
      },
      include: ROLE_INCLUDE,
    });

    return this.mapRole(role);
  }

  async update(id: string, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (dto.name && dto.name !== role.name) {
      const existing = await this.prisma.role.findUnique({ where: { name: dto.name } });
      if (existing) {
        throw new ConflictException('A role with this name already exists');
      }
    }

    if (dto.permissionKeys) {
      const permissions = await this.resolvePermissions(dto.permissionKeys);
      await this.prisma.$transaction([
        this.prisma.rolePermission.deleteMany({ where: { roleId: id } }),
        this.prisma.rolePermission.createMany({
          data: permissions.map((p) => ({ roleId: id, permissionId: p.id })),
        }),
      ]);
    }

    const updated = await this.prisma.role.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
      },
      include: ROLE_INCLUDE,
    });

    return this.mapRole(updated);
  }

  async remove(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    if (role._count.users > 0) {
      throw new ConflictException('Cannot delete a role that is assigned to users');
    }

    await this.prisma.role.delete({ where: { id } });
    return { success: true };
  }

  private async resolvePermissions(keys: string[]) {
    if (keys.length === 0) {
      return [];
    }
    const permissions = await this.prisma.permission.findMany({ where: { key: { in: keys } } });
    if (permissions.length !== new Set(keys).size) {
      const found = new Set(permissions.map((p) => p.key));
      const missing = keys.filter((k) => !found.has(k));
      throw new BadRequestException(`Unknown permission key(s): ${missing.join(', ')}`);
    }
    return permissions;
  }

  private mapRole(role: RoleWithRelations) {
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      userCount: role._count.users,
      permissions: role.permissions.map((rp) => rp.permission.key),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }
}
