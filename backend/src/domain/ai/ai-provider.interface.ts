export interface AIQueryRequest {
    query: string;
    context?: Record<string, unknown>;
}

export interface AIQueryResponse {
    insight: string;
    data?: unknown;
    queryType: string;
    confidence: number;
}

export interface AIProvider {
    query(request: AIQueryRequest, schemaContext: string): Promise<AIQueryResponse>;
}

export const AI_PROVIDER = 'AI_PROVIDER';
