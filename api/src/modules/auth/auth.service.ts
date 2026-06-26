import {
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { UserDocument, UserStatus } from '../users/schemas/user.schema';
import { LoginDto, RefreshTokenDto } from './dto/auth.dto';
import { LogsService } from '../logs/logs.service';
import { LogCategory } from '../logs/schemas/log.schema';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    username: string;
    name: string;
    email: string;
    role: string;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly BLOCK_DURATION_MINUTES = 30;

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private logsService: LogsService,
  ) {}

  async validateUser(username: string, password: string): Promise<UserDocument | null> {
    const user = await this.usersService.findByUsername(username);
    if (!user) {
      await this.logsService.warn(`Tentativa de login com usuário inexistente: ${username}`, LogCategory.AUTH, { username }).catch(() => {});
      return null;
    }

    // Verificar bloqueio
    if (user.status === UserStatus.BLOCKED) {
      if (user.blockedUntil && user.blockedUntil > new Date()) {
        throw new UnauthorizedException(
          `Conta bloqueada até ${user.blockedUntil.toLocaleString('pt-BR')}`,
        );
      }
    }

    const userId = (user as any)._id?.toString();
    const valid = await this.usersService.validatePassword(password, user.password);
    if (!valid) {
      const attempts = await this.usersService.incrementLoginAttempts(userId);
      if (attempts >= this.MAX_LOGIN_ATTEMPTS) {
        const blockedUntil = new Date(
          Date.now() + this.BLOCK_DURATION_MINUTES * 60 * 1000,
        );
        await this.usersService.blockUser(userId, blockedUntil);
                this.logger.warn(`Usuário ${username} bloqueado por ${this.BLOCK_DURATION_MINUTES} minutos`);
        await this.logsService.warn(`Usuário ${username} bloqueado após ${attempts} tentativas`, LogCategory.AUTH, { username, attempts, blockedUntil }, undefined, userId).catch(() => {});
      } else {
        await this.logsService.warn(`Senha incorreta para ${username} (tentativa ${attempts}/${this.MAX_LOGIN_ATTEMPTS})`, LogCategory.AUTH, { username, attempts }, undefined, userId).catch(() => {});
      }
      return null;
    }
    return user;
  }

  async login(dto: LoginDto): Promise<TokenPair> {
    const user = await this.validateUser(dto.username, dto.password);
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Conta inativa ou bloqueada');
    }

    const userId = (user as any)._id?.toString();
    await this.usersService.updateLastLogin(userId);
    await this.logsService.info(`Login realizado: ${user.username}`, LogCategory.AUTH, { username: user.username, role: user.role }, undefined, userId).catch(() => {});
    return this.generateTokens(user);
  }

  async refreshToken(dto: RefreshTokenDto): Promise<TokenPair> {
    let payload: any;
    try {
      payload = this.jwtService.verify(dto.refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    const valid = await this.usersService.validateRefreshToken(payload.sub, dto.refreshToken);
    if (!valid) throw new UnauthorizedException('Refresh token inválido');

    const user = await this.usersService.findById(payload.sub) as any;
    return this.generateTokens(user);
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.clearRefreshToken(userId);
    await this.logsService.info(`Logout realizado`, LogCategory.AUTH, {}, undefined, userId).catch(() => {});
  }

  private async generateTokens(user: UserDocument): Promise<TokenPair> {
    const userId = (user as any)._id?.toString() || (user as any).id;
    const payload = { sub: userId, username: user.username, role: user.role };
    const expiresIn = this.configService.get<string>('jwt.expiresIn') || '24h';

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.secret'),
      expiresIn: expiresIn as any,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: (this.configService.get<string>('jwt.refreshExpiresIn') || '7d') as any,
    });

    await this.usersService.saveRefreshToken(userId, refreshToken);

    const expSeconds = expiresIn.endsWith('h')
      ? parseInt(expiresIn) * 3600
      : expiresIn.endsWith('d')
      ? parseInt(expiresIn) * 86400
      : 86400;

    return {
      accessToken,
      refreshToken,
      expiresIn: expSeconds,
      user: {
        id: userId,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }
}
