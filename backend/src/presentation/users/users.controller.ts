import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { UsersService } from '../../application/users/users.service';
import { CreateUserDto, UpdateUserDto, UsersQueryDto } from '../../application/users/dto/users.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'users', version: '1' })
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get()
    @Roles(UserRole.ADMIN, UserRole.MANAGER)
    @ApiOperation({ summary: 'List all users (paginated)' })
    findAll(@TenantId() tenantId: string, @Query() query: UsersQueryDto) {
        return this.usersService.findAll(tenantId, query);
    }

    @Get(':id')
    @Roles(UserRole.ADMIN, UserRole.MANAGER)
    findOne(@TenantId() tenantId: string, @Param('id') id: string) {
        return this.usersService.findOne(tenantId, id);
    }

    @Post()
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Create a new user (Admin only)' })
    create(@TenantId() tenantId: string, @Body() dto: CreateUserDto) {
        return this.usersService.create(tenantId, dto);
    }

    @Patch(':id')
    @Roles(UserRole.ADMIN)
    update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateUserDto) {
        return this.usersService.update(tenantId, id, dto);
    }

    @Delete(':id')
    @Roles(UserRole.ADMIN)
    deactivate(@TenantId() tenantId: string, @Param('id') id: string) {
        return this.usersService.deactivate(tenantId, id);
    }
}
