import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import cookieParser from 'cookie-parser';

import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { users } from '../../database/schema/user.js';
import { JwtPayload } from '../../common/strategies/jwt.strategy.js';

@Injectable()
export class AuthService {
  constructor(
    @Inject('DATABASE_CONNECTION') private readonly db: any,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password } = registerDto;
    const SALT = 10;
    // Check if the user exists in database
    const existingUser = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existingUser > 0) {
      throw new ConflictException('User with this password already exists');
    }

    // Hash Password
    const passwordHash = await bcrypt.hash(password, SALT);

    // Insert user into database
    const [newUser] = await this.db
      .insert(users)
      .values({
        email,
        passwordHash,
      })
      .returning();

    const token = await this.generateTokens(
      newUser.id,
      newUser.email,
      newUser.role,
    );
    await this.updateRefreshTokenHash(newUser.id, token.refreshToken);

    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
      },
      ...token,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const token = await this.generateTokens(user.id, user.email, user.role);
    await this.updateRefreshTokenHash(user.id, token.refreshToken);

    console.log(cookieParser);

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      ...token,
    };
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const payload: JwtPayload = { sub: userId, email, role };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_SECRET!,
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET!,
        expiresIn: '7d',
      }),
    ]);
    return {
      accessToken,
      refreshToken,
    };
  }

  private async updateRefreshTokenHash(userId: string, refreshToken: string) {
    const SALT = 10;
    const hashedRefreshToken = await bcrypt.hash(refreshToken, SALT);
    await this.db
      .update(users)
      .set({ hashedRefreshToken })
      .where(eq(users.id, userId));
  }
}
