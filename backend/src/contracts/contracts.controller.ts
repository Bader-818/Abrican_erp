import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuditEntity } from '../common/decorators/audit-entity.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { ContractsService } from './contracts.service';
import { ContractsQueryDto } from './dto/contracts-query.dto';
import { CreateContractDto } from './dto/create-contract.dto';
import { CreateRateCardDto, UpdateRateCardDto } from './dto/rate-card.dto';
import { UpdateContractDto } from './dto/update-contract.dto';

@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get()
  @RequirePermissions('contracts.view')
  findAll(@Query() query: ContractsQueryDto) {
    return this.contractsService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('contracts.view')
  findOne(@Param('id') id: string) {
    return this.contractsService.findOne(id);
  }

  @Post()
  @RequirePermissions('contracts.manage')
  @AuditEntity({ entityType: 'Contract', prismaModel: 'contract' })
  create(@Body() dto: CreateContractDto) {
    return this.contractsService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('contracts.manage')
  @AuditEntity({ entityType: 'Contract', prismaModel: 'contract' })
  update(@Param('id') id: string, @Body() dto: UpdateContractDto) {
    return this.contractsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('contracts.manage')
  @AuditEntity({ entityType: 'Contract', prismaModel: 'contract' })
  remove(@Param('id') id: string) {
    return this.contractsService.remove(id);
  }

  // --- Rate cards -----------------------------------------------------------

  @Post(':id/rate-cards')
  @RequirePermissions('contracts.manage')
  @AuditEntity({ entityType: 'ContractRateCard', prismaModel: 'contractRateCard' })
  addRateCard(@Param('id') contractId: string, @Body() dto: CreateRateCardDto) {
    return this.contractsService.addRateCard(contractId, dto);
  }

  @Patch(':id/rate-cards/:rateCardId')
  @RequirePermissions('contracts.manage')
  @AuditEntity({
    entityType: 'ContractRateCard',
    prismaModel: 'contractRateCard',
    idParam: 'rateCardId',
  })
  updateRateCard(
    @Param('id') contractId: string,
    @Param('rateCardId') rateCardId: string,
    @Body() dto: UpdateRateCardDto,
  ) {
    return this.contractsService.updateRateCard(contractId, rateCardId, dto);
  }

  @Delete(':id/rate-cards/:rateCardId')
  @RequirePermissions('contracts.manage')
  @AuditEntity({
    entityType: 'ContractRateCard',
    prismaModel: 'contractRateCard',
    idParam: 'rateCardId',
  })
  removeRateCard(@Param('id') contractId: string, @Param('rateCardId') rateCardId: string) {
    return this.contractsService.removeRateCard(contractId, rateCardId);
  }
}
