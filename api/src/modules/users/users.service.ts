import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument, UserStatus } from './schemas/user.schema';
import { CreateUserDto, UpdateUserDto, ChangePasswordDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async create(dto: CreateUserDto, createdBy?: string): Promise<UserDocument> {
    const existing = await this.userModel.findOne({
      $or: [{ username: dto.username }, { email: dto.email }],
    });
    if (existing) {
      throw new ConflictException('Usuário ou e-mail já cadastrado');
    }

    const hash = await bcrypt.hash(dto.password, 12);
    const user = new this.userModel({
      ...dto,
      password: hash,
      createdBy: createdBy ? new Types.ObjectId(createdBy) : undefined,
    });
    return user.save();
  }

  async findAll(filters: { role?: string; status?: string } = {}): Promise<UserDocument[]> {
    const query: any = {};
    if (filters.role) query.role = filters.role;
    if (filters.status) query.status = filters.status;
    return this.userModel.find(query).select('-password -refreshToken -twoFactorSecret').exec();
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel
      .findById(id)
      .select('-password -refreshToken -twoFactorSecret')
      .exec();
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  async findByUsername(username: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ username: username.toLowerCase() }).select('+password').exec();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).select('+password').exec();
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserDocument> {
    const update: any = { ...dto };
    if (dto.password) {
      update.password = await bcrypt.hash(dto.password, 12);
      update.lastPasswordChange = new Date();
    }
    const user = await this.userModel
      .findByIdAndUpdate(id, { $set: update }, { new: true })
      .select('-password -refreshToken -twoFactorSecret')
      .exec();
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  async changePassword(id: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.userModel.findById(id).select('+password').exec();
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const valid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!valid) throw new UnauthorizedException('Senha atual incorreta');

    user.password = await bcrypt.hash(dto.newPassword, 12);
    user.lastPasswordChange = new Date();
    await user.save();
  }

  async remove(id: string): Promise<void> {
    const result = await this.userModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('Usuário não encontrado');
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(id, { $set: { lastLogin: new Date(), loginAttempts: 0 } }).exec();
  }

  async incrementLoginAttempts(id: string): Promise<number> {
    const user = await this.userModel
      .findByIdAndUpdate(id, { $inc: { loginAttempts: 1 } }, { new: true })
      .exec();
    return user?.loginAttempts || 0;
  }

  async blockUser(id: string, until: Date): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(id, { $set: { status: UserStatus.BLOCKED, blockedUntil: until } })
      .exec();
  }

  async saveRefreshToken(id: string, token: string): Promise<void> {
    const hash = await bcrypt.hash(token, 10);
    await this.userModel.findByIdAndUpdate(id, { $set: { refreshToken: hash } }).exec();
  }

  async validateRefreshToken(id: string, token: string): Promise<boolean> {
    const user = await this.userModel.findById(id).select('+refreshToken').exec();
    if (!user?.refreshToken) return false;
    return bcrypt.compare(token, user.refreshToken);
  }

  async clearRefreshToken(id: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(id, { $unset: { refreshToken: 1 } }).exec();
  }

  async validatePassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  async ensureSuperAdmin(): Promise<void> {
    const count = await this.userModel.countDocuments().exec();
    if (count === 0) {
      this.logger.log('Nenhum usuário encontrado. Criando super admin padrão...');
      await this.create({
        username: 'admin',
        email: 'admin@br10acs.local',
        password: 'Admin@br10acs',
        name: 'Administrador',
        role: 'super_admin' as any,
      });
      this.logger.warn('Super admin criado: admin / Admin@br10acs — ALTERE A SENHA!');
    }
  }
}
