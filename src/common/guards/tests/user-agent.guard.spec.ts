import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserAgentGuard } from '../user-agent.guard';

describe('UserAgentGuard', () => {
  let guard: UserAgentGuard;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserAgentGuard,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'app.blockedUserAgents') {
                return ['test-bot'];
              }
              if (key === 'app.security.strictMode') {
                return false;
              }
              return null;
            }),
          },
        },
      ],
    }).compile();

    guard = module.get<UserAgentGuard>(UserAgentGuard);
    configService = module.get<ConfigService>(ConfigService);
  });

  const createMockExecutionContext = (userAgent?: string, ip?: string): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: userAgent ? { 'user-agent': userAgent } : {},
          ip: ip || '127.0.0.1',
          path: '/test',
          method: 'GET',
        }),
      }),
    } as ExecutionContext;
  };

  describe('canActivate', () => {
    it('should block requests without User-Agent', () => {
      const context = createMockExecutionContext();
      
      expect(() => guard.canActivate(context)).toThrow('Invalid request: User-Agent required');
    });

    it('should block known bot User-Agents', () => {
      const context = createMockExecutionContext('test-bot/1.0');
      
      expect(() => guard.canActivate(context)).toThrow('Access denied');
    });

    it('should block Python requests', () => {
      const context = createMockExecutionContext('python-requests/2.28.1');
      
      expect(() => guard.canActivate(context)).toThrow('Access denied');
    });

    it('should allow valid browser User-Agents', () => {
      const context = createMockExecutionContext(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      );
      
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should block User-Agents that are too short', () => {
      const context = createMockExecutionContext('Bot');
      
      expect(() => guard.canActivate(context)).toThrow('Invalid request');
    });

    it('should block User-Agents that are too long', () => {
      const longUserAgent = 'a'.repeat(501);
      const context = createMockExecutionContext(longUserAgent);
      
      expect(() => guard.canActivate(context)).toThrow('Invalid request');
    });

    it('should detect suspicious patterns', () => {
      const context = createMockExecutionContext('MyBot/1.0 (Web Scraper)');
      
      expect(() => guard.canActivate(context)).toThrow('Access denied');
    });
  });

  describe('strict mode', () => {
    beforeEach(() => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'app.security.strictMode') {
          return true; // Enable strict mode
        }
        return [];
      });
    });

    it('should block non-browser User-Agents in strict mode', () => {
      const context = createMockExecutionContext('CustomApp/1.0');
      
      expect(() => guard.canActivate(context)).toThrow('Access denied');
    });
  });
});
