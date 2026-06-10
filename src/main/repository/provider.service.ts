import type { Prisma, Provider } from '@prisma/client';
import { prismaService } from './prisma.service';

class ProviderService {
  /**
   * Create a new provider
   */
  async create(data: Prisma.ProviderCreateInput): Promise<Provider> {
    return prismaService.db.provider.create({
      data,
      include: {
        models: true,
      },
    });
  }

  /**
   * Get a provider by ID
   */
  async findById(id: number) {
    return prismaService.db.provider.findUnique({
      where: { id },
      include: {
        models: true,
      },
    });
  }

  /**
   * Get a provider by name
   */
  async findByName(name: string) {
    return prismaService.db.provider.findUnique({
      where: { name },
      include: {
        models: true,
      },
    });
  }

  /**
   * Get all providers
   */
  async findAll(includeInactive = false) {
    return prismaService.db.provider.findMany({
      where: includeInactive ? undefined : { isActive: true },
      include: {
        models: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Update a provider
   */
  async update(id: number, data: Prisma.ProviderUpdateInput): Promise<Provider> {
    return prismaService.db.provider.update({
      where: { id },
      data,
      include: {
        models: true,
      },
    });
  }

  /**
   * Delete a provider (will cascade delete all associated models)
   */
  async delete(id: number): Promise<Provider> {
    return prismaService.db.provider.delete({
      where: { id },
    });
  }

  /**
   * Toggle provider active status
   */
  async toggleActive(id: number): Promise<Provider> {
    const provider = await this.findById(id);
    if (!provider) {
      throw new Error(`Provider with id ${id} not found`);
    }
    return this.update(id, { isActive: !provider.isActive });
  }

  /**
   * Get provider statistics
   */
  async getStatistics() {
    const [totalProviders, activeProviders, totalModels] = await Promise.all([
      prismaService.db.provider.count(),
      prismaService.db.provider.count({ where: { isActive: true } }),
      prismaService.db.model.count(),
    ]);

    return {
      totalProviders,
      activeProviders,
      inactiveProviders: totalProviders - activeProviders,
      totalModels,
    };
  }
}

export const providerService = new ProviderService();
