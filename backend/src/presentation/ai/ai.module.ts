import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiController } from './ai.controller';
import { AiAssistantService } from '../../application/ai/ai-assistant.service';
import { AI_PROVIDER } from '../../domain/ai/ai-provider.interface';
import { OpenAIProvider } from '../../infrastructure/ai/openai.provider';
import { StubAIProvider } from '../../infrastructure/ai/stub-ai.provider';

@Module({
    controllers: [AiController],
    providers: [
        AiAssistantService,
        {
            provide: AI_PROVIDER,
            useFactory: (configService: ConfigService) => {
                const apiKey = configService.get<string>('openai.apiKey');
                // Use real OpenAI if API key is provided, else fall back to stub
                if (apiKey && apiKey.length > 10) {
                    return new OpenAIProvider(configService);
                }
                return new StubAIProvider();
            },
            inject: [ConfigService],
        },
    ],
})
export class AiModule { }
