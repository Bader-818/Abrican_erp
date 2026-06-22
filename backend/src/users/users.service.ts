import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuditLogService } from '../audit-log/audit-log.service';
import { paginate } from '../common/helpers/pagination.helper';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersQueryDto } from './dto/users-query.dto';

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  status: true,
  mfaEnabled: true,
  mustChangePassword: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { id: true, name: true } },
} satisfies Prisma.UserSelect;

const SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findAll(query: UsersQueryDto) {
    const where: Prisma.UserWhereInput = {
      ...(query.roleId ? { roleId: query.roleId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return paginate(this.prisma.user, query, {
      where,
      orderBy: { createdAt: 'desc' },
      select: USER_SELECT,
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
    if (!role) {
      throw new BadRequestException('Invalid roleId');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        roleId: dto.roleId,
        status: dto.status,
      },
      select: USER_SELECT,
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.email && dto.email !== user.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (existing) {
        throw new ConflictException('Email already in use');
      }
    }

    if (dto.roleId) {
      const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
      if (!role) {
        throw new BadRequestException('Invalid roleId');
      }
    }

    const data: Prisma.UserUpdateInput = {
      name: dto.name,
      email: dto.email,
      status: dto.status,
      ...(dto.roleId ? { role: { connect: { id: dto.roleId } } } : {}),
      ...(dto.password ? { passwordHash: await bcrypt.hash(dto.password, SALT_ROUNDS) } : {}),
    };

    return this.prisma.user.update({ where: { id }, data, select: USER_SELECT });
  }

  async remove(id: string, currentUserId: string) {
    if (id === currentUserId) {
      throw new BadRequestException('Cannot delete your own account');
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.delete({ where: { id } });
    return { success: true };
  }

  // --- Admin security controls ---------------------------------------------

  /** Set a temporary password and force the user to change it on next login. */
  async adminResetPassword(id: string, newPassword: string, actorId: string, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found');

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { passwordHash, mustChangePassword: true, passwordChangedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: id, revoked: false },
        data: { revoked: true },
      }),
    ]);

    await this.auditLogService.record({
      userId: actorId,
      action: AuditAction.PASSWORD_CHANGED,
      entityType: 'User',
      entityId: id,
      ipAddress,
      comment: 'Admin reset password; user must change it on next login; sessions revoked.',
    });
    return { success: true };
  }

  /** Disable a user's MFA (recovery path when they lose their authenticator). */
  async disableMfa(id: string, actorId: string, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { mfaEnabled: true } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.mfaEnabled) throw new BadRequestException('MFA is not enabled for this user');

    await this.prisma.user.update({
      where: { id },
      data: { mfaEnabled: false, mfaSecret: null },
    });
    await this.auditLogService.record({
      userId: actorId,
      action: AuditAction.MFA_DISABLED,
      entityType: 'User',
      entityId: id,
      ipAddress,
      comment: 'Admin disabled MFA.',
    });
    return { success: true };
  }

  /** Revoke all of a user's sessions (offboarding / force sign-out). */
  async forceLogout(id: string, actorId: string, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found');

    const result = await this.prisma.refreshToken.updateMany({
      where: { userId: id, revoked: false },
      data: { revoked: true },
    });
    await this.auditLogService.record({
      userId: actorId,
      action: AuditAction.SESSION_REVOKED,
      entityType: 'User',
      entityId: id,
      ipAddress,
      comment: `Admin force-logout (${result.count} session(s) revoked).`,
    });
    return { success: true, revoked: result.count };
  }
}
