import { IsString, IsEmail, IsOptional, IsEnum, IsBoolean, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsNumber, Min, Max } from 'class-validator';

export class CreateUserDto {
    @ApiProperty({ example: 'john@acme.com' })
    @IsEmail()
    email: string;

    @ApiProperty({ example: 'John' })
    @IsString()
    @MaxLength(50)
    firstName: string;

    @ApiProperty({ example: 'Doe' })
    @IsString()
    @MaxLength(50)
    lastName: string;

    @ApiProperty({ enum: UserRole, example: UserRole.EMPLOYEE })
    @IsEnum(UserRole)
    role: UserRole;

    @ApiProperty({ example: 'Secret123!' })
    @IsString()
    password: string;
}

export class UpdateUserDto extends PartialType(CreateUserDto) { }

export class UsersQueryDto {
    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ example: 20 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @Max(100)
    limit?: number = 20;

    @ApiPropertyOptional({ enum: UserRole })
    @IsOptional()
    @IsEnum(UserRole)
    role?: UserRole;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    search?: string;
}
