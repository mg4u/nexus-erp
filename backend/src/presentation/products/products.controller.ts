import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ProductsService } from '../../application/products/products.service';
import { CreateProductDto, UpdateProductDto, ProductsQueryDto, AdjustStockDto } from '../../application/products/dto/products.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'products', version: '1' })
export class ProductsController {
    constructor(private readonly productsService: ProductsService) { }

    @Get()
    @ApiOperation({ summary: 'List all products (paginated)' })
    findAll(@TenantId() tenantId: string, @Query() query: ProductsQueryDto) {
        return this.productsService.findAll(tenantId, query);
    }

    @Get('low-stock')
    @Roles(UserRole.ADMIN, UserRole.MANAGER)
    @ApiOperation({ summary: 'Get low stock products' })
    getLowStock(@TenantId() tenantId: string) {
        return this.productsService.findLowStock(tenantId);
    }

    @Get(':id')
    findOne(@TenantId() tenantId: string, @Param('id') id: string) {
        return this.productsService.findOne(tenantId, id);
    }

    @Post()
    @Roles(UserRole.ADMIN, UserRole.MANAGER)
    create(@TenantId() tenantId: string, @Body() dto: CreateProductDto) {
        return this.productsService.create(tenantId, dto);
    }

    @Patch(':id')
    @Roles(UserRole.ADMIN, UserRole.MANAGER)
    update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateProductDto) {
        return this.productsService.update(tenantId, id, dto);
    }

    @Post(':id/adjust-stock')
    @Roles(UserRole.ADMIN, UserRole.MANAGER)
    @ApiOperation({ summary: 'Manually adjust product stock' })
    adjustStock(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: AdjustStockDto) {
        return this.productsService.adjustStock(tenantId, id, dto);
    }

    @Delete(':id')
    @Roles(UserRole.ADMIN, UserRole.MANAGER)
    remove(@TenantId() tenantId: string, @Param('id') id: string) {
        return this.productsService.remove(tenantId, id);
    }
}
