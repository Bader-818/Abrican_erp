import { Body, Controller, Get, Ip, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsQueryDto } from './dto/payments-query.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @RequirePermissions('payments.view')
  findAll(@Query() query: PaymentsQueryDto) {
    return this.paymentsService.findAll(query);
  }

  @Get('aging')
  @RequirePermissions('payments.view')
  aging() {
    return this.paymentsService.aging();
  }

  @Get(':id')
  @RequirePermissions('payments.view')
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }

  @Post()
  @RequirePermissions('payments.manage')
  create(
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.paymentsService.create(dto, user, ipAddress);
  }
}
