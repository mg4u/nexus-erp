import {
    IsString, IsNumber, IsOptional, IsPositive, Min, Max, IsBoolean, MaxLength
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateProductDto {
    @ApiProperty({ example: 'Business Laptop Pro' })
    @IsString()
    @MaxLength(200)
    name: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ example: 'LAPTOP-001' })
    @IsString()
    @MaxLength(50)
    sku: string;

    @ApiProperty({ example: 1299.99 })
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    price: number;

    @ApiPropertyOptional({ example: 50 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    stockQuantity?: number;

    @ApiPropertyOptional({ example: 10 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    lowStockAlert?: number;

    @ApiPropertyOptional({ example: 'Electronics' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    category?: string;
}

export class UpdateProductDto extends PartialType(CreateProductDto) { }

export class AdjustStockDto {
    @ApiProperty({ description: 'Positive to add, negative to reduce', example: 10 })
    @IsNumber()
    quantity: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    reason?: string;
}

export class ProductsQueryDto {
    @ApiPropertyOptional({ default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ default: 20 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @Max(100)
    limit?: number = 20;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    category?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ description: 'true to show only low stock items' })
    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    lowStock?: boolean;
}
