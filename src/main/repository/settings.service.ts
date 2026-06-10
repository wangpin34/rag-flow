import { prismaService } from './prisma.service';

class SettingsService {
  /**
   * Get a setting value by key
   */
  async get(key: string): Promise<any | null> {
    const setting = await prismaService.db.settings.findUnique({
      where: { key },
    });

    if (!setting) {
      return null;
    }

    try {
      return JSON.parse(setting.value);
    } catch {
      return setting.value;
    }
  }

  /**
   * Set a setting value
   */
  async set(key: string, value: any) {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

    return prismaService.db.settings.upsert({
      where: { key },
      update: {
        value: stringValue,
      },
      create: {
        key,
        value: stringValue,
      },
    });
  }

  /**
   * Delete a setting
   */
  async delete(key: string) {
    return prismaService.db.settings.delete({
      where: { key },
    });
  }

  /**
   * Get all settings
   */
  async getAll() {
    const settings = await prismaService.db.settings.findMany();
    
    return settings.reduce((acc, setting) => {
      try {
        acc[setting.key] = JSON.parse(setting.value);
      } catch {
        acc[setting.key] = setting.value;
      }
      return acc;
    }, {} as Record<string, any>);
  }

  /**
   * Get the last used model ID
   */
  async getLastUsedModelId(): Promise<number | null> {
    return this.get('lastUsedModelId');
  }

  /**
   * Set the last used model ID
   */
  async setLastUsedModelId(modelId: number) {
    return this.set('lastUsedModelId', modelId);
  }
}

export const settingsService = new SettingsService();
