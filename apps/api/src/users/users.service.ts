import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findByKakaoId(kakaoId: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { kakaoId } });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id }, relations: ['sajuProfile'] });
  }

  async createFromKakao(kakaoId: string, nickname: string, gender?: string): Promise<User> {
    const user = this.userRepo.create({
      kakaoId,
      nickname,
      gender: (gender as 'male' | 'female') || 'male',
    });
    return this.userRepo.save(user);
  }

  async update(id: string, data: Partial<User>): Promise<User | null> {
    await this.userRepo.update(id, data);
    return this.findById(id);
  }
}
