/**
 * Pagination Utilities
 */
export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export class PaginationUtils {
  static parse(page?: number, limit?: number, maxLimit = 100): PaginationParams {
    const p = Math.max(page ?? 1, 1);
    const l = Math.min(Math.max(limit ?? 50, 1), maxLimit);
    return { page: p, limit: l, skip: (p - 1) * l };
  }

  static meta(page: number, limit: number, total: number): PaginationMeta {
    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }
}
