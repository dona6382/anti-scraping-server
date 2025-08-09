/**
 * Base Repository Interface
 * 모든 Repository가 구현해야 할 기본 인터페이스
 */
export interface IBaseRepository<T> {
  findById(id: string): Promise<T | null>;
  findAll(filter?: any): Promise<T[]>;
  findOne(filter: any): Promise<T | null>;
  create(entity: T): Promise<T>;
  update(id: string, entity: Partial<T>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
  count(filter?: any): Promise<number>;
  exists(id: string): Promise<boolean>;
}

/**
 * Pagination Options
 */
export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated Result
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Repository with Pagination
 */
export interface IPaginatedRepository<T> extends IBaseRepository<T> {
  findPaginated(
    filter: any,
    options: PaginationOptions
  ): Promise<PaginatedResult<T>>;
}
