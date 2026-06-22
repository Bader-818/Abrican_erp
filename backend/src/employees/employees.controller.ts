import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuditEntity } from '../common/decorators/audit-entity.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { EmployeesQueryDto } from './dto/employees-query.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesService } from './employees.service';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @RequirePermissions('employees.view')
  findAll(@Query() query: EmployeesQueryDto) {
    return this.employeesService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('employees.view')
  findOne(@Param('id') id: string) {
    return this.employeesService.findOne(id);
  }

  @Post()
  @RequirePermissions('employees.manage')
  @AuditEntity({ entityType: 'Employee', prismaModel: 'employee' })
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('employees.manage')
  @AuditEntity({ entityType: 'Employee', prismaModel: 'employee' })
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employeesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('employees.manage')
  @AuditEntity({ entityType: 'Employee', prismaModel: 'employee' })
  remove(@Param('id') id: string) {
    return this.employeesService.remove(id);
  }
}
