import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ProductsService } from '../../application/products/products.service';
import { CreateProductDto, UpdateProductDto, ProductsQueryDto, AdjustStockDto } from '../../application/products/dto/products.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'products', version: '1' })
export class ProductsController {
    constructor(private readonly productsService: ProductsService) { }

    @Get()
    @RequirePermissions('products', 'read')
    @ApiOperation({ summary: 'List all products (paginated)' })
    findAll(@TenantId() tenantId: string, @Query() query: ProductsQueryDto) {
        return this.productsService.findAll(tenantId, query);
    }

    @Get('low-stock')
    @RequirePermissions('products', 'read')
    @ApiOperation({ summary: 'Get low stock products' })
    getLowStock(@TenantId() tenantId: string) {
        return this.productsService.findLowStock(tenantId);
    }

    @Get(':id')
    @RequirePermissions('products', 'read')
    findOne(@TenantId() tenantId: string, @Param('id') id: string) {
        return this.productsService.findOne(tenantId, id);
    }

    @Post()
    @RequirePermissions('products', 'create')
    create(@TenantId() tenantId: string, @Body() dto: CreateProductDto) {
        return this.productsService.create(tenantId, dto);
    }

    @Patch(':id')
    @RequirePermissions('products', 'update')
    update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateProductDto) {
        return this.productsService.update(tenantId, id, dto);
    }

    @Post(':id/adjust-stock')
    @RequirePermissions('products', 'update')
    @ApiOperation({ summary: 'Manually adjust product stock' })
    adjustStock(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: AdjustStockDto) {
        return this.productsService.adjustStock(tenantId, id, dto);
    }

    @Delete(':id')
    @RequirePermissions('products', 'delete')
    remove(@TenantId() tenantId: string, @Param('id') id: string) {
        return this.productsService.remove(tenantId, id);
    }
}
