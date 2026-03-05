import {
    IsString,
    IsNotEmpty,
    IsEnum,
    IsOptional,
    IsUUID,
    IsNumber,
    IsPositive,
    IsArray,
    ValidateNested,
    IsInt,
    Min,
    Max,
    MaxLength,
    IsDateString,
    Min as MinVal,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ─── Journal Entry Line ──────────────────────────────────────────────────────

export class CreateJournalLineDto {
    @ApiProperty({ example: 'uuid-of-account', description: 'Account UUID to debit or credit' })
    @IsUUID()
    accountId: string;

    @ApiProperty({ example: 1000.0, description: 'Debit amount (use 0 if this is a credit line)' })
    @IsNumber({ maxDecimalPlaces: 4 })
    @Min(0)
    debit: number;

    @ApiProperty({ example: 0, description: 'Credit amount (use 0 if this is a debit line)' })
    @IsNumber({ maxDecimalPlaces: 4 })
    @Min(0)
    credit: number;

    @ApiPropertyOptional({ example: 'Sales revenue recognition' })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    description?: string;
}

// ─── Create Journal Entry ────────────────────────────────────────────────────

export class CreateJournalEntryDto {
    @ApiProperty({ example: 'Monthly rent payment for March 2026' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(500)
    description: string;

    @ApiPropertyOptional({ example: 'MANUAL', enum: ['MANUAL', 'INVOICE', 'PAYMENT'] })
    @IsOptional()
    @IsString()
    referenceType?: string;

    @ApiPropertyOptional({ example: 'uuid-of-invoice-or-payment' })
    @IsOptional()
    @IsUUID()
    referenceId?: string;

    @ApiProperty({ type: [CreateJournalLineDto], description: 'At least 2 lines required; SUM(debit) must equal SUM(credit)' })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateJournalLineDto)
    lines: CreateJournalLineDto[];
}

// ─── Query Journal Entries ───────────────────────────────────────────────────

export enum JournalStatusDto {
    DRAFT = 'DRAFT',
    POSTED = 'POSTED',
    REVERSED = 'REVERSED',
}

export class JournalQueryDto {
    @ApiPropertyOptional({ default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ default: 20 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(200)
    limit?: number = 20;

    @ApiPropertyOptional({ enum: JournalStatusDto })
    @IsOptional()
    @IsEnum(JournalStatusDto)
    status?: JournalStatusDto;

    @ApiPropertyOptional({ example: '2026-01-01', description: 'Filter entries from this date (ISO 8601)' })
    @IsOptional()
    @IsDateString()
    dateFrom?: string;

    @ApiPropertyOptional({ example: '2026-03-31', description: 'Filter entries up to this date (ISO 8601)' })
    @IsOptional()
    @IsDateString()
    dateTo?: string;
}

// ─── Trial Balance Query ─────────────────────────────────────────────────────

export class TrialBalanceQueryDto {
    @ApiPropertyOptional({ example: '2026-03-31', description: 'Calculate balances as of this date (defaults to now)' })
    @IsOptional()
    @IsDateString()
    asOfDate?: string;
}
