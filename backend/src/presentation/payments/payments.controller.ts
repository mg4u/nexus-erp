import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { PaymentsService } from '../../application/payments/payments.service';
import { CreatePaymentDto, PaymentsQueryDto } from '../../application/invoices/dto/invoices-payments.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'payments', version: '1' })
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) { }

    @Get()
    @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
    findAll(@TenantId() tenantId: string, @Query() query: PaymentsQueryDto) {
        return this.paymentsService.findAll(tenantId, query);
    }

    @Post()
    @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
    create(@TenantId() tenantId: string, @Body() dto: CreatePaymentDto) {
        return this.paymentsService.create(tenantId, dto);
    }
}
