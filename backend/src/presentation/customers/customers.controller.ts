import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CustomersService } from '../../application/customers/customers.service';
import { CreateCustomerDto, UpdateCustomerDto, CustomersQueryDto } from '../../application/customers/dto/customers.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';

@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'customers', version: '1' })
export class CustomersController {
    constructor(private readonly customersService: CustomersService) { }

    @Get()
    @RequirePermissions('customers', 'read')
    findAll(@TenantId() tenantId: string, @Query() query: CustomersQueryDto) {
        return this.customersService.findAll(tenantId, query);
    }

    @Get(':id')
    @RequirePermissions('customers', 'read')
    findOne(@TenantId() tenantId: string, @Param('id') id: string) {
        return this.customersService.findOne(tenantId, id);
    }

    @Post()
    @RequirePermissions('customers', 'create')
    create(@TenantId() tenantId: string, @Body() dto: CreateCustomerDto) {
        return this.customersService.create(tenantId, dto);
    }

    @Patch(':id')
    @RequirePermissions('customers', 'update')
    update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateCustomerDto) {
        return this.customersService.update(tenantId, id, dto);
    }

    @Delete(':id')
    @RequirePermissions('customers', 'delete')
    remove(@TenantId() tenantId: string, @Param('id') id: string) {
        return this.customersService.remove(tenantId, id);
    }
}
