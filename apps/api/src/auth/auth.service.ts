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
    // For now, this is a simple environment-based validation
    // In production, this would validate against a database with hashed passwords
    const adminPassword = process.env.ADMIN_PASSWORD;
    const userPassword = process.env.USER_PASSWORD;

    if (!adminPassword || !userPassword) {
      throw new Error('Authentication credentials not configured. Set ADMIN_PASSWORD and USER_PASSWORD environment variables.');
    }

    if (username === 'admin' && password === adminPassword) {
      return {
        id: '1',
        username: 'admin',
        roles: ['admin'],
      };
    }

    if (username === 'user' && password === userPassword) {
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