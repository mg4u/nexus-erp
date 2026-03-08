import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { PaymentsService } from '../../application/payments/payments.service';
import { CreatePaymentDto, PaymentsQueryDto } from '../../application/invoices/dto/invoices-payments.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'payments', version: '1' })
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) { }

    @Get()
    @RequirePermissions('payments', 'read')
    findAll(@TenantId() tenantId: string, @Query() query: PaymentsQueryDto) {
        return this.paymentsService.findAll(tenantId, query);
    }

    @Post()
    @RequirePermissions('payments', 'create')
    create(
        @TenantId() tenantId: string,
        @CurrentUser('sub') userId: string,
        @Body() dto: CreatePaymentDto,
    ) {
        return this.paymentsService.create(tenantId, dto, userId);
    }
}
