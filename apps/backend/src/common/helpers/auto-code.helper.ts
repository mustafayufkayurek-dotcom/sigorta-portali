import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

type DelegateWithFindCreate<T> = {
  findFirst(args: Record<string, unknown>): Promise<{ [key: string]: unknown } | null>;
  create(args: Record<string, unknown>): Promise<T>;
};

type AutoCodeOptions = {
  delegateKey: string;
  codeField?: string;
  prefix: string;
  yearAware?: boolean;
  padding?: number;
  maxRetries?: number;
  createDataFactory: (code: string) => Record<string, unknown>;
  afterCreateArgs?: Record<string, unknown>;
};

const DEFAULT_PADDING = 5;
const DEFAULT_RETRIES = 3;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getPrismaErrorCode(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code;
  }
  return null;
}

function buildCode(prefix: string, sequence: number, yearAware: boolean, padding: number) {
  const seq = String(sequence).padStart(padding, '0');
  if (yearAware) {
    return `${prefix}-${new Date().getFullYear()}-${seq}`;
  }
  return `${prefix}-${seq}`;
}

async function getNextCode(
  delegate: DelegateWithFindCreate<unknown>,
  codeField: string,
  prefix: string,
  yearAware: boolean,
  padding: number,
) {
  const currentYear = new Date().getFullYear();
  const prefixBase = yearAware ? `${prefix}-${currentYear}-` : `${prefix}-`;
  const record = await delegate.findFirst({
    where: {
      [codeField]: {
        startsWith: prefixBase,
      },
    },
    orderBy: {
      [codeField]: 'desc',
    },
    select: {
      [codeField]: true,
    },
  });

  const lastCode = typeof record?.[codeField] === 'string' ? record[codeField] : '';
  const pattern = yearAware
    ? new RegExp(`^${escapeRegExp(prefix)}-${currentYear}-(\\d+)$`)
    : new RegExp(`^${escapeRegExp(prefix)}-(\\d+)$`);
  const match = lastCode.match(pattern);
  const lastSequence = match ? Number.parseInt(match[1], 10) : 0;

  return buildCode(prefix, lastSequence + 1, yearAware, padding);
}

export async function createWithAutoCode<T>(
  prisma: PrismaService,
  options: AutoCodeOptions,
): Promise<T> {
  const {
    delegateKey,
    prefix,
    createDataFactory,
    codeField = 'code',
    yearAware = false,
    padding = DEFAULT_PADDING,
    maxRetries = DEFAULT_RETRIES,
    afterCreateArgs,
  } = options;

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      return await prisma.$transaction(async (transaction) => {
        const transactionDelegate = (transaction as unknown as Record<string, unknown>)[
          delegateKey
        ] as DelegateWithFindCreate<T>;
        const generatedCode = await getNextCode(
          transactionDelegate,
          codeField,
          prefix,
          yearAware,
          padding,
        );

        return transactionDelegate.create({
          data: createDataFactory(generatedCode),
          ...afterCreateArgs,
        }) as Promise<T>;
      });
    } catch (error) {
      if (getPrismaErrorCode(error) !== 'P2002' || attempt === maxRetries - 1) {
        throw error;
      }
    }
  }

  throw new Error('Kod üretilemedi');
}