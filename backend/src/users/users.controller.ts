import { Body, Controller, Delete, Get, HttpCode, Ip, Param, Patch, Post, Query } from '@nestjs/common';
import { AuditEntity } from '../common/decorators/audit-entity.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersQueryDto } from './dto/users-query.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions('users.view')
  findAll(@Query() query: UsersQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('users.view')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @RequirePermissions('users.manage')
  @AuditEntity({ entityType: 'User', prismaModel: 'user' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('users.manage')
  @AuditEntity({ entityType: 'User', prismaModel: 'user' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('users.manage')
  @AuditEntity({ entityType: 'User', prismaModel: 'user' })
  remove(@Param('id') id: string, @CurrentUser('id') currentUserId: string) {
    return this.usersService.remove(id, currentUserId);
  }

  @Post(':id/reset-password')
  @RequirePermissions('users.manage')
  @HttpCode(200)
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser('id') actorId: string,
    @Ip() ip: string,
  ) {
    return this.usersService.adminResetPassword(id, dto.newPassword, actorId, ip);
  }

  @Post(':id/disable-mfa')
  @RequirePermissions('users.manage')
  @HttpCode(200)
  disableMfa(@Param('id') id: string, @CurrentUser('id') actorId: string, @Ip() ip: string) {
    return this.usersService.disableMfa(id, actorId, ip);
  }

  @Post(':id/logout-all')
  @RequirePermissions('users.manage')
  @HttpCode(200)
  forceLogout(@Param('id') id: string, @CurrentUser('id') actorId: string, @Ip() ip: string) {
    return this.usersService.forceLogout(id, actorId, ip);
  }
}
