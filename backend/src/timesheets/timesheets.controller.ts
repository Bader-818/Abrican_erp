import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { CreateTimesheetDto } from './dto/create-timesheet.dto';
import { RejectDto } from './dto/reject.dto';
import { TimesheetsQueryDto } from './dto/timesheets-query.dto';
import { UpdateTimesheetDto } from './dto/update-timesheet.dto';
import { TimesheetsService } from './timesheets.service';

@Controller('timesheets')
export class TimesheetsController {
  constructor(private readonly service: TimesheetsService) {}

  @Get()
  @RequirePermissions('timesheets.view')
  findAll(@Query() query: TimesheetsQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('timesheets.view')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('timesheets.manage')
  create(@Body() dto: CreateTimesheetDto, @CurrentUser() user: AuthenticatedUser, @Ip() ip: string) {
    return this.service.create(dto, user, ip);
  }

  @Patch(':id')
  @RequirePermissions('timesheets.manage')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTimesheetDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.service.update(id, dto, user, ip);
  }

  @Delete(':id')
  @RequirePermissions('timesheets.manage')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Ip() ip: string) {
    return this.service.remove(id, user, ip);
  }

  @Post(':id/submit')
  @RequirePermissions('timesheets.manage')
  submit(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Ip() ip: string) {
    return this.service.submit(id, user, ip);
  }

  @Post(':id/approve')
  @RequirePermissions('timesheets.approve')
  approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Ip() ip: string) {
    return this.service.approve(id, user, ip);
  }

  @Post(':id/reject')
  @RequirePermissions('timesheets.approve')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.service.reject(id, dto.reason, user, ip);
  }
}
