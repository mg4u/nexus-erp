import {
    Controller,
    Post,
    Body,
    UseGuards,
    HttpCode,
    HttpStatus,
    Version,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AuthService } from '../../application/auth/auth.service';
import { RegisterDto, LoginDto, RefreshTokenDto } from '../../application/auth/dto/auth.dto';
import { JwtAuthGuard, JwtRefreshGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../infrastructure/auth/jwt.strategy';

@ApiTags('Authentication')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('register')
    @ApiOperation({ summary: 'Register a new company and admin user' })
    @ApiResponse({ status: 201, description: 'Tenant and admin user created successfully' })
    @ApiResponse({ status: 409, description: 'Company slug already taken' })
    async register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Login with email/password' })
    @ApiResponse({ status: 200, description: 'Login successful' })
    @ApiResponse({ status: 401, description: 'Invalid credentials' })
    async login(@Body() dto: LoginDto) {
        return this.authService.login(dto);
    }

    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    @UseGuards(JwtRefreshGuard)
    @ApiOperation({ summary: 'Refresh access token using refresh token' })
    @ApiResponse({ status: 200, description: 'Tokens refreshed' })
    async refresh(@Body() dto: RefreshTokenDto, @CurrentUser() payload: JwtPayload) {
        return this.authService.refresh(dto, payload.sub);
    }

    @Post('logout')
    @HttpCode(HttpStatus.OK)
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Logout and invalidate refresh token' })
    async logout(@CurrentUser() user: AuthUser) {
        return this.authService.logout(user.sub);
    }
}
