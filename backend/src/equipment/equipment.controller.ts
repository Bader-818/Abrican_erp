import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuditEntity } from '../common/decorators/audit-entity.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { EquipmentQueryDto } from './dto/equipment-query.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { EquipmentService } from './equipment.service';

@Controller('equipment')
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) {}

  @Get()
  @RequirePermissions('equipment.view')
  findAll(@Query() query: EquipmentQueryDto) {
    return this.equipmentService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('equipment.view')
  findOne(@Param('id') id: string) {
    return this.equipmentService.findOne(id);
  }

  @Post()
  @RequirePermissions('equipment.manage')
  @AuditEntity({ entityType: 'Equipment', prismaModel: 'equipment' })
  create(@Body() dto: CreateEquipmentDto) {
    return this.equipmentService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('equipment.manage')
  @AuditEntity({ entityType: 'Equipment', prismaModel: 'equipment' })
  update(@Param('id') id: string, @Body() dto: UpdateEquipmentDto) {
    return this.equipmentService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('equipment.manage')
  @AuditEntity({ entityType: 'Equipment', prismaModel: 'equipment' })
  remove(@Param('id') id: string) {
    return this.equipmentService.remove(id);
  }
}
