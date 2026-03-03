import { Controller, Get, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ReportsService } from '../../application/reports/reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
@Controller({ path: 'reports', version: '1' })
export class ReportsController {
    constructor(private readonly reportsService: ReportsService) { }

    @Get('dashboard')
    @ApiOperation({ summary: 'Get dashboard KPI summary (cached 1hr)' })
    getDashboard(@TenantId() tenantId: string) {
        return this.reportsService.getDashboardSummary(tenantId);
    }

    @Get('monthly-sales')
    @ApiOperation({ summary: 'Monthly revenue aggregation by year' })
    @ApiQuery({ name: 'year', required: false, type: Number })
    getMonthlySales(
        @TenantId() tenantId: string,
        @Query('year', new DefaultValuePipe(new Date().getFullYear()), ParseIntPipe) year: number,
    ) {
        return this.reportsService.getMonthlySales(tenantId, year);
    }

    @Get('top-products')
    @ApiOperation({ summary: 'Top products by revenue (cached 1hr)' })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    getTopProducts(
        @TenantId() tenantId: string,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    ) {
        return this.reportsService.getTopProducts(tenantId, limit);
    }

    @Get('revenue-by-category')
    @ApiOperation({ summary: 'Revenue breakdown by product category' })
    getRevenueByCategory(@TenantId() tenantId: string) {
        return this.reportsService.getRevenueByCategory(tenantId);
    }
}
