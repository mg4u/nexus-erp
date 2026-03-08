import { Controller, Get, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { InvoicesService } from '../../application/invoices/invoices.service';
import { UpdateInvoiceStatusDto, InvoicesQueryDto } from '../../application/invoices/dto/invoices-payments.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'invoices', version: '1' })
export class InvoicesController {
    constructor(private readonly invoicesService: InvoicesService) { }

    @Get()
    @RequirePermissions('invoices', 'read')
    findAll(@TenantId() tenantId: string, @Query() query: InvoicesQueryDto) {
        return this.invoicesService.findAll(tenantId, query);
    }

    @Get('overdue')
    @RequirePermissions('invoices', 'read')
    @ApiOperation({ summary: 'Get overdue invoices summary' })
    getOverdue(@TenantId() tenantId: string) {
        return this.invoicesService.getOverdueSummary(tenantId);
    }

    @Get(':id')
    @RequirePermissions('invoices', 'read')
    findOne(@TenantId() tenantId: string, @Param('id') id: string) {
        return this.invoicesService.findOne(tenantId, id);
    }

    @Patch(':id/status')
    @RequirePermissions('invoices', 'update')
    @ApiOperation({ summary: 'Update invoice lifecycle status (auto-generates journal entries)' })
    updateStatus(
        @TenantId() tenantId: string,
        @CurrentUser('sub') userId: string,
        @Param('id') id: string,
        @Body() dto: UpdateInvoiceStatusDto,
    ) {
        return this.invoicesService.updateStatus(tenantId, id, dto, userId);
    }
}
