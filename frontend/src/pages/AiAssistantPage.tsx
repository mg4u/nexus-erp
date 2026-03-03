import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Loader2, Sparkles, TrendingUp, Package, Users, FileText } from 'lucide-react';
import { aiApi } from '@/api/services';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    queryType?: string;
    confidence?: number;
    timestamp: Date;
}

const SUGGESTIONS = [
    { icon: TrendingUp, text: 'What is my total revenue this month?' },
    { icon: Package, text: 'Which products are running low on stock?' },
    { icon: Users, text: 'Who are my top customers by order value?' },
    { icon: FileText, text: 'How many overdue invoices do I have?' },
];

const queryTypeLabel: Record<string, string> = {
    revenue_analysis: '📈 Revenue',
    customer_analysis: '👥 Customers',
    inventory_analysis: '📦 Inventory',
    invoice_analysis: '🧾 Invoices',
    order_analysis: '🛒 Orders',
    general_analysis: '🤖 General',
};

export function AiAssistantPage() {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '0',
            role: 'assistant',
            content: "Hi! I'm your AI business assistant. Ask me anything about your sales, inventory, customers, invoices, or any other business metric. I'll analyze your real-time ERP data and give you actionable insights.",
            timestamp: new Date(),
        },
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = async (text?: string) => {
        const query = (text ?? input).trim();
        if (!query || isLoading) return;

        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: query, timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const result = await aiApi.query(query);
            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: result.insight,
                queryType: result.queryType,
                confidence: result.confidence,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, aiMsg]);
        } catch {
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
                timestamp: new Date(),
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-10rem)]">
            {/* Header */}
            <div className="page-header flex items-center gap-4 mb-0 pb-6 border-b border-slate-800">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                    <Bot size={24} className="text-white" />
                </div>
                <div>
                    <h1 className="page-title flex items-center gap-2">
                        AI Business Assistant <Sparkles size={18} className="text-amber-400" />
                    </h1>
                    <p className="page-subtitle">Ask natural language questions about your business data</p>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto py-6 space-y-4">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'assistant' && (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0 mr-3 mt-0.5">
                                <Bot size={14} className="text-white" />
                            </div>
                        )}
                        <div className={`max-w-[75%] ${msg.role === 'user' ? 'ml-12' : 'mr-12'}`}>
                            <div className={`rounded-2xl px-4 py-3 ${msg.role === 'user'
                                    ? 'bg-primary-600 text-white rounded-tr-sm'
                                    : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-sm'
                                }`}>
                                <p className="text-sm leading-relaxed">{msg.content}</p>
                            </div>
                            <div className={`flex items-center gap-2 mt-1 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <span className="text-xs text-slate-600">
                                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {msg.queryType && (
                                    <span className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                                        {queryTypeLabel[msg.queryType] ?? msg.queryType}
                                    </span>
                                )}
                                {msg.confidence && (
                                    <span className="text-xs text-slate-600">
                                        {(msg.confidence * 100).toFixed(0)}% conf.
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mr-3">
                            <Bot size={14} className="text-white" />
                        </div>
                        <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-sm px-4 py-3">
                            <div className="flex items-center gap-2 text-slate-400 text-sm">
                                <Loader2 size={14} className="animate-spin" />
                                Analyzing your business data...
                            </div>
                        </div>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            {/* Suggestions */}
            {messages.length <= 1 && (
                <div className="grid grid-cols-2 gap-2 mb-4">
                    {SUGGESTIONS.map(({ icon: Icon, text }) => (
                        <button key={text} onClick={() => sendMessage(text)}
                            className="flex items-center gap-2 p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-xl text-left text-xs text-slate-300 transition-all">
                            <Icon size={14} className="text-primary-400 flex-shrink-0" />
                            {text}
                        </button>
                    ))}
                </div>
            )}

            {/* Input */}
            <div className="pt-4 border-t border-slate-800">
                <div className="flex gap-3">
                    <input
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                        placeholder="Ask about revenue, inventory, customers, invoices..."
                        className="input flex-1"
                        disabled={isLoading}
                    />
                    <button onClick={() => sendMessage()} disabled={!input.trim() || isLoading} className="btn-primary px-4 justify-center">
                        {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    </button>
                </div>
                <p className="text-xs text-slate-600 mt-2 text-center">
                    Powered by AI • Analyzes your real-time ERP data • Responses are cached
                </p>
            </div>
        </div>
    );
}
