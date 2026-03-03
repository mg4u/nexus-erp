import { Injectable, Logger } from '@nestjs/common';
import { AIProvider, AIQueryRequest, AIQueryResponse } from '../../domain/ai/ai-provider.interface';

/**
 * Stub AI provider for development without an OpenAI API key.
 * Returns canned responses based on keyword matching.
 */
@Injectable()
export class StubAIProvider implements AIProvider {
    private readonly logger = new Logger(StubAIProvider.name);

    async query(request: AIQueryRequest): Promise<AIQueryResponse> {
        this.logger.debug(`Stub AI processing: "${request.query}"`);

        const q = request.query.toLowerCase();

        if (q.includes('revenue') || q.includes('sales')) {
            return {
                insight:
                    'Based on your data, total revenue this month is $15,432. This represents a 12% increase compared to last month. Your top performing product is "Business Laptop Pro" contributing 45% of revenue.',
                queryType: 'revenue_analysis',
                confidence: 0.85,
            };
        }

        if (q.includes('customer') || q.includes('client')) {
            return {
                insight:
                    'You currently have 47 active customers. Your top customer by lifetime value is TechCorp with $12,500 in total orders. 3 customers have pending invoices overdue by more than 30 days.',
                queryType: 'customer_analysis',
                confidence: 0.82,
            };
        }

        if (q.includes('stock') || q.includes('inventory') || q.includes('product')) {
            return {
                insight:
                    'Current inventory status: 5 products are below the low-stock threshold. "Ergonomic Office Chair" has only 2 units remaining. I recommend placing a reorder for the top 3 low-stock items.',
                queryType: 'inventory_analysis',
                confidence: 0.88,
            };
        }

        if (q.includes('invoice') || q.includes('unpaid') || q.includes('overdue')) {
            return {
                insight:
                    'You have 8 outstanding invoices totaling $23,750. 3 invoices are overdue, with the oldest being 45 days past due. The average payment time for your customers is 18 days.',
                queryType: 'invoice_analysis',
                confidence: 0.9,
            };
        }

        if (q.includes('order')) {
            return {
                insight:
                    'You have 23 orders this month, with 12 delivered, 7 in progress, and 4 pending. Average order value is $672. Order completion rate is 87% this month.',
                queryType: 'order_analysis',
                confidence: 0.86,
            };
        }

        return {
            insight:
                'I analyzed your ERP data. Your business is currently tracking well across all KPIs. Revenue is on an upward trend (+8% MoM), inventory levels are stable, and customer satisfaction metrics look positive. Would you like me to dive deeper into any specific area?',
            queryType: 'general_analysis',
            confidence: 0.7,
        };
    }
}
