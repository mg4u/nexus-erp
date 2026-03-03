import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';

export interface JwtPayload {
    sub: string;
    email: string;
    role: string;
    tenantId: string;
    iat?: number;
    exp?: number;
}

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt-access') {
    constructor(
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('jwt.accessSecret'),
        });
    }

    async validate(payload: JwtPayload): Promise<AuthUser> {
        const user = await this.prisma.user.findFirst({
            where: { id: payload.sub, tenantId: payload.tenantId, isActive: true },
            select: { id: true, email: true, role: true, tenantId: true, isActive: true },
        });

        if (!user) {
            throw new UnauthorizedException('User not found or inactive');
        }

        return {
            sub: user.id,
            email: user.email,
            role: user.role,
            tenantId: user.tenantId,
        };
    }
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
    constructor(configService: ConfigService) {
        super({
            jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('jwt.refreshSecret'),
            passReqToCallback: false,
        });
    }

    validate(payload: JwtPayload): JwtPayload {
        return payload;
    }
}
