import {
    IsString,
    IsNotEmpty,
    IsEnum,
    IsOptional,
    IsUUID,
    IsBoolean,
    IsInt,
    Min,
    Max,
    MaxLength,
    Matches,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum AccountTypeDto {
    ASSET = 'ASSET',
    LIABILITY = 'LIABILITY',
    EQUITY = 'EQUITY',
    REVENUE = 'REVENUE',
    EXPENSE = 'EXPENSE',
}

// ─── Create ──────────────────────────────────────────────────────────────────

export class CreateAccountDto {
    @ApiProperty({ example: '1000', description: 'Unique account code within the tenant' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(20)
    @Matches(/^[A-Za-z0-9]([A-Za-z0-9.\-]*[A-Za-z0-9])?$/, {
        message: 'code must be alphanumeric and may contain dots or dashes',
    })
    code: string;

    @ApiProperty({ example: 'Cash and Cash Equivalents' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(150)
    name: string;

    @ApiProperty({ enum: AccountTypeDto, example: 'ASSET' })
    @IsEnum(AccountTypeDto)
    type: AccountTypeDto;

    @ApiPropertyOptional({ example: null, description: 'UUID of the parent account (optional)' })
    @IsOptional()
    @IsUUID()
    parentId?: string;

    @ApiPropertyOptional({ default: false, description: 'Mark as a system-seeded account' })
    @IsOptional()
    @IsBoolean()
    isSystem?: boolean;

    @ApiPropertyOptional({ default: false, description: 'Allow this account to receive journal postings (must be a leaf account)' })
    @IsOptional()
    @IsBoolean()
    isPostable?: boolean;
}

// ─── Update ──────────────────────────────────────────────────────────────────

export class UpdateAccountDto extends PartialType(CreateAccountDto) { }

// ─── Query ───────────────────────────────────────────────────────────────────

export class AccountsQueryDto {
    @ApiPropertyOptional({ default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ default: 50 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(500)
    limit?: number = 50;

    @ApiPropertyOptional({ enum: AccountTypeDto })
    @IsOptional()
    @IsEnum(AccountTypeDto)
    type?: AccountTypeDto;

    @ApiPropertyOptional({ example: 'cash' })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ default: true })
    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    activeOnly?: boolean = true;
}
