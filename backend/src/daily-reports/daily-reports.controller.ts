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
import { DailyReportsService } from './daily-reports.service';
import { CreateDailyReportDto } from './dto/create-daily-report.dto';
import { DailyReportsQueryDto } from './dto/daily-reports-query.dto';
import { RejectDto } from './dto/reject.dto';
import { UpdateDailyReportDto } from './dto/update-daily-report.dto';

@Controller('daily-reports')
export class DailyReportsController {
  constructor(private readonly service: DailyReportsService) {}

  @Get()
  @RequirePermissions('daily_reports.view')
  findAll(@Query() query: DailyReportsQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('daily_reports.view')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('daily_reports.manage')
  create(@Body() dto: CreateDailyReportDto, @CurrentUser() user: AuthenticatedUser, @Ip() ip: string) {
    return this.service.create(dto, user, ip);
  }

  @Patch(':id')
  @RequirePermissions('daily_reports.manage')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDailyReportDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.service.update(id, dto, user, ip);
  }

  @Delete(':id')
  @RequirePermissions('daily_reports.manage')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Ip() ip: string) {
    return this.service.remove(id, user, ip);
  }

  @Post(':id/submit')
  @RequirePermissions('daily_reports.manage')
  submit(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Ip() ip: string) {
    return this.service.submit(id, user, ip);
  }

  @Post(':id/approve')
  @RequirePermissions('daily_reports.approve')
  approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Ip() ip: string) {
    return this.service.approve(id, user, ip);
  }

  @Post(':id/reject')
  @RequirePermissions('daily_reports.approve')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.service.reject(id, dto.reason, user, ip);
  }
}
