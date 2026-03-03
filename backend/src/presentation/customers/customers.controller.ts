import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CustomersService } from '../../application/customers/customers.service';
import { CreateCustomerDto, UpdateCustomerDto, CustomersQueryDto } from '../../application/customers/dto/customers.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';

@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'customers', version: '1' })
export class CustomersController {
    constructor(private readonly customersService: CustomersService) { }

    @Get()
    findAll(@TenantId() tenantId: string, @Query() query: CustomersQueryDto) {
        return this.customersService.findAll(tenantId, query);
    }

    @Get(':id')
    findOne(@TenantId() tenantId: string, @Param('id') id: string) {
        return this.customersService.findOne(tenantId, id);
    }

    @Post()
    create(@TenantId() tenantId: string, @Body() dto: CreateCustomerDto) {
        return this.customersService.create(tenantId, dto);
    }

    @Patch(':id')
    update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateCustomerDto) {
        return this.customersService.update(tenantId, id, dto);
    }

    @Delete(':id')
    remove(@TenantId() tenantId: string, @Param('id') id: string) {
        return this.customersService.remove(tenantId, id);
    }
}
