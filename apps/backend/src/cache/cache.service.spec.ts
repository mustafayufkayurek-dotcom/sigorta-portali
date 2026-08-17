import { CacheService } from './cache.service';

describe('CacheService', () => {
  const originalCacheEnabled = process.env.CACHE_ENABLED;
  const originalRedisUrl = process.env.REDIS_URL;

  beforeEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
    process.env.REDIS_URL = 'redis://localhost:6379';
  });

  afterAll(() => {
    process.env.CACHE_ENABLED = originalCacheEnabled;
    process.env.REDIS_URL = originalRedisUrl;
  });

  it('CACHE_ENABLED=false iken get null doner ve redis cagrilmaz', async () => {
    process.env.CACHE_ENABLED = 'false';
    const service = new CacheService();
    const getSpy = jest.spyOn((service as any).client, 'get');

    const result = await service.get('test:key');

    expect(result).toBeNull();
    expect(getSpy).not.toHaveBeenCalled();
  });

  it('CACHE_ENABLED=true iken set sonrasi get ayni payloadu doner', async () => {
    process.env.CACHE_ENABLED = 'true';
    const service = new CacheService();
    const store = new Map<string, string>();
    jest.spyOn((service as any).client, 'set').mockImplementation(async (...args: any[]) => {
      store.set(args[0], args[1]);
      return 'OK';
    });
    jest.spyOn((service as any).client, 'get').mockImplementation(async (...args: any[]) => {
      return store.get(args[0]) ?? null;
    });

    const payload = { a: 1, b: 'x' };
    await service.set('k1', payload, 30);
    const result = await service.get<typeof payload>('k1');

    expect(result).toEqual(payload);
  });

  it('Redis throw durumunda get ve set exception firlatmaz', async () => {
    process.env.CACHE_ENABLED = 'true';
    const service = new CacheService();
    jest.spyOn((service as any).client, 'get').mockRejectedValue(new Error('redis down'));
    jest.spyOn((service as any).client, 'set').mockRejectedValue(new Error('redis down'));

    await expect(service.get('k2')).resolves.toBeNull();
    await expect(service.set('k2', { x: 1 }, 10)).resolves.toBeUndefined();
  });

  it('invalidatePattern SCAN kullanir, KEYS kullanmaz', async () => {
    process.env.CACHE_ENABLED = 'true';
    const service = new CacheService();
    const scanSpy = jest
      .spyOn((service as any).client, 'scan')
      .mockResolvedValueOnce(['1', ['a', 'b']] as any)
      .mockResolvedValueOnce(['0', ['c']] as any);
    const delSpy = jest.spyOn((service as any).client, 'del').mockResolvedValue(1 as any);
    const keysSpy = jest.spyOn((service as any).client as any, 'keys');

    const deleted = await service.invalidatePattern('cache:v1:*');

    expect(scanSpy).toHaveBeenCalled();
    expect(delSpy).toHaveBeenCalled();
    expect(keysSpy).not.toHaveBeenCalled();
    expect(deleted).toBe(2);
  });

  it('get MISS sayar (redis null)', async () => {
    process.env.CACHE_ENABLED = 'true';
    const service = new CacheService();
    jest.spyOn((service as any).client, 'get').mockResolvedValue(null);

    await service.get('cache:v1:dashboard:operations:r:shared');
    const stats = service.getStats();

    expect(stats.totalHits).toBe(0);
    expect(stats.totalMisses).toBe(1);
    expect(stats.byResource[0]?.resource).toBe('dashboard:operations');
  });

  it('get HIT sayar (redis value)', async () => {
    process.env.CACHE_ENABLED = 'true';
    const service = new CacheService();
    jest.spyOn((service as any).client, 'get').mockResolvedValue(JSON.stringify({ ok: true }));

    await service.get('cache:v1:dashboard:sla-summary:r:shared');
    const stats = service.getStats();

    expect(stats.totalHits).toBe(1);
    expect(stats.totalMisses).toBe(0);
    expect(stats.byResource[0]?.resource).toBe('dashboard:sla-summary');
  });

  it('getStats hits/misses/hitRatio dogru doner', async () => {
    process.env.CACHE_ENABLED = 'true';
    const service = new CacheService();
    const getSpy = jest.spyOn((service as any).client, 'get');
    getSpy
      .mockResolvedValueOnce(JSON.stringify({ a: 1 }))
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(JSON.stringify({ b: 2 }));

    await service.get('cache:v1:dashboard:operations:r:shared');
    await service.get('cache:v1:dashboard:operations:r:shared');
    await service.get('cache:v1:dashboard:sla-summary:r:shared');

    const stats = service.getStats();
    expect(stats.totalHits).toBe(2);
    expect(stats.totalMisses).toBe(1);
    expect(stats.hitRatio).toBeCloseTo(2 / 3, 5);
    const ops = stats.byResource.find((x) => x.resource === 'dashboard:operations');
    expect(ops?.hits).toBe(1);
    expect(ops?.misses).toBe(1);
  });
});