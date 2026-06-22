import { paginate } from './pagination.helper';

describe('paginate', () => {
  const makeDelegate = (rows: number[], total: number) => ({
    findMany: jest.fn().mockResolvedValue(rows),
    count: jest.fn().mockResolvedValue(total),
  });

  it('applies skip/take from page and pageSize', async () => {
    const delegate = makeDelegate([4, 5, 6], 25);
    const result = await paginate(delegate, { page: 2, pageSize: 3 }, { where: { x: 1 } });

    expect(delegate.findMany).toHaveBeenCalledWith({ where: { x: 1 }, skip: 3, take: 3 });
    expect(delegate.count).toHaveBeenCalledWith({ where: { x: 1 } });
    expect(result).toEqual({ data: [4, 5, 6], total: 25, page: 2, pageSize: 3, totalPages: 9 });
  });

  it('defaults to page 1 / pageSize 20', async () => {
    const delegate = makeDelegate([], 0);
    const result = await paginate(delegate, {});

    expect(delegate.findMany).toHaveBeenCalledWith({ skip: 0, take: 20 });
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it('always reports at least 1 total page', async () => {
    const delegate = makeDelegate([], 0);
    const result = await paginate(delegate, { page: 1, pageSize: 10 });
    expect(result.totalPages).toBe(1);
  });
});
