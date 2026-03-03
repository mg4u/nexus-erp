import {
    IsString, IsNumber, IsOptional, IsArray, ValidateNested, IsPositive, Min, Max, IsEnum
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { OrderStatus } from '@prisma/client';

export class CreateOrderItemDto {
    @ApiProperty()
    @IsString()
    productId: string;

    @ApiProperty({ example: 2 })
    @IsNumber()
    @IsPositive()
    quantity: number;
}

export class CreateOrderDto {
    @ApiProperty()
    @IsString()
    customerId: string;

    @ApiProperty({ type: [CreateOrderItemDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateOrderItemDto)
    items: CreateOrderItemDto[];

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    notes?: string;

    @ApiPropertyOptional({ description: 'Tax percentage 0–100', example: 8 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(100)
    taxPercent?: number;
}

export class UpdateOrderStatusDto {
    @ApiProperty({ enum: OrderStatus })
    @IsEnum(OrderStatus)
    status: OrderStatus;
}

export class OrdersQueryDto {
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

    @ApiPropertyOptional({ enum: OrderStatus })
    @IsOptional()
    @IsEnum(OrderStatus)
    status?: OrderStatus;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    customerId?: string;
}
