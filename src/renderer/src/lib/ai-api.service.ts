/**
 * AI API Service for calling Ollama and OpenAI APIs
 */

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
}

interface OpenAIChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
}

export class AiApiService {
  /**
   * Call Ollama chat API with streaming
   */
  async callOllamaStream(
    apiEndpoint: string,
    modelName: string,
    messages: ChatMessage[],
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const url = `${apiEndpoint}/chat`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.status} ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Failed to get response reader');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const json = JSON.parse(line);
              if (json.message?.content) {
                onChunk(json.message.content);
              }
            } catch (e) {
              console.error('Error parsing JSON:', e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Call OpenAI chat API with streaming
   */
  async callOpenAIStream(
    apiEndpoint: string,
    apiKey: string,
    modelName: string,
    messages: ChatMessage[],
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const url = `${apiEndpoint}/chat/completions`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Failed to get response reader');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            
            try {
              const json = JSON.parse(data);
              const content = json.choices?.[0]?.delta?.content;
              if (content) {
                onChunk(content);
              }
            } catch (e) {
              console.error('Error parsing JSON:', e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Call appropriate AI API with streaming based on provider
   */
  async chatStream(
    providerName: string,
    apiEndpoint: string,
    modelName: string,
    messages: ChatMessage[],
    onChunk: (chunk: string) => void,
    apiKey?: string
  ): Promise<void> {
    const normalizedProvider = providerName.toLowerCase();

    if (normalizedProvider === 'ollama') {
      return this.callOllamaStream(apiEndpoint, modelName, messages, onChunk);
    } else if (normalizedProvider === 'openai') {
      if (!apiKey) {
        throw new Error('API key is required for OpenAI');
      }
      return this.callOpenAIStream(apiEndpoint, apiKey, modelName, messages, onChunk);
    } else {
      throw new Error(`Unsupported provider: ${providerName}`);
    }
  }

  /**
   * Call Ollama chat API (non-streaming, for backward compatibility)
   */
  async callOllama(
    apiEndpoint: string,
    modelName: string,
    messages: ChatMessage[]
  ): Promise<string> {
    const url = `${apiEndpoint}/chat`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.status} ${errorText}`);
    }

    const data: OllamaChatResponse = await response.json();
    return data.message.content;
  }

  /**
   * Call OpenAI chat API (non-streaming, for backward compatibility)
   */
  async callOpenAI(
    apiEndpoint: string,
    apiKey: string,
    modelName: string,
    messages: ChatMessage[]
  ): Promise<string> {
    const url = `${apiEndpoint}/chat/completions`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }

    const data: OpenAIChatResponse = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  /**
   * Call appropriate AI API based on provider (non-streaming, for backward compatibility)
   */
  async chat(
    providerName: string,
    apiEndpoint: string,
    modelName: string,
    messages: ChatMessage[],
    apiKey?: string
  ): Promise<string> {
    const normalizedProvider = providerName.toLowerCase();

    if (normalizedProvider === 'ollama') {
      return this.callOllama(apiEndpoint, modelName, messages);
    } else if (normalizedProvider === 'openai') {
      if (!apiKey) {
        throw new Error('API key is required for OpenAI');
      }
      return this.callOpenAI(apiEndpoint, apiKey, modelName, messages);
    } else {
      throw new Error(`Unsupported provider: ${providerName}`);
    }
  }
}

export const aiApiService = new AiApiService();
