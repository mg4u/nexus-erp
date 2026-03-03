import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { AIProvider, AIQueryRequest, AIQueryResponse } from '../../domain/ai/ai-provider.interface';

@Injectable()
export class OpenAIProvider implements AIProvider {
    private readonly logger = new Logger(OpenAIProvider.name);
    private readonly client: OpenAI;
    private readonly model: string;

    constructor(private readonly configService: ConfigService) {
        this.client = new OpenAI({ apiKey: configService.get<string>('openai.apiKey') });
        this.model = configService.get<string>('openai.model', 'gpt-4o');
    }

    async query(request: AIQueryRequest, schemaContext: string): Promise<AIQueryResponse> {
        const systemPrompt = `You are an intelligent ERP business analyst assistant. 
You have access to a multi-tenant SaaS ERP system with the following data structure:
${schemaContext}

When a user asks a question:
1. Identify what data they need (revenue, customers, orders, inventory, invoices, payments)
2. Provide a clear, professional business insight
3. Always format numbers with $ and use percentage for changes
4. Keep responses concise but informative (2-3 sentences max)
5. Respond in a structured JSON format

Response format:
{
  "insight": "Your natural language insight",
  "queryType": "one of: revenue_analysis, customer_analysis, inventory_analysis, invoice_analysis, order_analysis, general_analysis",
  "confidence": 0.0-1.0
}`;

        try {
            const completion = await this.client.chat.completions.create({
                model: this.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: request.query },
                ],
                response_format: { type: 'json_object' },
                temperature: 0.3,
                max_tokens: 500,
            });

            const content = completion.choices[0]?.message?.content ?? '{}';
            const parsed = JSON.parse(content) as AIQueryResponse;
            return parsed;
        } catch (error) {
            this.logger.error('OpenAI query failed:', (error as Error).message);
            throw error;
        }
    }
}
