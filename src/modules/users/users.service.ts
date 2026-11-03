import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { users } from '../../database/schema/user.js';
import { eq } from 'drizzle-orm';

@Injectable()
export class UsersService {
  constructor(@Inject('DATABASE_CONNECTION') private readonly db: any) {}

  async GetUser(passedUser: any) {
    console.log(passedUser);
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, passedUser.userId))
      .limit(1);
    if (!user || user.length === 0) {
      throw new NotFoundException('User not found');
    }
    console.log(user);
    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }
}
