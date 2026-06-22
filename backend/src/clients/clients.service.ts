import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginate } from '../common/helpers/pagination.helper';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientContactDto, UpdateClientContactDto } from './dto/client-contact.dto';
import { ClientsQueryDto } from './dto/clients-query.dto';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

const CLIENT_LIST_SELECT = {
  id: true,
  name: true,
  clientType: true,
  vatNumber: true,
  crNumber: true,
  status: true,
  paymentTermsDays: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { contacts: true, contracts: true, purchaseOrders: true, jobs: true } },
} satisfies Prisma.ClientSelect;

const CLIENT_DETAIL_SELECT = {
  ...CLIENT_LIST_SELECT,
  billingAddress: true,
  notes: true,
  contacts: {
    select: { id: true, name: true, role: true, phone: true, email: true },
    orderBy: { name: 'asc' },
  },
} satisfies Prisma.ClientSelect;

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ClientsQueryDto) {
    const where: Prisma.ClientWhereInput = {
      ...(query.clientType ? { clientType: query.clientType } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { vatNumber: { contains: query.search, mode: 'insensitive' } },
              { crNumber: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return paginate(this.prisma.client, query, {
      where,
      orderBy: { name: 'asc' },
      select: CLIENT_LIST_SELECT,
    });
  }

  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      select: CLIENT_DETAIL_SELECT,
    });
    if (!client) {
      throw new NotFoundException('Client not found');
    }
    return client;
  }

  async create(dto: CreateClientDto) {
    return this.prisma.client.create({ data: dto, select: CLIENT_DETAIL_SELECT });
  }

  async update(id: string, dto: UpdateClientDto) {
    await this.ensureExists(id);
    return this.prisma.client.update({ where: { id }, data: dto, select: CLIENT_DETAIL_SELECT });
  }

  async remove(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      select: { _count: { select: { contracts: true, purchaseOrders: true, jobs: true } } },
    });
    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const { contracts, purchaseOrders, jobs } = client._count;
    if (contracts > 0 || purchaseOrders > 0 || jobs > 0) {
      throw new ConflictException(
        'Cannot delete a client with contracts, purchase orders, or jobs. Set it to INACTIVE instead.',
      );
    }

    await this.prisma.client.delete({ where: { id } });
    return { success: true };
  }

  // --- Contacts -------------------------------------------------------------

  async addContact(clientId: string, dto: CreateClientContactDto) {
    await this.ensureExists(clientId);
    return this.prisma.clientContact.create({ data: { clientId, ...dto } });
  }

  async updateContact(clientId: string, contactId: string, dto: UpdateClientContactDto) {
    await this.ensureContactExists(clientId, contactId);
    return this.prisma.clientContact.update({ where: { id: contactId }, data: dto });
  }

  async removeContact(clientId: string, contactId: string) {
    await this.ensureContactExists(clientId, contactId);
    await this.prisma.clientContact.delete({ where: { id: contactId } });
    return { success: true };
  }

  private async ensureExists(id: string) {
    const client = await this.prisma.client.findUnique({ where: { id }, select: { id: true } });
    if (!client) {
      throw new NotFoundException('Client not found');
    }
  }

  private async ensureContactExists(clientId: string, contactId: string) {
    const contact = await this.prisma.clientContact.findUnique({
      where: { id: contactId },
      select: { clientId: true },
    });
    if (!contact || contact.clientId !== clientId) {
      throw new NotFoundException('Contact not found');
    }
  }
}
