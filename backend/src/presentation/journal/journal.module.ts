import { Module } from '@nestjs/common';
import { JournalController } from './journal.controller';
import { JournalService } from '../../application/journal/journal.service';
import { JournalCacheService } from '../../infrastructure/journal/journal-cache.service';

@Module({
    controllers: [JournalController],
    providers: [JournalService, JournalCacheService],
    exports: [JournalService],
})
export class JournalModule { }
