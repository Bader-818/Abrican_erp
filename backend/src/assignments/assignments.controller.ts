import { Body, Controller, Delete, Get, Ip, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { AssignmentsService } from './assignments.service';
import { AssignmentsQueryDto } from './dto/assignments-query.dto';
import { CheckConflictsDto } from './dto/check-conflicts.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { CreateAssignmentsBulkDto } from './dto/create-assignments-bulk.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { UtilizationQueryDto } from './dto/utilization-query.dto';

@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Get()
  @RequirePermissions('assignments.view')
  findAll(@Query() query: AssignmentsQueryDto) {
    return this.assignmentsService.findAll(query);
  }

  @Get('utilization')
  @RequirePermissions('assignments.view')
  utilization(@Query() query: UtilizationQueryDto) {
    return this.assignmentsService.utilization(query);
  }

  @Post('check-conflicts')
  @RequirePermissions('assignments.view')
  checkConflicts(@Body() dto: CheckConflictsDto) {
    return this.assignmentsService.checkConflicts(dto);
  }

  @Get(':id')
  @RequirePermissions('assignments.view')
  findOne(@Param('id') id: string) {
    return this.assignmentsService.findOne(id);
  }

  // Audit (CREATE / OVERRIDE) handled inside the service for the override path.
  @Post()
  @RequirePermissions('assignments.manage')
  create(
    @Body() dto: CreateAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.assignmentsService.create(dto, user, ipAddress);
  }

  // Assign multiple resources to one job at once (shared time window).
  @Post('bulk')
  @RequirePermissions('assignments.manage')
  createMany(
    @Body() dto: CreateAssignmentsBulkDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.assignmentsService.createMany(dto, user, ipAddress);
  }

  @Patch(':id')
  @RequirePermissions('assignments.manage')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.assignmentsService.update(id, dto, user, ipAddress);
  }

  @Delete(':id')
  @RequirePermissions('assignments.manage')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.assignmentsService.remove(id, user, ipAddress);
  }
}
