import { Injectable, Logger } from '@nestjs/common';
import {
  ContactFormDto,
  SearchQueryDto,
  CreateUserDto,
  UpdateUserDto,
  PaginationDto,
  PaginatedResponse,
} from './dto/api.dto';
import { ResourceNotFoundException } from '../../core/domain/exceptions/domain.exceptions';

/**
 * API Business Logic Service
 * 실제 비즈니스 로직을 처리하는 서비스
 */
@Injectable()
export class ApiBusinessService {
  private readonly logger = new Logger(ApiBusinessService.name);
  
  // Mock data store (in production, use a database)
  private users = new Map<string, any>();
  private messages = new Map<string, any>();
  private searchHistory = new Map<string, any[]>();

  constructor() {
    // Initialize with sample data
    this.initializeSampleData();
  }

  /**
   * Process contact form submission
   */
  async processContactForm(dto: ContactFormDto): Promise<any> {
    this.logger.log(`Processing contact form from ${dto.email}`);
    
    // Validate business rules
    if (this.isDuplicateSubmission(dto.email)) {
      throw new Error('Duplicate submission detected. Please wait before submitting again.');
    }
    
    // Store message
    const messageId = this.generateId('MSG');
    const message = {
      id: messageId,
      name: dto.name,
      email: dto.email,
      message: dto.message,
      createdAt: new Date(),
      status: 'pending',
    };
    
    this.messages.set(messageId, message);
    
    // In production, send email notification
    await this.sendNotification(message);
    
    return {
      id: messageId,
      status: 'submitted',
      message: 'Thank you for your message. We will respond within 24 hours.',
    };
  }

