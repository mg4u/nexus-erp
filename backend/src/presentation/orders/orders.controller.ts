import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from '../../application/orders/orders.service';
import { CreateOrderDto, UpdateOrderStatusDto, OrdersQueryDto } from '../../application/orders/dto/orders.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'orders', version: '1' })
export class OrdersController {
    constructor(private readonly ordersService: OrdersService) { }

    @Get()
    findAll(@TenantId() tenantId: string, @Query() query: OrdersQueryDto) {
        return this.ordersService.findAll(tenantId, query);
    }

    @Get(':id')
    findOne(@TenantId() tenantId: string, @Param('id') id: string) {
        return this.ordersService.findOne(tenantId, id);
    }

    @Post()
    create(@TenantId() tenantId: string, @Body() dto: CreateOrderDto) {
        return this.ordersService.create(tenantId, dto);
    }

    @Patch(':id/status')
    updateStatus(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
        return this.ordersService.updateStatus(tenantId, id, dto);
    }
}
