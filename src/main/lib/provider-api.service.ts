/**
 * Service for interacting with AI provider APIs
 */

interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    parameter_size?: string;
    quantization_level?: string;
  };
}

interface OpenAIModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

export class ProviderApiService {
  /**
   * List models from Ollama API
   */
  async listOllamaModels(apiEndpoint: string): Promise<Array<{
    name: string;
    displayName: string;
    modelType: string;
    contextWindow: number | null;
  }>> {
    try {
      const response = await fetch(`${apiEndpoint}/tags`);
      if (!response.ok) {
        throw new Error(`Failed to fetch Ollama models: ${response.statusText}`);
      }

      const data = await response.json();
      const models: OllamaModel[] = data.models || [];

      return models.map((model) => {
        const name = model.name;
        const isEmbedding = name.includes('embed');
        
        // Infer context window based on model name
        let contextWindow: number | null = null;
        if (name.includes('llama3.2')) contextWindow = 128000;
        else if (name.includes('llama3.1')) contextWindow = 128000;
        else if (name.includes('llama3')) contextWindow = 8192;
        else if (name.includes('mistral')) contextWindow = 32768;
        else if (name.includes('qwen2.5')) contextWindow = 32768;
        else if (name.includes('gemma2')) contextWindow = 8192;

        return {
          name,
          displayName: name.charAt(0).toUpperCase() + name.slice(1),
          modelType: isEmbedding ? 'embedding' : 'chat',
          contextWindow,
        };
      });
    } catch (error) {
      console.error('Error listing Ollama models:', error);
      throw error;
    }
  }

  /**
   * List models from OpenAI API
   */
  async listOpenAIModels(apiEndpoint: string, apiKey: string): Promise<Array<{
    name: string;
    displayName: string;
    modelType: string;
    contextWindow: number | null;
    embeddingDim: number | null;
  }>> {
    try {
      const response = await fetch(`${apiEndpoint}/models`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch OpenAI models: ${response.statusText}`);
      }

      const data = await response.json();
      const models: OpenAIModel[] = data.data || [];

      // Filter and categorize models
      return models
        .filter((model) => {
          const id = model.id;
          // Only include GPT and embedding models
          return id.startsWith('gpt-') || id.includes('embedding') || id.includes('text-davinci');
        })
        .map((model) => {
          const id = model.id;
          const isEmbedding = id.includes('embedding');
          
          // Map context windows and embedding dimensions
          let contextWindow: number | null = null;
          let embeddingDim: number | null = null;

          if (id.includes('gpt-4o')) contextWindow = 128000;
          else if (id.includes('gpt-4-turbo')) contextWindow = 128000;
          else if (id.includes('gpt-4')) contextWindow = 8192;
          else if (id.includes('gpt-3.5-turbo-16k')) contextWindow = 16385;
          else if (id.includes('gpt-3.5-turbo')) contextWindow = 4096;
          else if (id.includes('text-davinci-003')) contextWindow = 4097;

          if (id.includes('text-embedding-3-large')) embeddingDim = 3072;
          else if (id.includes('text-embedding-3-small')) embeddingDim = 1536;
          else if (id.includes('text-embedding-ada-002')) embeddingDim = 1536;

          return {
            name: id,
            displayName: id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            modelType: isEmbedding ? 'embedding' : 'chat',
            contextWindow,
            embeddingDim,
          };
        });
    } catch (error) {
      console.error('Error listing OpenAI models:', error);
      throw error;
    }
  }

  /**
   * Generate an embedding vector for a piece of text using a configured model.
   * Supports Ollama and OpenAI-compatible providers.
   */
  async generateEmbedding(
    provider: { name: string; apiEndpoint: string | null },
    modelName: string,
    text: string,
    apiKey?: string,
  ): Promise<number[]> {
    const name = provider.name.toLowerCase();
    const endpoint = provider.apiEndpoint ?? (name === 'openai' ? 'https://api.openai.com/v1' : 'http://localhost:11434');

    if (name === 'ollama') {
      // Normalize: strip a trailing /api so we always build the full path ourselves.
      // The seeded endpoint is "http://localhost:11434/api", so without this we'd get
      // ".../api/api/embed" which is 404.
      const ollamaBase = endpoint.endsWith('/api') ? endpoint.slice(0, -4) : endpoint.replace(/\/$/, '');

      // Try the current Ollama embed API (v0.2+: POST /api/embed, body: { model, input })
      const response = await fetch(`${ollamaBase}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelName, input: text }),
      });
      if (response.ok) {
        const data: any = await response.json();
        // Response shape: { embeddings: number[][] }
        const embeddings = data.embeddings ?? data.embedding;
        return (Array.isArray(embeddings[0]) ? embeddings[0] : embeddings) as number[];
      }
      // Fall back to legacy endpoint (Ollama < 0.2: POST /api/embeddings, body: { model, prompt })
      const legacy = await fetch(`${ollamaBase}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelName, prompt: text }),
      });
      if (!legacy.ok) throw new Error(`Ollama embedding error: ${legacy.statusText}`);
      const legacyData: any = await legacy.json();
      return legacyData.embedding as number[];
    }

    // OpenAI-compatible
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    const response = await fetch(`${endpoint}/embeddings`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: modelName, input: text }),
    });
    if (!response.ok) throw new Error(`Embedding error: ${response.statusText}`);
    const data: any = await response.json();
    return data.data[0].embedding as number[];
  }
}

export const providerApiService = new ProviderApiService();
