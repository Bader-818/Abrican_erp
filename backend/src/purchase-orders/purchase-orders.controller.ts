import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuditEntity } from '../common/decorators/audit-entity.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { PurchaseOrdersQueryDto } from './dto/purchase-orders-query.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { PurchaseOrdersService } from './purchase-orders.service';

@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Get()
  @RequirePermissions('purchase_orders.view')
  findAll(@Query() query: PurchaseOrdersQueryDto) {
    return this.purchaseOrdersService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('purchase_orders.view')
  findOne(@Param('id') id: string) {
    return this.purchaseOrdersService.findOne(id);
  }

  @Post()
  @RequirePermissions('purchase_orders.manage')
  @AuditEntity({ entityType: 'PurchaseOrder', prismaModel: 'purchaseOrder' })
  create(@Body() dto: CreatePurchaseOrderDto) {
    return this.purchaseOrdersService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('purchase_orders.manage')
  @AuditEntity({ entityType: 'PurchaseOrder', prismaModel: 'purchaseOrder' })
  update(@Param('id') id: string, @Body() dto: UpdatePurchaseOrderDto) {
    return this.purchaseOrdersService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('purchase_orders.manage')
  @AuditEntity({ entityType: 'PurchaseOrder', prismaModel: 'purchaseOrder' })
  remove(@Param('id') id: string) {
    return this.purchaseOrdersService.remove(id);
  }
}