  /**
   * Search functionality
   */
  async search(dto: SearchQueryDto): Promise<PaginatedResponse<any>> {
    this.logger.log(`Search query: ${dto.query}`);
    
    // Track search history
    this.trackSearch(dto.query);
    
    // Mock search results
    const results = this.generateSearchResults(dto.query, dto.limit || 10);
    
    return new PaginatedResponse(
      results,
      results.length * 10, // Mock total
      dto.page || 1,
      dto.limit || 10
    );
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<any> {
    const user = this.users.get(id);
    
    if (!user) {
      throw new ResourceNotFoundException('User', id);
    }
    
    return user;
  }

  /**
   * Get all users with pagination
   */
  async getUsers(pagination: PaginationDto): Promise<PaginatedResponse<any>> {
    const allUsers = Array.from(this.users.values());
    const start = pagination.skip;
    const end = start + pagination.limit;
    
    const paginatedUsers = allUsers.slice(start, end);
    
    return new PaginatedResponse(
      paginatedUsers,
      allUsers.length,
      pagination.page,
      pagination.limit
    );
  }

  /**
   * Create new user
   */
  async createUser(dto: CreateUserDto): Promise<any> {
    this.logger.log(`Creating user: ${dto.username}`);
    
    // Check if username exists
    const existingUser = Array.from(this.users.values())
      .find(u => u.username === dto.username);
    
    if (existingUser) {
      throw new Error(`Username ${dto.username} already exists`);
    }
    
    const userId = this.generateId('USR');
    const user = {
      id: userId,
      ...dto,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
    };
    
    this.users.set(userId, user);
    
    return user;
  }

  /**
   * Update user
   */
  async updateUser(id: string, dto: UpdateUserDto): Promise<any> {
    const user = await this.getUserById(id);
    
    const updatedUser = {
      ...user,
      ...dto,
      updatedAt: new Date(),
    };
    
    this.users.set(id, updatedUser);
    
    return updatedUser;
  }

  /**
   * Delete user
   */
  async deleteUser(id: string): Promise<void> {
    const user = await this.getUserById(id);
    
    // Soft delete
    user.isActive = false;
    user.deletedAt = new Date();
    
    this.users.set(id, user);
    
    this.logger.log(`User ${id} soft deleted`);
  }

  /**
   * Get dashboard data
   */
  async getDashboardData(): Promise<any> {
    const totalUsers = this.users.size;
    const activeUsers = Array.from(this.users.values())
      .filter(u => u.isActive).length;
    const totalMessages = this.messages.size;
    const pendingMessages = Array.from(this.messages.values())
      .filter(m => m.status === 'pending').length;
    
    // Get recent activity
    const recentUsers = Array.from(this.users.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5);
    
    const recentMessages = Array.from(this.messages.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5);
    
    // Get popular searches
    const popularSearches = this.getPopularSearches();
    
    return {
      stats: {
        totalUsers,
        activeUsers,
        totalMessages,
        pendingMessages,
      },
      recent: {
        users: recentUsers,
        messages: recentMessages,
      },
      insights: {
        popularSearches,
        userGrowthRate: this.calculateGrowthRate(),
        averageResponseTime: '2.3 hours',
      },
      timestamp: new Date(),
    };
  }

  /**
   * Check for duplicate submission
   */
  private isDuplicateSubmission(email: string): boolean {
    const recentMessages = Array.from(this.messages.values())
      .filter(m => m.email === email)
      .filter(m => {
        const timeDiff = Date.now() - m.createdAt.getTime();
        return timeDiff < 60000; // Within 1 minute
      });
    
    return recentMessages.length > 0;
  }

  /**
   * Send notification (mock)
   */
  private async sendNotification(message: any): Promise<void> {
    // In production, integrate with email service
    this.logger.log(`Notification sent for message ${message.id}`);
  }

  /**
   * Track search query
   */
  private trackSearch(query: string): void {
    const history = this.searchHistory.get(query) || [];
    history.push({
      timestamp: new Date(),
      count: history.length + 1,
    });
    this.searchHistory.set(query, history);
  }

  /**
   * Generate search results (mock)
   */
  private generateSearchResults(query: string, limit: number): any[] {
    const results = [];
    for (let i = 1; i <= limit; i++) {
      results.push({
        id: `RESULT-${i}`,
        title: `Result for "${query}" #${i}`,
        description: `This is a sample search result for the query "${query}"`,
        relevance: Math.random(),
        url: `/result/${i}`,
        category: ['Technology', 'Business', 'Science'][Math.floor(Math.random() * 3)],
      });
    }
    return results.sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Get popular searches
   */
  private getPopularSearches(): any[] {
    const searches = Array.from(this.searchHistory.entries())
      .map(([query, history]) => ({
        query,
        count: history.length,
        lastSearched: history[history.length - 1]?.timestamp,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    return searches;
  }

  /**
   * Calculate growth rate (mock)
   */
  private calculateGrowthRate(): string {
    // Mock calculation
    const currentMonth = Array.from(this.users.values())
      .filter(u => {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return u.createdAt > monthAgo;
      }).length;
    
    return `+${currentMonth * 12}%`;
  }

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Initialize sample data
   */
  private initializeSampleData(): void {
    // Add sample users
    for (let i = 1; i <= 20; i++) {
      const userId = this.generateId('USR');
      this.users.set(userId, {
        id: userId,
        username: `user${i}`,
        email: `user${i}@example.com`,
        firstName: `First${i}`,
        lastName: `Last${i}`,
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
        isActive: Math.random() > 0.2,
      });
    }
    
    // Add sample messages
    for (let i = 1; i <= 10; i++) {
      const messageId = this.generateId('MSG');
      this.messages.set(messageId, {
        id: messageId,
        name: `Sender ${i}`,
        email: `sender${i}@example.com`,
        message: `This is a sample message #${i}`,
        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        status: Math.random() > 0.5 ? 'pending' : 'resolved',
      });
    }
    
    // Add sample search history
    const sampleQueries = ['nodejs', 'typescript', 'nestjs', 'security', 'api'];
    sampleQueries.forEach(query => {
      const history = [];
      for (let i = 0; i < Math.floor(Math.random() * 10) + 1; i++) {
        history.push({
          timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
          count: i + 1,
        });
      }
      this.searchHistory.set(query, history);
    });
  }
}
