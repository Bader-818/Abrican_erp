import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuditEntity } from '../common/decorators/audit-entity.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { ClientsService } from './clients.service';
import { CreateClientContactDto, UpdateClientContactDto } from './dto/client-contact.dto';
import { ClientsQueryDto } from './dto/clients-query.dto';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @RequirePermissions('clients.view')
  findAll(@Query() query: ClientsQueryDto) {
    return this.clientsService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('clients.view')
  findOne(@Param('id') id: string) {
    return this.clientsService.findOne(id);
  }

  @Post()
  @RequirePermissions('clients.manage')
  @AuditEntity({ entityType: 'Client', prismaModel: 'client' })
  create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('clients.manage')
  @AuditEntity({ entityType: 'Client', prismaModel: 'client' })
  update(@Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('clients.manage')
  @AuditEntity({ entityType: 'Client', prismaModel: 'client' })
  remove(@Param('id') id: string) {
    return this.clientsService.remove(id);
  }

  // --- Contacts -------------------------------------------------------------

  @Post(':id/contacts')
  @RequirePermissions('clients.manage')
  @AuditEntity({ entityType: 'ClientContact', prismaModel: 'clientContact' })
  addContact(@Param('id') clientId: string, @Body() dto: CreateClientContactDto) {
    return this.clientsService.addContact(clientId, dto);
  }

  @Patch(':id/contacts/:contactId')
  @RequirePermissions('clients.manage')
  @AuditEntity({ entityType: 'ClientContact', prismaModel: 'clientContact', idParam: 'contactId' })
  updateContact(
    @Param('id') clientId: string,
    @Param('contactId') contactId: string,
    @Body() dto: UpdateClientContactDto,
  ) {
    return this.clientsService.updateContact(clientId, contactId, dto);
  }

  @Delete(':id/contacts/:contactId')
  @RequirePermissions('clients.manage')
  @AuditEntity({ entityType: 'ClientContact', prismaModel: 'clientContact', idParam: 'contactId' })
  removeContact(@Param('id') clientId: string, @Param('contactId') contactId: string) {
    return this.clientsService.removeContact(clientId, contactId);
  }
}
