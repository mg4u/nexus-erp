import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { UsersService } from '../../application/users/users.service';
import { CreateUserDto, UpdateUserDto, UsersQueryDto } from '../../application/users/dto/users.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'users', version: '1' })
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get()
    @RequirePermissions('users', 'read')
    @ApiOperation({ summary: 'List all users (paginated)' })
    findAll(@TenantId() tenantId: string, @Query() query: UsersQueryDto) {
        return this.usersService.findAll(tenantId, query);
    }

    @Get(':id')
    @RequirePermissions('users', 'read')
    findOne(@TenantId() tenantId: string, @Param('id') id: string) {
        return this.usersService.findOne(tenantId, id);
    }

    @Post()
    @RequirePermissions('users', 'create')
    @ApiOperation({ summary: 'Create a new user (Admin only)' })
    create(@TenantId() tenantId: string, @Body() dto: CreateUserDto) {
        return this.usersService.create(tenantId, dto);
    }

    @Patch(':id')
    @RequirePermissions('users', 'update')
    update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateUserDto) {
        return this.usersService.update(tenantId, id, dto);
    }

    @Delete(':id')
    @RequirePermissions('users', 'delete')
    deactivate(@TenantId() tenantId: string, @Param('id') id: string) {
        return this.usersService.deactivate(tenantId, id);
    }
}
