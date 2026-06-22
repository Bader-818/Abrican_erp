import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuditEntity } from '../common/decorators/audit-entity.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { VehiclesQueryDto } from './dto/vehicles-query.dto';
import { VehiclesService } from './vehicles.service';

@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  @RequirePermissions('vehicles.view')
  findAll(@Query() query: VehiclesQueryDto) {
    return this.vehiclesService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('vehicles.view')
  findOne(@Param('id') id: string) {
    return this.vehiclesService.findOne(id);
  }

  @Post()
  @RequirePermissions('vehicles.manage')
  @AuditEntity({ entityType: 'Vehicle', prismaModel: 'vehicle' })
  create(@Body() dto: CreateVehicleDto) {
    return this.vehiclesService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('vehicles.manage')
  @AuditEntity({ entityType: 'Vehicle', prismaModel: 'vehicle' })
  update(@Param('id') id: string, @Body() dto: UpdateVehicleDto) {
    return this.vehiclesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('vehicles.manage')
  @AuditEntity({ entityType: 'Vehicle', prismaModel: 'vehicle' })
  remove(@Param('id') id: string) {
    return this.vehiclesService.remove(id);
  }
}
