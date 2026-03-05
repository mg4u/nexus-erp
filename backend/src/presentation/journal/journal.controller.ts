import {
    Controller,
    Get,
    Post,
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
import { JournalService } from '../../application/journal/journal.service';
import { CreateJournalEntryDto, JournalQueryDto, TrialBalanceQueryDto } from '../../application/journal/dto/journal.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Journal Entries (Double-Entry Accounting)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'journal-entries', version: '1' })
export class JournalController {
    constructor(private readonly journalService: JournalService) { }

    // ── List ──────────────────────────────────────────────────────────────────

    @Get()
    @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.MANAGER)
    @ApiOperation({ summary: 'List journal entries (paginated, filterable by status and date)' })
    @ApiResponse({ status: 200, description: 'Paginated journal entries with lines' })
    findAll(@TenantId() tenantId: string, @Query() query: JournalQueryDto) {
        return this.journalService.findAll(tenantId, query);
    }

    // ── Trial Balance ─────────────────────────────────────────────────────────

    @Get('trial-balance')
    @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.MANAGER)
    @ApiOperation({ summary: 'Generate trial balance report (Redis-cached, 5 min TTL)' })
    @ApiResponse({ status: 200, description: 'Trial balance grouped by account' })
    getTrialBalance(@TenantId() tenantId: string, @Query() query: TrialBalanceQueryDto) {
        return this.journalService.getTrialBalance(tenantId, query);
    }

    // ── Validate Global Equality ──────────────────────────────────────────────

    @Get('validate')
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Validate global SUM(debit) = SUM(credit) system invariant (Admin only)' })
    @ApiResponse({ status: 200, description: 'Validation result with totals and balance flag' })
    validate(@TenantId() tenantId: string) {
        return this.journalService.validateGlobalEquality(tenantId);
    }

    // ── Get Single Entry ──────────────────────────────────────────────────────

    @Get(':id')
    @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.MANAGER)
    @ApiOperation({ summary: 'Get journal entry by ID with full line details' })
    @ApiResponse({ status: 200, description: 'Journal entry with account details on each line' })
    @ApiResponse({ status: 404, description: 'Journal entry not found' })
    findOne(
        @TenantId() tenantId: string,
        @Param('id', new ParseUUIDPipe()) id: string,
    ) {
        return this.journalService.findOne(tenantId, id);
    }

    // ── Post Manual Entry ─────────────────────────────────────────────────────

    @Post()
    @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
    @ApiOperation({ summary: 'Post a manual double-entry journal entry (enforces debit = credit)' })
    @ApiResponse({ status: 201, description: 'Journal entry posted successfully' })
    @ApiResponse({ status: 400, description: 'Debit ≠ Credit, invalid accounts, or zero-value lines' })
    @ApiResponse({ status: 403, description: 'Cross-tenant account usage or insufficient permissions' })
    postManual(
        @TenantId() tenantId: string,
        @CurrentUser('sub') userId: string,
        @Body() dto: CreateJournalEntryDto,
    ) {
        return this.journalService.postManualEntry(tenantId, userId, dto);
    }

    // ── Reverse Entry ─────────────────────────────────────────────────────────

    @Post(':id/reverse')
    @Roles(UserRole.ADMIN)
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Reverse a POSTED journal entry (Admin only) — creates a mirror balancing entry' })
    @ApiResponse({ status: 201, description: 'Reversal entry created; original locked as REVERSED' })
    @ApiResponse({ status: 409, description: 'Entry already reversed or not in POSTED status' })
    @ApiResponse({ status: 404, description: 'Journal entry not found' })
    reverse(
        @TenantId() tenantId: string,
        @CurrentUser('sub') userId: string,
        @Param('id', new ParseUUIDPipe()) id: string,
    ) {
        return this.journalService.reverseEntry(tenantId, userId, id);
    }
}
