/// <reference types="node" />

declare global {
  namespace Express {
    interface Request {
      id?: string;
      securityFailures?: Array<{
        guard: string;
        timestamp: string;
        message: string;
      }>;
    }
  }
}

export {};
