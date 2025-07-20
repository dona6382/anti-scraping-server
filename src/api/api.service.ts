import { Injectable } from '@nestjs/common';

@Injectable()
export class ApiService {
  getProtectedData(): object {
    return {
      message: 'Success',
      data: `This is protected data. Acquired at ${new Date().toISOString()}`,
    };
  }
}