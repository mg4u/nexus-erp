import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AiQueryDto {
    @ApiProperty({
        example: 'What is my revenue this month and which products are selling best?',
        description: 'Natural language business query',
        maxLength: 500,
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(500)
    query: string;
}
