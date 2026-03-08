import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '@prisma/client';

export interface AuthUser {
    sub: string;
    email: string;
    role: UserRole;
    tenantId: string;
}

export const CurrentUser = createParamDecorator(
    (data: keyof AuthUser | undefined, ctx: ExecutionContext): AuthUser | AuthUser[keyof AuthUser] => {
        const request = ctx.switchToHttp().getRequest<Request & { user: AuthUser }>();
        const user = request.user;
        return data ? user?.[data] : user;
    },
);
