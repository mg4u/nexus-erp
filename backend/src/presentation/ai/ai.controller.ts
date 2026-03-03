import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AiAssistantService } from '../../application/ai/ai-assistant.service';
import { AiQueryDto } from '../../application/ai/dto/ai.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';

@ApiTags('AI Assistant')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'ai', version: '1' })
export class AiController {
    constructor(private readonly aiAssistantService: AiAssistantService) { }

    @Post('query')
    @ApiOperation({ summary: 'Ask a natural language question about your business data' })
    @ApiResponse({ status: 200, description: 'AI-generated business insight' })
    async query(@TenantId() tenantId: string, @Body() dto: AiQueryDto) {
        return this.aiAssistantService.processQuery(tenantId, dto.query);
    }
}
