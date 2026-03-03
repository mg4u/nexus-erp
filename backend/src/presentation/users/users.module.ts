import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from '../../application/users/users.service';

@Module({ controllers: [UsersController], providers: [UsersService] })
export class UsersModule { }
