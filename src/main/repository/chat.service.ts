import { prismaService } from './prisma.service';

export interface CreateChatData {
  title: string;
  modelId: number;
}

export interface CreateMessageData {
  chatId: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: any;
}

export interface UpdateChatData {
  title?: string;
  modelId?: number;
}

class ChatService {
  /**
   * Create a new chat conversation
   */
  async create(data: CreateChatData) {
    return prismaService.db.chat.create({
      data: {
        title: data.title,
        modelId: data.modelId,
      },
      include: {
        model: {
          include: {
            provider: true,
          },
        },
      },
    });
  }

  /**
   * Find a chat by ID
   */
  async findById(id: number) {
    return prismaService.db.chat.findUnique({
      where: { id },
      include: {
        model: {
          include: {
            provider: true,
          },
        },
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });
  }

  /**
   * Find all chats with pagination and ordering
   */
  async findAll(page: number = 1, pageSize: number = 20) {
    const skip = (page - 1) * pageSize;
    
    const [chats, total] = await Promise.all([
      prismaService.db.chat.findMany({
        skip,
        take: pageSize,
        orderBy: {
          updatedAt: 'desc',
        },
        include: {
          model: {
            include: {
              provider: true,
            },
          },
          messages: {
            take: 1,
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      }),
      prismaService.db.chat.count(),
    ]);

    return {
      chats,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Update a chat
   */
  async update(id: number, data: UpdateChatData) {
    return prismaService.db.chat.update({
      where: { id },
      data,
      include: {
        model: {
          include: {
            provider: true,
          },
        },
      },
    });
  }

  /**
   * Delete a chat and all its messages
   */
  async delete(id: number) {
    return prismaService.db.chat.delete({
      where: { id },
    });
  }

  /**
   * Add a message to a chat
   */
  async addMessage(data: CreateMessageData) {
    const message = await prismaService.db.message.create({
      data: {
        chatId: data.chatId,
        role: data.role,
        content: data.content,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      },
    });

    // Update chat's updatedAt timestamp
    await prismaService.db.chat.update({
      where: { id: data.chatId },
      data: {
        updatedAt: new Date(),
      },
    });

    return message;
  }

  /**
   * Get all messages for a chat
   */
  async getMessages(chatId: number) {
    return prismaService.db.message.findMany({
      where: { chatId },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  /**
   * Delete a message
   */
  async deleteMessage(id: number) {
    return prismaService.db.message.delete({
      where: { id },
    });
  }

  /**
   * Get chat statistics
   */
  async getStatistics() {
    const [totalChats, totalMessages] = await Promise.all([
      prismaService.db.chat.count(),
      prismaService.db.message.count(),
    ]);

    return {
      totalChats,
      totalMessages,
      averageMessagesPerChat: totalChats > 0 ? totalMessages / totalChats : 0,
    };
  }
}

export const chatService = new ChatService();
