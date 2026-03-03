import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import 'winston-daily-rotate-file';
import { ConfigModule } from './common/config/config.module';
import { PrismaModule } from './infrastructure/database/prisma.module';
import { RedisModule } from './infrastructure/cache/redis.module';
import { AuthModule } from './presentation/auth/auth.module';
import { UsersModule } from './presentation/users/users.module';
import { ProductsModule } from './presentation/products/products.module';
import { CustomersModule } from './presentation/customers/customers.module';
import { OrdersModule } from './presentation/orders/orders.module';
import { InvoicesModule } from './presentation/invoices/invoices.module';
import { PaymentsModule } from './presentation/payments/payments.module';
import { ReportsModule } from './presentation/reports/reports.module';
import { AiModule } from './presentation/ai/ai.module';
import { HealthModule } from './presentation/health/health.module';
import { TenantMiddleware } from './common/middleware/tenant.middleware';

@Module({
    imports: [
        // Config
        ConfigModule,

        // Logger
        WinstonModule.forRoot({
            transports: [
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.colorize(),
                        winston.format.printf(({ level, message, timestamp, context }) => {
                            return `${timestamp} [${context || 'App'}] ${level}: ${message}`;
                        }),
                    ),
                }),
                new (winston.transports as any).DailyRotateFile({
                    filename: 'logs/error-%DATE%.log',
                    datePattern: 'YYYY-MM-DD',
                    level: 'error',
                    maxFiles: '14d',
                    format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
                }),
                new (winston.transports as any).DailyRotateFile({
                    filename: 'logs/combined-%DATE%.log',
                    datePattern: 'YYYY-MM-DD',
                    maxFiles: '14d',
                    format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
                }),
            ],
        }),

        // Rate limiting
        ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),

        // Infrastructure
        PrismaModule,
        RedisModule,

        // Feature modules
        AuthModule,
        UsersModule,
        ProductsModule,
        CustomersModule,
        OrdersModule,
        InvoicesModule,
        PaymentsModule,
        ReportsModule,
        AiModule,
        HealthModule,
    ],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        consumer
            .apply(TenantMiddleware)
            .exclude(
                // { path: 'api/v1/auth/register', method: RequestMethod.POST },
                // { path: 'api/v1/auth/login', method: RequestMethod.POST },
                // { path: 'api/health', method: RequestMethod.GET },
                // { path: 'api/docs', method: RequestMethod.GET },
                // { path: 'api/docs/(.*)', method: RequestMethod.GET },
                { path: 'v1/auth/register', method: RequestMethod.POST },
                { path: 'v1/auth/login', method: RequestMethod.POST },
                { path: 'health', method: RequestMethod.GET },
                { path: 'docs', method: RequestMethod.GET },
                { path: 'docs/(.*)', method: RequestMethod.GET },
            )
            .forRoutes('*');
    }
}
