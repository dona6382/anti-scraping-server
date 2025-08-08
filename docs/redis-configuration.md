# Redis Configuration Guide

## 📌 Overview

이 프로젝트는 Redis를 다양한 용도로 사용합니다:
- **Rate Limiting**: 요청 비율 제한
- **IP Blacklist**: IP 차단 목록 관리
- **Session Storage**: 세션 데이터 저장
- **Cache**: 임시 데이터 캐싱

## 🔧 Configuration Files

### 1. `redis.config.ts`
Redis 연결 및 설정을 관리하는 메인 설정 파일입니다.

### 2. `redis.service.ts`
Redis 클라이언트를 관리하고 래퍼 메서드를 제공하는 서비스입니다.

### 3. `redis.module.ts`
Redis 서비스를 전역으로 제공하는 모듈입니다.

## 🚀 Connection Modes

### 1. Single Instance Mode (기본)
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=yourpassword
```

### 2. Sentinel Mode (고가용성)
```env
REDIS_SENTINEL_ENABLED=true
REDIS_SENTINELS=sentinel1:26379,sentinel2:26379,sentinel3:26379
REDIS_SENTINEL_NAME=mymaster
REDIS_SENTINEL_PASSWORD=sentinelpass
```

### 3. Cluster Mode (확장성)
```env
REDIS_CLUSTER_ENABLED=true
REDIS_CLUSTER_NODES=node1:6379,node2:6379,node3:6379
```

### 4. TLS/SSL Connection
```env
REDIS_TLS_ENABLED=true
REDIS_TLS_REJECT_UNAUTHORIZED=true
REDIS_TLS_CA=/path/to/ca.pem
REDIS_TLS_CERT=/path/to/cert.pem
REDIS_TLS_KEY=/path/to/key.pem
```

## 📊 Performance Optimization

### Auto-Pipelining
자동으로 명령어를 파이프라이닝하여 성능 향상:
```env
REDIS_AUTO_PIPELINING=true
```

### Connection Pool
연결 풀 설정:
```env
REDIS_POOL_MIN=2
REDIS_POOL_MAX=10
```

### Lazy Connect
필요할 때만 연결:
```env
REDIS_LAZY_CONNECT=true
```

## 🔍 Monitoring

### Health Check Endpoints

#### 1. Overall Health
```bash
GET /health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "server": "running",
    "redis": {
      "connected": true,
      "status": "ready",
      "stats": {
        "commandsSent": 1000,
        "commandsFailed": 0,
        "reconnections": 0,
        "uptime": 3600000
      }
    },
    "blacklist": {
      "totalBlacklisted": 10,
      "memoryBlacklisted": 5,
      "redisConnected": true
    }
  }
}
```

#### 2. Redis Health
```bash
GET /health/redis
```

### Monitoring Settings
```env
REDIS_MONITORING_ENABLED=true
REDIS_LOG_SLOW_COMMANDS=true
REDIS_SLOW_LOG_THRESHOLD=100
```

## 🗝️ Key Namespaces

Redis 키는 다음과 같은 네임스페이스를 사용합니다:

| Namespace | Pattern | Example | Description |
|-----------|---------|---------|-------------|
| Global | `anti-scraping:*` | `anti-scraping:config` | 전역 설정 |
| Blacklist | `anti-scraping:blacklist:*` | `anti-scraping:blacklist:ip:192.168.1.1` | IP 블랙리스트 |
| Rate Limit | `anti-scraping:rate-limit:*` | `anti-scraping:rate-limit:192.168.1.1` | Rate limiting |
| Session | `anti-scraping:session:*` | `anti-scraping:session:abc123` | 세션 데이터 |
| Cache | `anti-scraping:cache:*` | `anti-scraping:cache:user:123` | 캐시 데이터 |

## 🔄 Fallback Strategy

Redis 연결 실패 시 자동으로 메모리 모드로 전환:

1. **메모리 캐시**: Redis 없이도 기본 기능 동작
2. **자동 재연결**: 백그라운드에서 재연결 시도
3. **데이터 동기화**: 재연결 시 메모리 데이터를 Redis로 동기화

## 📝 Usage Examples

### Using RedisService

```typescript
import { Injectable } from '@nestjs/common';
import { RedisService } from './common/services/redis.service';

