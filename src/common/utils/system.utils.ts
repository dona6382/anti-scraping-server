/**
 * System Utilities
 */
export class SystemUtils {
  static bytesToMB(bytes: number): number {
    return Math.round(bytes / 1024 / 1024);
  }

  static formatUptime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}h ${m}m ${s}s`;
  }

  static timestamp(): string {
    return new Date().toISOString();
  }
}
