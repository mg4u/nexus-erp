import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountsService } from '../../application/accounts/accounts.service';
import { AccountCacheService } from '../../infrastructure/accounts/account-cache.service';

@Module({
    controllers: [AccountsController],
    providers: [AccountsService, AccountCacheService],
    exports: [AccountsService],
})
export class AccountsModule { }
