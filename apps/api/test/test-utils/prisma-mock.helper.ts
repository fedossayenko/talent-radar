import { PrismaService } from '../../src/common/database/prisma.service';

export const createMockPrismaService = () => {
  return {
    company: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    companyAnalysis: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    vacancy: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    vacancyScore: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    cv: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    application: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  } as jest.Mocked<PrismaService>;
};