@Injectable()
export class MyService {
  constructor(private redisService: RedisService) {}

  async saveData(key: string, value: any, ttl?: number) {
    // TTL과 함께 저장
    await this.redisService.set(key, value, ttl);
  }

  async getData(key: string) {
    // 데이터 조회
    return await this.redisService.get(key);
  }

  async deleteData(key: string) {
    // 데이터 삭제
    await this.redisService.del(key);
  }

  async checkTTL(key: string) {
    // TTL 확인
    const ttl = await this.redisService.ttl(key);
    console.log(`Key expires in ${ttl} seconds`);
  }
}
```

### Direct Client Access

```typescript
// node-redis 클라이언트 직접 사용
const client = this.redisService.getClient();
if (client) {
  await client.hSet('hash:key', 'field', 'value');
}

// ioredis 클라이언트 직접 사용 (고급 기능)
const ioredis = this.redisService.getIoredisClient();
if (ioredis) {
  const pipeline = ioredis.pipeline();
  pipeline.set('key1', 'value1');
  pipeline.set('key2', 'value2');
  await pipeline.exec();
}
```

## 🐳 Docker Setup

### Redis with Docker

```bash
# Single Redis instance
docker run -d \
  --name redis \
  -p 6379:6379 \
  -v redis-data:/data \
  redis:latest redis-server --appendonly yes

# Redis with password
docker run -d \
  --name redis \
  -p 6379:6379 \
  -v redis-data:/data \
  redis:latest redis-server --appendonly yes --requirepass yourpassword
```

### Docker Compose

```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    container_name: anti-scraping-redis
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    restart: unless-stopped

  redis-commander:
    image: rediscommander/redis-commander:latest
    container_name: redis-commander
    environment:
      - REDIS_HOSTS=local:redis:6379:0:${REDIS_PASSWORD}
    ports:
      - "8081:8081"
    depends_on:
      - redis
    restart: unless-stopped

volumes:
  redis-data:
```

## 🛠️ Troubleshooting

### Common Issues

#### 1. Connection Refused
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```
**Solution**: Redis 서버가 실행 중인지 확인
```bash
redis-cli ping
```

#### 2. Authentication Failed
```
Error: NOAUTH Authentication required
```
**Solution**: 올바른 비밀번호 설정
```env
REDIS_PASSWORD=correct_password
```

#### 3. Memory Issues
```
Error: OOM command not allowed when used memory > 'maxmemory'
```
**Solution**: Redis 메모리 설정 조정
```bash
redis-cli CONFIG SET maxmemory 2gb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

#### 4. Connection Timeout
```
Error: Connection timeout
```
**Solution**: 타임아웃 설정 증가
```env
REDIS_CONNECT_TIMEOUT=30000
```

## 📈 Best Practices

1. **Connection Management**
   - 연결 풀 사용
   - 적절한 타임아웃 설정
   - 재연결 전략 구성

2. **Key Management**
   - 일관된 네임스페이스 사용
   - TTL 설정으로 메모리 관리
   - 키 이름은 짧고 명확하게

3. **Security**
   - 강력한 비밀번호 사용
   - TLS/SSL 활성화
   - IP 화이트리스트 설정

4. **Performance**
   - 파이프라이닝 활용
   - 적절한 데이터 구조 선택
   - 불필요한 데이터 정리

5. **Monitoring**
   - 슬로우 쿼리 모니터링
   - 메모리 사용량 추적
   - 연결 상태 확인

## 📚 References

- [Redis Documentation](https://redis.io/documentation)
- [node-redis](https://github.com/redis/node-redis)
- [ioredis](https://github.com/luin/ioredis)
- [Redis Best Practices](https://redis.io/docs/manual/patterns/)
