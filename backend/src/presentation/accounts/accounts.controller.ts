import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
    ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AccountsService } from '../../application/accounts/accounts.service';
import { CreateAccountDto, UpdateAccountDto, AccountsQueryDto } from '../../application/accounts/dto/accounts.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';

@ApiTags('Accounts (Chart of Accounts)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'accounts', version: '1' })
export class AccountsController {
    constructor(private readonly accountsService: AccountsService) { }

    // ── Read endpoints (Admin, Accountant, Manager) ───────────────────────────

    @Get()
    @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.MANAGER)
    @ApiOperation({ summary: 'Get paginated flat list of accounts' })
    @ApiResponse({ status: 200, description: 'Paginated account list' })
    findAll(@TenantId() tenantId: string, @Query() query: AccountsQueryDto) {
        return this.accountsService.findAll(tenantId, query);
    }

    @Get('tree')
    @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.MANAGER)
    @ApiOperation({ summary: 'Get full hierarchical Chart of Accounts tree (Redis-cached)' })
    @ApiResponse({ status: 200, description: 'Hierarchical account tree' })
    getTree(@TenantId() tenantId: string) {
        return this.accountsService.getTree(tenantId);
    }

    @Get(':id')
    @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.MANAGER)
    @ApiOperation({ summary: 'Get a single account with its direct children' })
    @ApiResponse({ status: 200, description: 'Account details' })
    @ApiResponse({ status: 404, description: 'Account not found' })
    findOne(
        @TenantId() tenantId: string,
        @Param('id', new ParseUUIDPipe()) id: string,
    ) {
        return this.accountsService.findOne(tenantId, id);
    }

    // ── Write endpoints (Admin, Accountant) ───────────────────────────────────

    @Post()
    @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
    @ApiOperation({ summary: 'Create a new account' })
    @ApiResponse({ status: 201, description: 'Account created' })
    @ApiResponse({ status: 409, description: 'Duplicate account code' })
    create(@TenantId() tenantId: string, @Body() dto: CreateAccountDto) {
        return this.accountsService.create(tenantId, dto);
    }

    @Post('seed')
    @Roles(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Seed default Chart of Accounts for this tenant (idempotent)' })
    @ApiResponse({ status: 200, description: 'Seed completed' })
    seedDefaultCoA(@TenantId() tenantId: string) {
        return this.accountsService.seedDefaultCoA(tenantId);
    }

    @Patch(':id')
    @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
    @ApiOperation({ summary: 'Update account name, code, type, or parent' })
    @ApiResponse({ status: 200, description: 'Account updated' })
    @ApiResponse({ status: 404, description: 'Account not found' })
    update(
        @TenantId() tenantId: string,
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() dto: UpdateAccountDto,
    ) {
        return this.accountsService.update(tenantId, id, dto);
    }

    @Patch(':id/disable')
    @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
    @ApiOperation({ summary: 'Disable an account (soft-delete)' })
    @ApiResponse({ status: 200, description: 'Account disabled' })
    @ApiResponse({ status: 409, description: 'Cannot disable: has active children' })
    disable(
        @TenantId() tenantId: string,
        @Param('id', new ParseUUIDPipe()) id: string,
    ) {
        return this.accountsService.disable(tenantId, id);
    }

    @Patch(':id/postable')
    @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
    @ApiOperation({ summary: 'Toggle isPostable flag on a leaf account' })
    @ApiResponse({ status: 200, description: '{ id, isPostable } — new state returned' })
    @ApiResponse({ status: 409, description: 'Cannot mark as postable: has child accounts' })
    togglePostable(
        @TenantId() tenantId: string,
        @Param('id', new ParseUUIDPipe()) id: string,
    ) {
        return this.accountsService.togglePostable(tenantId, id);
    }

    // ── Delete endpoint (Admin only) ──────────────────────────────────────────

    @Delete(':id')
    @Roles(UserRole.ADMIN)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Permanently delete an account (non-system, no children)' })
    @ApiResponse({ status: 204, description: 'Account deleted' })
    @ApiResponse({ status: 403, description: 'Cannot delete system account' })
    @ApiResponse({ status: 409, description: 'Cannot delete: has children' })
    async remove(
        @TenantId() tenantId: string,
        @Param('id', new ParseUUIDPipe()) id: string,
    ) {
        await this.accountsService.delete(tenantId, id);
    }
}
