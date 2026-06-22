import { PaginationQueryDto } from '../dto/pagination-query.dto';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface PaginatableDelegate<T> {
  findMany(args: any): Promise<T[]>;
  count(args: { where?: any }): Promise<number>;
}

/**
 * Runs a paginated `findMany` + `count` against any Prisma delegate.
 */
export async function paginate<T>(
  delegate: PaginatableDelegate<T>,
  query: PaginationQueryDto,
  args: { where?: any; orderBy?: any; include?: any; select?: any } = {},
): Promise<PaginatedResult<T>> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const [data, total] = await Promise.all([
    delegate.findMany({ ...args, skip, take: pageSize }),
    delegate.count({ where: args.where }),
  ]);

  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
