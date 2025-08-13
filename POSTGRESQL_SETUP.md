# PostgreSQL 연동 설치 가이드

## 📦 필요한 패키지 설치

```bash
npm install @nestjs/typeorm typeorm pg @types/pg
```

## 🔧 활성화 단계

### 1. DatabaseModule 복원
```bash
# DELETED_FILES_BACKUP에서 database_module을 src/modules/database로 복사
cp -r /Users/marqvision/Desktop/kch/DELETED_FILES_BACKUP/database_module /Users/marqvision/Desktop/kch/anti-scraping-server/src/modules/database
```

### 2. App.module.ts 수정
```typescript
// 주석 해제
import { DatabaseModule } from './modules/database/database.module';

@Module({
  imports: [
    ConfigurationModule,
    DatabaseModule, // 주석 해제
    CommonModule,
    // ...
  ],
})
```

### 3. HealthService 수정
```typescript
// 주석 해제
import { DatabaseService } from '../database/database.service';

constructor(
  @Optional() private readonly databaseService?: DatabaseService // 주석 해제
) {}

// checkDatabase() 메서드의 주석 해제
```

## 🗃️ 데이터베이스 설정

환경변수는 이미 설정되어 있습니다:
- DB_HOST=localhost
- DB_PORT=5432
- DB_USERNAME=p_user
- DB_PASSWORD=p_pw
- DB_NAME=p_db

## ✅ 설치 완료 후 확인

```bash
# 서버 시작
npm run start:dev

# 헬스 체크
curl http://localhost:3000/health
```

PostgreSQL 연결이 성공하면 헬스 체크에서 database 상태가 'healthy'로 표시됩니다.
