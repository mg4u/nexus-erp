import { Controller, Get, Post, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ReportsService } from '../../application/reports/reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'reports', version: '1' })
export class ReportsController {
    constructor(private readonly reportsService: ReportsService) { }

    @Get('profit-loss')
    @RequirePermissions('profit_loss_report', 'read')
    @ApiOperation({ summary: 'Profit & Loss report from journal ledger (cached 1hr)' })
    @ApiQuery({ name: 'dateFrom', required: false, type: String, description: 'Start date (YYYY-MM-DD). Defaults to 1st of current month.' })
    @ApiQuery({ name: 'dateTo', required: false, type: String, description: 'End date (YYYY-MM-DD). Defaults to today.' })
    getProfitLoss(
        @TenantId() tenantId: string,
        @Query('dateFrom') dateFrom?: string,
        @Query('dateTo') dateTo?: string,
    ) {
        return this.reportsService.getProfitLoss(tenantId, dateFrom, dateTo);
    }

    @Get('profit-loss/entries')
    @RequirePermissions('profit_loss_report', 'read')
    @ApiOperation({ summary: 'Detailed journal entry lines behind the P&L totals (paginated)' })
    @ApiQuery({ name: 'dateFrom', required: false, type: String, description: 'Start date (YYYY-MM-DD)' })
    @ApiQuery({ name: 'dateTo', required: false, type: String, description: 'End date (YYYY-MM-DD)' })
    @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
    getProfitLossEntries(
        @TenantId() tenantId: string,
        @Query('dateFrom') dateFrom?: string,
        @Query('dateTo') dateTo?: string,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
    ) {
        return this.reportsService.getProfitLossEntries(tenantId, dateFrom, dateTo, page, limit);
    }

    @Get('dashboard')
    @RequirePermissions('reports', 'read')
    @ApiOperation({ summary: 'Get dashboard KPI summary (cached 1hr)' })
    getDashboard(@TenantId() tenantId: string) {
        return this.reportsService.getDashboardSummary(tenantId);
    }

    @Get('monthly-sales')
    @RequirePermissions('reports', 'read')
    @ApiOperation({ summary: 'Monthly revenue aggregation by year' })
    @ApiQuery({ name: 'year', required: false, type: Number })
    getMonthlySales(
        @TenantId() tenantId: string,
        @Query('year', new DefaultValuePipe(new Date().getFullYear()), ParseIntPipe) year: number,
    ) {
        return this.reportsService.getMonthlySales(tenantId, year);
    }

    @Get('top-products')
    @RequirePermissions('reports', 'read')
    @ApiOperation({ summary: 'Top products by revenue (cached 1hr)' })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    getTopProducts(
        @TenantId() tenantId: string,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    ) {
        return this.reportsService.getTopProducts(tenantId, limit);
    }

    @Get('revenue-by-category')
    @RequirePermissions('reports', 'read')
    @ApiOperation({ summary: 'Revenue breakdown by product category' })
    getRevenueByCategory(@TenantId() tenantId: string) {
        return this.reportsService.getRevenueByCategory(tenantId);
    }

    @Post('cache/invalidate')
    @RequirePermissions('reports', 'delete')
    @ApiOperation({ summary: 'Manually invalidate all report caches for the current tenant (ADMIN only)' })
    async invalidateCache(@TenantId() tenantId: string) {
        await this.reportsService.invalidateCache(tenantId);
        return { message: 'Report caches invalidated successfully' };
    }
}

