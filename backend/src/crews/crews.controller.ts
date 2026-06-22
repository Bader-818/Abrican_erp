import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuditEntity } from '../common/decorators/audit-entity.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CrewsService } from './crews.service';
import { AddCrewMemberDto, UpdateCrewMemberDto } from './dto/crew-member.dto';
import { CreateCrewDto } from './dto/create-crew.dto';
import { CrewsQueryDto } from './dto/crews-query.dto';
import { UpdateCrewDto } from './dto/update-crew.dto';

@Controller('crews')
export class CrewsController {
  constructor(private readonly crewsService: CrewsService) {}

  @Get()
  @RequirePermissions('crews.view')
  findAll(@Query() query: CrewsQueryDto) {
    return this.crewsService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('crews.view')
  findOne(@Param('id') id: string) {
    return this.crewsService.findOne(id);
  }

  @Post()
  @RequirePermissions('crews.manage')
  @AuditEntity({ entityType: 'Crew', prismaModel: 'crew' })
  create(@Body() dto: CreateCrewDto) {
    return this.crewsService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('crews.manage')
  @AuditEntity({ entityType: 'Crew', prismaModel: 'crew' })
  update(@Param('id') id: string, @Body() dto: UpdateCrewDto) {
    return this.crewsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('crews.manage')
  @AuditEntity({ entityType: 'Crew', prismaModel: 'crew' })
  remove(@Param('id') id: string) {
    return this.crewsService.remove(id);
  }

  // --- Members ----------------------------------------------------------------

  @Post(':id/members')
  @RequirePermissions('crews.manage')
  @AuditEntity({ entityType: 'CrewMember', prismaModel: 'crewMember' })
  addMember(@Param('id') crewId: string, @Body() dto: AddCrewMemberDto) {
    return this.crewsService.addMember(crewId, dto);
  }

  @Patch(':id/members/:memberId')
  @RequirePermissions('crews.manage')
  @AuditEntity({ entityType: 'CrewMember', prismaModel: 'crewMember', idParam: 'memberId' })
  updateMember(
    @Param('id') crewId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateCrewMemberDto,
  ) {
    return this.crewsService.updateMember(crewId, memberId, dto);
  }

  @Delete(':id/members/:memberId')
  @RequirePermissions('crews.manage')
  @AuditEntity({ entityType: 'CrewMember', prismaModel: 'crewMember', idParam: 'memberId' })
  removeMember(@Param('id') crewId: string, @Param('memberId') memberId: string) {
    return this.crewsService.removeMember(crewId, memberId);
  }
}
