import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuditLogService } from './audit-log.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @RequirePermissions('audit_logs.view')
  findAll(@Query() query: AuditLogQueryDto) {
    return this.auditLogService.findAll(query);
  }
}
