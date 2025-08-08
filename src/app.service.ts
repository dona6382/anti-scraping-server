import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return JSON.stringify({
      message: 'Anti-Scraping Server is running',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      documentation: '/public/index.html',
    });
  }
}
