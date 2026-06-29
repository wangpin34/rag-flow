import { prismaService } from './prisma.service';

/**
 * Seed default providers and models
 */
export async function seedDatabase() {
  console.log('🌱 Seeding database...');

  try {
    // Check if providers already exist
    const existingProviders = await prismaService.db.provider.count();
    if (existingProviders > 0) {
      console.log('✓ Database already seeded, skipping...');
      return;
    }

    // Seed Ollama provider
    const ollama = await prismaService.db.provider.create({
      data: {
        name: 'Ollama',
        apiEndpoint: 'http://localhost:11434/api',
        apiKeyName: null, // Ollama doesn't need API key
        isActive: true,
        config: JSON.stringify({
          description: 'Local Ollama instance',
          supportsStreaming: true,
        }),
      },
    });

    console.log('✓ Created Ollama provider');

    // Seed common Ollama models
    const ollamaModels = [
      {
        name: 'llama3.2',
        displayName: 'Llama 3.2',
        modelType: 'chat',
        contextWindow: 128000,
        embeddingDim: null,
        config: JSON.stringify({ description: 'Latest Llama model' }),
      },
      {
        name: 'llama3.1',
        displayName: 'Llama 3.1',
        modelType: 'chat',
        contextWindow: 128000,
        embeddingDim: null,
        config: JSON.stringify({ description: 'Previous Llama model' }),
      },
      {
        name: 'qwen2.5',
        displayName: 'Qwen 2.5',
        modelType: 'chat',
        contextWindow: 32768,
        embeddingDim: null,
        config: JSON.stringify({ description: 'Alibaba Qwen model' }),
      },
      {
        name: 'nomic-embed-text',
        displayName: 'Nomic Embed Text',
        modelType: 'embedding',
        contextWindow: 8192,
        embeddingDim: 768,
        config: JSON.stringify({ description: 'High-quality text embeddings' }),
      },
      {
        name: 'mxbai-embed-large',
        displayName: 'MxbAI Embed Large',
        modelType: 'embedding',
        contextWindow: 512,
        embeddingDim: 1024,
        config: JSON.stringify({ description: 'Large embedding model' }),
      },
    ];

    for (const model of ollamaModels) {
      await prismaService.db.model.create({
        data: {
          ...model,
          providerId: ollama.id,
          isActive: false, // Set to false by default, user enables after downloading
        },
      });
    }

    console.log(`✓ Created ${ollamaModels.length} Ollama models`);

    // Optionally seed other providers (disabled by default)
    const openai = await prismaService.db.provider.create({
      data: {
        name: 'OpenAI',
        apiEndpoint: 'https://api.openai.com/v1',
        apiKeyName: 'OPENAI_API_KEY',
        isActive: false,
        config: JSON.stringify({
          description: 'OpenAI API',
          requiresApiKey: true,
        }),
      },
    });

    console.log('✓ Created OpenAI provider (inactive)');

    // Seed common OpenAI models
    const openaiModels = [
      {
        name: 'gpt-4o',
        displayName: 'GPT-4o',
        modelType: 'chat',
        contextWindow: 128000,
        embeddingDim: null,
      },
      {
        name: 'gpt-4o-mini',
        displayName: 'GPT-4o Mini',
        modelType: 'chat',
        contextWindow: 128000,
        embeddingDim: null,
      },
      {
        name: 'text-embedding-3-large',
        displayName: 'Text Embedding 3 Large',
        modelType: 'embedding',
        contextWindow: 8191,
        embeddingDim: 3072,
      },
      {
        name: 'text-embedding-3-small',
        displayName: 'Text Embedding 3 Small',
        modelType: 'embedding',
        contextWindow: 8191,
        embeddingDim: 1536,
      },
    ];

    for (const model of openaiModels) {
      await prismaService.db.model.create({
        data: {
          ...model,
          providerId: openai.id,
          isActive: false,
          config: null,
        },
      });
    }

    console.log(`✓ Created ${openaiModels.length} OpenAI models (inactive)`);

    // Seed Groq provider
    const groq = await prismaService.db.provider.create({
      data: {
        name: 'Groq',
        apiEndpoint: 'https://api.groq.com/openai/v1',
        apiKeyName: null,
        isActive: false,
        config: JSON.stringify({
          description: 'Groq Cloud API — fast inference',
          requiresApiKey: true,
        }),
      },
    });

    console.log('✓ Created Groq provider (inactive)');

    const groqModels = [
      { name: 'llama-3.3-70b-versatile', displayName: 'Llama 3.3 70B Versatile', contextWindow: 128000 },
      { name: 'llama-3.1-8b-instant', displayName: 'Llama 3.1 8B Instant', contextWindow: 128000 },
      { name: 'llama3-70b-8192', displayName: 'Llama 3 70B', contextWindow: 8192 },
      { name: 'llama3-8b-8192', displayName: 'Llama 3 8B', contextWindow: 8192 },
      { name: 'mixtral-8x7b-32768', displayName: 'Mixtral 8x7B', contextWindow: 32768 },
      { name: 'gemma2-9b-it', displayName: 'Gemma 2 9B', contextWindow: 8192 },
      { name: 'deepseek-r1-distill-llama-70b', displayName: 'DeepSeek R1 Distill Llama 70B', contextWindow: 128000 },
    ];

    for (const model of groqModels) {
      await prismaService.db.model.create({
        data: {
          ...model,
          providerId: groq.id,
          modelType: 'chat',
          embeddingDim: null,
          isActive: false,
          config: null,
        },
      });
    }

    console.log(`✓ Created ${groqModels.length} Groq models (inactive)`);

    console.log('✓ Database seeding completed successfully');
  } catch (error) {
    console.error('✗ Database seeding failed:', error);
    throw error;
  }
}
