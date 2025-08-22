import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from './strategies/jwt.strategy';

export interface User {
  id: string;
  username: string;
  roles: string[];
}

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async generateToken(user: User): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      roles: user.roles,
    };

    return this.jwtService.signAsync(payload);
  }

  async validateUser(username: string, password: string): Promise<User | null> {
    // For now, this is a simple hardcoded validation
    // In production, this would validate against a database with hashed passwords
    if (username === 'admin' && password === 'admin_password_change_in_production') {
      return {
        id: '1',
        username: 'admin',
        roles: ['admin'],
      };
    }

    if (username === 'user' && password === 'user_password_change_in_production') {
      return {
        id: '2',
        username: 'user',
        roles: ['user'],
      };
    }

    return null;
  }

  async login(user: User) {
    const token = await this.generateToken(user);
    return {
      access_token: token,
      user: {
        id: user.id,
        username: user.username,
        roles: user.roles,
      },
    };
  }
}