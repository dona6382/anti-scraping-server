import { Injectable } from '@nestjs/common';
import { ResponseBuilder } from '../../common/utils/response.builder';
import { SystemUtils } from '../../common/utils/system.utils';

@Injectable()
export class PublicService {
  async getPublicData() {
    return ResponseBuilder.success({
      message: 'Public data access successful',
      items: this.generateSampleItems(),
    });
  }

  async searchData(query: string, limit: number) {
    const results = Array.from({ length: Math.min(limit, 10) }, (_, i) => ({
      id: i + 1,
      title: `Result ${i + 1} for "${query}"`,
      description: `Sample result for: ${query}`,
      relevance: Math.random() * 100,
      category: ['Technology', 'Science', 'Business'][i % 3],
    }));

    return ResponseBuilder.success({ query, results, total: results.length, limit });
  }

  async getPublicStats() {
    return ResponseBuilder.success({
      totalRequests: Math.floor(Math.random() * 10000) + 1000,
      activeUsers: Math.floor(Math.random() * 500) + 50,
      systemStatus: 'operational',
      uptime: SystemUtils.formatUptime(process.uptime()),
    });
  }

  async getCategories() {
    return ResponseBuilder.success([
      { id: 1, name: 'Technology', description: 'Technology related content', itemCount: 150 },
      { id: 2, name: 'Science', description: 'Scientific articles and research', itemCount: 89 },
      { id: 3, name: 'Business', description: 'Business and economy news', itemCount: 234 },
    ]);
  }

  async getHealthStatus() {
    return ResponseBuilder.success({
      status: 'healthy',
      version: '2.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: SystemUtils.formatUptime(process.uptime()),
    });
  }

  private generateSampleItems() {
    return Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      name: `Public Item ${i + 1}`,
      description: `Sample public data item #${i + 1}`,
      category: ['Technology', 'Science', 'Business'][i % 3],
      createdAt: new Date(Date.now() - Math.random() * 86400000 * 30).toISOString(),
      isPublic: true,
    }));
  }
}
