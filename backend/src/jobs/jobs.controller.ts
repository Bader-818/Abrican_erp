import { Body, Controller, Delete, Get, Ip, Param, Patch, Post, Query } from '@nestjs/common';
import { AuditEntity } from '../common/decorators/audit-entity.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { ChangeJobStatusDto } from './dto/change-job-status.dto';
import { CreateJobDto } from './dto/create-job.dto';
import { JobsQueryDto } from './dto/jobs-query.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { JobStatusService } from './job-status.service';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly jobStatusService: JobStatusService,
  ) {}

  @Get()
  @RequirePermissions('jobs.view')
  findAll(@Query() query: JobsQueryDto) {
    return this.jobsService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('jobs.view')
  findOne(@Param('id') id: string) {
    return this.jobsService.findOne(id);
  }

  @Post()
  @RequirePermissions('jobs.manage')
  @AuditEntity({ entityType: 'Job', prismaModel: 'job' })
  create(@Body() dto: CreateJobDto) {
    return this.jobsService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('jobs.manage')
  @AuditEntity({ entityType: 'Job', prismaModel: 'job' })
  update(@Param('id') id: string, @Body() dto: UpdateJobDto) {
    return this.jobsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('jobs.manage')
  @AuditEntity({ entityType: 'Job', prismaModel: 'job' })
  remove(@Param('id') id: string) {
    return this.jobsService.remove(id);
  }

  // Audit handled inside JobStatusService (STATUS_CHANGE / OVERRIDE with comment)
  @Post(':id/status')
  @RequirePermissions('jobs.status_change')
  changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeJobStatusDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.jobStatusService.changeStatus(id, dto, user, ipAddress);
  }
}
