import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1711900000000 implements MigrationInterface {
  name = 'InitialSchema1711900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Users table
    await queryRunner.query(`
      CREATE TYPE "users_role_enum" AS ENUM('admin', 'user', 'readonly')
    `);
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "username" character varying(100) NOT NULL,
        "email" character varying(255) NOT NULL,
        "password" character varying(255) NOT NULL,
        "role" "users_role_enum" NOT NULL DEFAULT 'user',
        "isActive" boolean NOT NULL DEFAULT true,
        "tokenVersion" integer NOT NULL DEFAULT 0,
        "failedLoginAttempts" integer NOT NULL DEFAULT 0,
        "lockedUntil" TIMESTAMP,
        "lastLoginAt" TIMESTAMP,
        "lastLoginIp" inet,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_username" UNIQUE ("username"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_users_email" ON "users" ("email")`);
    await queryRunner.query(`CREATE INDEX "IDX_users_username" ON "users" ("username")`);

    // Security Events table
    await queryRunner.query(`
      CREATE TYPE "security_events_eventtype_enum" AS ENUM(
        'IP_BLOCKED', 'IP_UNBLOCKED', 'BOT_DETECTED', 'RATE_LIMITED',
        'HONEYPOT_TRIGGERED', 'USER_AGENT_BLOCKED', 'HEADLESS_BROWSER_DETECTED',
        'SUSPICIOUS_ACTIVITY', 'ADMIN_ACTION', 'SYSTEM_ALERT', 'AUTO_BLOCKED'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "security_events_severity_enum" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
    `);
    await queryRunner.query(`
      CREATE TABLE "security_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "eventType" "security_events_eventtype_enum" NOT NULL,
        "severity" "security_events_severity_enum" NOT NULL DEFAULT 'MEDIUM',
        "ip" inet,
        "userAgent" text,
        "endpoint" character varying(500),
        "method" character varying(20),
        "description" text NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "eventData" json,
        "actions" json,
        CONSTRAINT "PK_security_events" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_security_events_createdAt" ON "security_events" ("createdAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_security_events_eventType" ON "security_events" ("eventType")`);
    await queryRunner.query(`CREATE INDEX "IDX_security_events_ip" ON "security_events" ("ip")`);
    await queryRunner.query(`CREATE INDEX "IDX_security_events_severity_createdAt" ON "security_events" ("severity", "createdAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_security_events_eventType_severity" ON "security_events" ("eventType", "severity")`);

    // Enable uuid-ossp extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "security_events"`);
    await queryRunner.query(`DROP TYPE "security_events_severity_enum"`);
    await queryRunner.query(`DROP TYPE "security_events_eventtype_enum"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "users_role_enum"`);
  }
}
