import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from '../../application/orders/orders.service';

@Module({ controllers: [OrdersController], providers: [OrdersService] })
export class OrdersModule { }
