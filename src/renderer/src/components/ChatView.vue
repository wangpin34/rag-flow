<template>
  <div class="chat-view">
    <!-- Header with model selector -->
    <div class="chat-header">
      <n-space align="center" justify="space-between">
        <n-text strong>{{ currentChat?.title || 'New Chat' }}</n-text>
        <n-space align="center" :size="8">
          <n-select
            v-model:value="selectedKbId"
            :options="kbOptions"
            placeholder="No knowledge base"
            clearable
            :style="{ width: '200px' }"
            @update:value="handleKbChange"
          />
          <n-select
            v-model:value="selectedModelId"
            :options="modelOptions"
            placeholder="Select Model"
            :style="{ width: '220px' }"
            filterable
            @update:value="handleModelChange"
          />
        </n-space>
      </n-space>
    </div>

    <!-- Messages area -->
    <div class="messages-container" ref="messagesContainer">
      <n-empty
        v-if="messages.length === 0"
        description="No messages yet. Start a conversation!"
        :style="{ marginTop: '100px' }"
      />

      <div v-for="message in messages" :key="message.id" class="message-wrapper">
        <div :class="['message', `message-${message.role}`]">
          <div class="message-header">
            <n-text strong>{{ message.role === 'user' ? 'You' : 'Assistant' }}</n-text>
            <n-space align="center" :size="8">
              <n-text depth="3" :style="{ fontSize: '12px' }">
                {{ formatTime(message.createdAt) }}
              </n-text>
              <n-button
                v-if="message.role === 'user' && !isLoading"
                text
                size="tiny"
                @click="handleRetry(message)"
                :style="{ padding: '2px 4px' }"
              >
                <template #icon>
                  <n-icon size="14">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                    </svg>
                  </n-icon>
                </template>
                Retry
              </n-button>
            </n-space>
          </div>

          <!-- Thinking section (collapsible, only for assistant messages with thinking metadata) -->
          <details v-if="message.role === 'assistant' && getMessageMeta(message).thinking" class="thinking-block" open>
            <summary class="thinking-summary">
              <n-icon size="13" style="margin-right:4px; vertical-align:-2px">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  <circle cx="12" cy="12" r="10"/>
                </svg>
              </n-icon>
              Thinking process
            </summary>
            <div class="thinking-content markdown-body" v-html="parseMarkdown(getMessageMeta(message).thinking!)"></div>
          </details>

          <div class="message-content markdown-body" v-html="parseMarkdown(displayContent(message))"></div>

          <!-- Sources section (collapsible, only when sources were retrieved) -->
          <details v-if="message.role === 'assistant' && getMessageMeta(message).sources?.length" class="sources-block">
            <summary class="sources-summary">
              <n-icon size="13" style="margin-right:4px; vertical-align:-2px">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
              </n-icon>
              {{ getMessageMeta(message).sources!.length }} source chunk{{ getMessageMeta(message).sources!.length > 1 ? 's' : '' }}
            </summary>
            <div class="sources-list">
              <div
                v-for="(src, idx) in getMessageMeta(message).sources"
                :key="idx"
                class="source-item"
              >
                <div class="source-label">
                  <n-text depth="3" :style="{ fontSize: '11px', fontWeight: 600 }">[{{ idx + 1 }}]</n-text>
                  <n-text depth="3" :style="{ fontSize: '11px', marginLeft: '4px' }">{{ src.source || 'Unknown source' }}</n-text>
                  <n-text depth="3" :style="{ fontSize: '10px', marginLeft: '8px' }">score: {{ (1 - src.score).toFixed(3) }}</n-text>
                </div>
                <div class="source-content">{{ src.content }}</div>
              </div>
            </div>
          </details>
        </div>
      </div>

      <div v-if="isStreaming || (isLoading && (streamingMessage || streamingThinking))" class="message-wrapper">
        <div class="message message-assistant">
          <div class="message-header">
            <n-text strong>Assistant</n-text>
          </div>
          <!-- Live thinking block while model is in <think> phase -->
          <details v-if="streamingThinking" class="thinking-block" open>
            <summary class="thinking-summary">
              <n-spin v-if="isThinkingPhase" size="small" style="margin-right:6px;vertical-align:-3px" />
              <n-icon v-else size="13" style="margin-right:4px; vertical-align:-2px">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  <circle cx="12" cy="12" r="10"/>
                </svg>
              </n-icon>
              {{ isThinkingPhase ? 'Thinking...' : 'Thinking process' }}
            </summary>
            <div class="thinking-content markdown-body" v-html="parseMarkdown(streamingThinking)"></div>
          </details>
          <div class="message-content markdown-body" v-if="streamingMessage || !isThinkingPhase">
            <span v-html="parseMarkdown(streamingMessage)"></span>
            <span class="streaming-cursor">▊</span>
          </div>
        </div>
      </div>

      <div v-else-if="isLoading" class="message-wrapper">
        <div class="message message-assistant">
          <div class="message-header">
            <n-text strong>Assistant</n-text>
          </div>
          <div class="message-content">
            <n-spin size="small" />
            <n-text depth="3" :style="{ marginLeft: '8px' }">Thinking...</n-text>
          </div>
        </div>
      </div>
    </div>

    <!-- Input area -->
    <div class="input-container">
      <n-space vertical :size="8" :style="{ width: '100%' }">
        <n-input
          v-model:value="userInput"
          type="textarea"
          placeholder="Type your message..."
          :rows="3"
          :disabled="isLoading || !selectedModelId"
          @keydown.enter.prevent="handleSendMessage"
        />
        <n-space justify="end">
          <n-button
            type="primary"
            :disabled="!userInput.trim() || isLoading || !selectedModelId"
            :loading="isLoading"
            @click="handleSendMessage"
          >
            Send
          </n-button>
        </n-space>
      </n-space>
    </div>

    <!-- API Key Modal -->
    <n-modal
      v-model:show="showApiKeyModal"
      preset="dialog"
      title="API Key Required"
      positive-text="Submit"
      negative-text="Cancel"
      @positive-click="handleApiKeySubmit"
    >
      <n-space vertical :size="12">
        <n-text>This provider requires an API key. Please enter your API key:</n-text>
        <n-input
          v-model:value="apiKeyInput"
          type="password"
          placeholder="Enter API key"
          @keydown.enter="handleApiKeySubmit"
        />
      </n-space>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { NButton, NEmpty, NIcon, NInput, NModal, NSelect, NSpace, NSpin, NText, useMessage } from 'naive-ui';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { aiApiService } from '../lib/ai-api.service';
import { parseMarkdown } from '../lib/markdown';
interface Props {
  chatId?: number | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'chatCreated', chatId: number): void;
  (e: 'chatUpdated'): void;
}>();

const message = useMessage();
const currentChat = ref<any>(null);
const messages = ref<any[]>([]);
const userInput = ref('');
const isLoading = ref(false);
const selectedModelId = ref<number | null>(null);
const models = ref<any[]>([]);
const messagesContainer = ref<HTMLElement | null>(null);
const showApiKeyModal = ref(false);
const apiKeyInput = ref('');
const pendingApiCall = ref<(() => Promise<void>) | null>(null);
const streamingMessage = ref('');
const isStreaming = ref(false);
const pendingCustomHistory = ref<any[] | undefined>(undefined);
const streamingThinking = ref('');
const isThinkingPhase = ref(false);
const pendingSourceChunks = ref<any[]>([]);

/** Parse <think>...</think> from a raw buffer accumulated during streaming. */
function parseThinkingFromRaw(raw: string): { thinking: string; response: string; inThinking: boolean } {
  const openIdx = raw.indexOf('<think>');
  if (openIdx === -1) return { thinking: '', response: raw, inThinking: false };
  const closeIdx = raw.indexOf('</think>', openIdx);
  if (closeIdx !== -1) {
    return {
      thinking: raw.slice(openIdx + 7, closeIdx).trim(),
      response: raw.slice(closeIdx + 8).trimStart(),
      inThinking: false,
    };
  }
  // Still inside the think block
  return { thinking: raw.slice(openIdx + 7), response: '', inThinking: true };
}

/** Parse message metadata JSON safely. */
function getMessageMeta(msg: any): { thinking?: string; sources?: Array<{ source: string | null; chunkIndex: number; content: string; score: number }> } {
  try { return msg.metadata ? JSON.parse(msg.metadata) : {}; }
  catch { return {}; }
}

/** Return the display content for a message, stripping any <think> block that may be in old messages. */
function displayContent(msg: any): string {
  const meta = getMessageMeta(msg);
  if (meta.thinking !== undefined) return msg.content; // already stripped at save time
  // Legacy: strip inline think tags
  return msg.content.replace(/<think>[\s\S]*?<\/think>/g, '').trimStart();
}

// Knowledge base
const selectedKbId = ref<number | null>(null);
const collections = ref<any[]>([]);
const kbOptions = computed(() =>
  collections.value.map((c) => ({ label: c.name, value: c.id }))
);

const loadCollections = async () => {
  try { collections.value = await window.api.collection.findAll(); }
  catch { /* non-critical */ }
};

// Model options for the dropdown
const modelOptions = computed(() =>
  models.value
    .filter((m) => m.modelType === 'chat' && m.isActive && m.provider?.isActive)
    .map((m) => ({
      label: m.displayName || m.name,
      value: m.id,
    }))
);

// Load models
const loadModels = async () => {
  try {
    models.value = await window.api.model.findAll({ includeInactive: false });
  } catch (error) {
    console.error('Error loading models:', error);
    message.error('Failed to load models');
  }
};

// Load last used model ID from settings
const loadLastUsedModel = async () => {
  try {
    const lastModelId = await window.api.settings.getLastUsedModelId();
    if (lastModelId) {
      // Check if the model still exists
      const model = models.value.find((m) => m.id === lastModelId);
      if (model) {
        selectedModelId.value = lastModelId;
      }
    }
    // If no last used model or it doesn't exist, select the first chat model
    if (!selectedModelId.value && modelOptions.value.length > 0) {
      selectedModelId.value = modelOptions.value[0].value;
    }
  } catch (error) {
    console.error('Error loading last used model:', error);
  }
};

// Handle KB selection change
const handleKbChange = async (kbId: number | null) => {
  if (!currentChat.value) return;
  try {
    await window.api.chat.update(currentChat.value.id, { collectionId: kbId ?? null });
    currentChat.value.collectionId = kbId ?? null;
  } catch {
    message.error('Failed to update knowledge base');
  }
};

// Handle model selection change
const handleModelChange = async (modelId: number) => {
  try {
    await window.api.settings.setLastUsedModelId(modelId);
    
    // If we have a current chat, update it with the new model
    if (currentChat.value) {
      await window.api.chat.update(currentChat.value.id, { modelId });
      currentChat.value.modelId = modelId;
      emit('chatUpdated');
    }
  } catch (error) {
    console.error('Error updating model:', error);
    message.error('Failed to update model');
  }
};

// Load chat and messages
const loadChat = async () => {
  if (!props.chatId) {
    currentChat.value = null;
    messages.value = [];
    return;
  }

  try {
    const chat = await window.api.chat.findById(props.chatId);
    if (chat) {
      currentChat.value = chat;
      messages.value = chat.messages || [];
      selectedModelId.value = chat.modelId;
      selectedKbId.value = chat.collectionId ?? null;
      await scrollToBottom();
    }
  } catch (error) {
    console.error('Error loading chat:', error);
    message.error('Failed to load chat');
  }
};

// Create a new chat
const createNewChat = async () => {
  if (!selectedModelId.value) {
    message.error('Please select a model first');
    return null;
  }

  try {
    const chat = await window.api.chat.create({
      title: 'New Chat',
      modelId: selectedModelId.value,
    });
    currentChat.value = chat;
    emit('chatCreated', chat.id);
    return chat;
  } catch (error) {
    console.error('Error creating chat:', error);
    message.error('Failed to create chat');
    return null;
  }
};

// Send message
const handleSendMessage = async () => {
  const content = userInput.value.trim();
  if (!content || isLoading.value) return;

  // Create chat if it doesn't exist
  if (!currentChat.value) {
    const chat = await createNewChat();
    if (!chat) return;
  }

  try {
    isLoading.value = true;

    // Add user message
    const userMessage = await window.api.chat.addMessage({
      chatId: currentChat.value.id,
      role: 'user',
      content,
    });

    messages.value.push(userMessage);
    userInput.value = '';
    await scrollToBottom();

    // Auto-generate title from first message
    if (messages.value.length === 1) {
      const title = content.slice(0, 50) + (content.length > 50 ? '...' : '');
      await window.api.chat.update(currentChat.value.id, { title });
      currentChat.value.title = title;
      emit('chatUpdated');
    }

    // Call AI API to get response
    await getAIResponse(content);

  } catch (error) {
    console.error('Error sending message:', error);
    message.error('Failed to send message');
  } finally {
    isLoading.value = false;
  }
};

// Get AI response from API with streaming
const getAIResponse = async (userMessage: string, apiKey?: string, customHistory?: any[]) => {
  streamingMessage.value = '';
  streamingThinking.value = '';
  isThinkingPhase.value = false;
  isStreaming.value = true;
  pendingSourceChunks.value = [];
  let rawBuffer = '';
  
  try {
    // Get the model details
    const model = models.value.find((m) => m.id === selectedModelId.value);
    if (!model) {
      throw new Error('Model not found');
    }

    // Build conversation history - use custom history if provided (for retry)
    const messagesToUse = customHistory || messages.value;
    const conversationMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = messagesToUse
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    // Inject KB context as a system message when a knowledge base is attached
    if (selectedKbId.value) {
      try {
        const chunks = await window.api.collection.retrieveChunks(selectedKbId.value, userMessage, 4);
        if (chunks.length > 0) {
          pendingSourceChunks.value = chunks;
          const context = chunks.map((c: { source: string | null; chunkIndex: number; content: string; score: number }, i: number) => `[${i + 1}] ${c.source ? `(${c.source}) ` : ''}${c.content}`).join('\n\n');
          conversationMessages.unshift({
            role: 'system',
            content: `Use the following context excerpts to answer the user's question. If the context does not contain relevant information, answer from your general knowledge.\n\n${context}`,
          });
        }
      } catch {
        // Non-critical — continue without context
      }
    }

    // Call the AI API with streaming
    await aiApiService.chatStream(
      model.provider.name,
      model.provider.apiEndpoint || '',
      model.name,
      conversationMessages,
      (chunk: string) => {
        rawBuffer += chunk;
        const parsed = parseThinkingFromRaw(rawBuffer);
        streamingThinking.value = parsed.thinking;
        streamingMessage.value = parsed.response;
        isThinkingPhase.value = parsed.inThinking;
        scrollToBottom();
      },
      apiKey
    );

    // Parse final content and build metadata
    const finalParsed = parseThinkingFromRaw(rawBuffer);
    const metaObj: Record<string, any> = {};
    if (finalParsed.thinking) metaObj.thinking = finalParsed.thinking;
    if (pendingSourceChunks.value.length > 0) metaObj.sources = pendingSourceChunks.value;

    // Save the complete assistant response to database
    const assistantMessage = await window.api.chat.addMessage({
      chatId: currentChat.value!.id,
      role: 'assistant',
      content: finalParsed.response || rawBuffer,
      metadata: Object.keys(metaObj).length > 0 ? JSON.stringify(metaObj) : undefined,
    });

    messages.value.push(assistantMessage);
    streamingMessage.value = '';
    streamingThinking.value = '';
    isThinkingPhase.value = false;
    isStreaming.value = false;
    pendingSourceChunks.value = [];
    await scrollToBottom();
  } catch (error: any) {
    isStreaming.value = false;
    streamingMessage.value = '';
    streamingThinking.value = '';
    isThinkingPhase.value = false;
    pendingSourceChunks.value = [];
    
    // Check if it's an API key error for OpenAI
    if (error.message?.includes('API key') && !apiKey) {
      // Prompt for API key
      pendingCustomHistory.value = customHistory;
      pendingApiCall.value = async () => {
        await getAIResponse(userMessage, apiKeyInput.value, pendingCustomHistory.value);
        pendingCustomHistory.value = undefined;
      };
      showApiKeyModal.value = true;
    } else {
      message.error(`Failed to get AI response: ${error.message || 'Unknown error'}`);
      
      // Add error message to chat
      const errorMessage = await window.api.chat.addMessage({
        chatId: currentChat.value!.id,
        role: 'assistant',
        content: `Error: ${error.message || 'Failed to get response from AI'}`,
      });
      messages.value.push(errorMessage);
      await scrollToBottom();
    }
  }
};

// Handle retry of a user message
const handleRetry = async (userMessage: any) => {
  if (isLoading.value || isStreaming.value) return;

  try {
    isLoading.value = true;

    // Find the index of the user message
    const userMsgIndex = messages.value.findIndex((m) => m.id === userMessage.id);
    if (userMsgIndex === -1) return;

    // Build conversation history up to and including this user message for context
    // This ensures the AI only sees messages up to the retry point
    const historyUpToRetry = messages.value.slice(0, userMsgIndex + 1);

    // Get new AI response with custom history
    // The new response will be added at the end of messages.value (after all existing messages)
    await getAIResponse(userMessage.content, undefined, historyUpToRetry);
    
    emit('chatUpdated');
  } catch (error) {
    console.error('Error retrying message:', error);
    message.error('Failed to retry message');
  } finally {
    isLoading.value = false;
  }
};

// Handle API key submission
const handleApiKeySubmit = async () => {
  if (!apiKeyInput.value.trim()) {
    message.error('Please enter an API key');
    return;
  }

  showApiKeyModal.value = false;
  
  if (pendingApiCall.value) {
    isLoading.value = true;
    try {
      await pendingApiCall.value();
    } finally {
      isLoading.value = false;
      pendingApiCall.value = null;
      apiKeyInput.value = '';
    }
  }
};

// Scroll to bottom of messages
const scrollToBottom = async () => {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

// Format timestamp
const formatTime = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
};

// Watch for chat ID changes
watch(
  () => props.chatId,
  () => {
    loadChat();
  }
);

onMounted(async () => {
  await loadModels();
  await loadLastUsedModel();
  await loadCollections();
  await loadChat();
});
</script>

<style scoped>
.chat-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #18181c;
}

.chat-header {
  padding: 16px 24px;
  border-bottom: 1px solid #2c2c32;
  background: #18181c;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background: #18181c;
}

.message-wrapper {
  margin-bottom: 24px;
}

.message {
  padding: 16px;
  border-radius: 8px;
  background: #28282e;
}

.message-user {
  background: #3f3f46;
  margin-left: 20%;
}

.message-assistant {
  background: #28282e;
  margin-right: 20%;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.message-content {
  line-height: 1.6;
  word-wrap: break-word;
}

.streaming-cursor {
  display: inline-block;
  margin-left: 2px;
  animation: blink 1s infinite;
  color: #18a058;
}

/* Thinking block */
.thinking-block {
  margin-bottom: 10px;
  border: 1px solid #3a3a44;
  border-radius: 6px;
  overflow: hidden;
  background: #1e1e26;
}

.thinking-summary {
  padding: 6px 10px;
  cursor: pointer;
  user-select: none;
  font-size: 12px;
  color: #a0a0b0;
  display: flex;
  align-items: center;
  list-style: none;
}

.thinking-summary::-webkit-details-marker { display: none; }

.thinking-block[open] .thinking-summary {
  border-bottom: 1px solid #3a3a44;
}

.thinking-content {
  padding: 10px 12px;
  font-size: 13px;
  color: #8a8a9a;
  max-height: 240px;
  overflow-y: auto;
  white-space: pre-wrap;
}

/* Sources block */
.sources-block {
  margin-top: 10px;
  border: 1px solid #2e2e3a;
  border-radius: 6px;
  overflow: hidden;
  background: #1c1c24;
}

.sources-summary {
  padding: 6px 10px;
  cursor: pointer;
  user-select: none;
  font-size: 12px;
  color: #7a7a90;
  display: flex;
  align-items: center;
  list-style: none;
}

.sources-summary::-webkit-details-marker { display: none; }

.sources-block[open] .sources-summary {
  border-bottom: 1px solid #2e2e3a;
}

.sources-list {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.source-item {
  background: #232330;
  border-radius: 4px;
  padding: 8px 10px;
  border-left: 2px solid #4a4a60;
}

.source-label {
  margin-bottom: 4px;
  display: flex;
  align-items: baseline;
  gap: 2px;
}

.source-content {
  font-size: 12px;
  color: #8a8a9a;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 120px;
  overflow-y: auto;
}

@keyframes blink {
  0%, 50% {
    opacity: 1;
  }
  51%, 100% {
    opacity: 0;
  }
}

.input-container {
  padding: 16px 24px;
  border-top: 1px solid #2c2c32;
  background: #18181c;
}

/* Markdown Styles */
.markdown-body {
  color: #e5e5e5;
  font-size: 14px;
}

.markdown-body h1,
.markdown-body h2,
.markdown-body h3,
.markdown-body h4,
.markdown-body h5,
.markdown-body h6 {
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.25;
  color: #ffffff;
}

.markdown-body h1 {
  font-size: 2em;
  border-bottom: 1px solid #3f3f46;
  padding-bottom: 0.3em;
}

.markdown-body h2 {
  font-size: 1.5em;
  border-bottom: 1px solid #3f3f46;
  padding-bottom: 0.3em;
}

.markdown-body h3 {
  font-size: 1.25em;
}

.markdown-body h4 {
  font-size: 1em;
}

.markdown-body h5 {
  font-size: 0.875em;
}

.markdown-body h6 {
  font-size: 0.85em;
  color: #a1a1aa;
}

.markdown-body p {
  margin-top: 0;
  margin-bottom: 16px;
}

.markdown-body a {
  color: #18a058;
  text-decoration: none;
}

.markdown-body a:hover {
  text-decoration: underline;
}

.markdown-body code {
  padding: 0.2em 0.4em;
  margin: 0;
  font-size: 85%;
  background-color: rgba(110, 118, 129, 0.4);
  border-radius: 6px;
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
}

.markdown-body pre {
  padding: 16px;
  overflow: auto;
  font-size: 85%;
  line-height: 1.45;
  background-color: #1a1a1f;
  border-radius: 6px;
  margin-top: 0;
  margin-bottom: 16px;
}

.markdown-body pre code {
  display: block;
  padding: 0;
  margin: 0;
  overflow: visible;
  line-height: inherit;
  word-wrap: normal;
  background-color: transparent;
  border: 0;
}

.markdown-body ul,
.markdown-body ol {
  padding-left: 2em;
  margin-top: 0;
  margin-bottom: 16px;
}

.markdown-body li {
  margin-top: 0.25em;
}

.markdown-body li + li {
  margin-top: 0.25em;
}

.markdown-body blockquote {
  margin: 0;
  padding: 0 1em;
  color: #a1a1aa;
  border-left: 0.25em solid #3f3f46;
  margin-bottom: 16px;
}

.markdown-body blockquote > :first-child {
  margin-top: 0;
}

.markdown-body blockquote > :last-child {
  margin-bottom: 0;
}

.markdown-body table {
  border-spacing: 0;
  border-collapse: collapse;
  margin-top: 0;
  margin-bottom: 16px;
  width: 100%;
  overflow: auto;
}

.markdown-body table th {
  font-weight: 600;
  padding: 6px 13px;
  border: 1px solid #3f3f46;
  background-color: #28282e;
}

.markdown-body table td {
  padding: 6px 13px;
  border: 1px solid #3f3f46;
}

.markdown-body table tr {
  background-color: transparent;
  border-top: 1px solid #3f3f46;
}

.markdown-body table tr:nth-child(2n) {
  background-color: rgba(110, 118, 129, 0.1);
}

.markdown-body hr {
  height: 0.25em;
  padding: 0;
  margin: 24px 0;
  background-color: #3f3f46;
  border: 0;
}

.markdown-body img {
  max-width: 100%;
  box-sizing: content-box;
  background-color: transparent;
}

.markdown-body strong {
  font-weight: 600;
}

.markdown-body em {
  font-style: italic;
}

/* Syntax highlighting theme (dark) */
.hljs {
  color: #e5e5e5;
  background: #1a1a1f;
}

.hljs-comment,
.hljs-quote {
  color: #6e7681;
  font-style: italic;
}

.hljs-keyword,
.hljs-selector-tag,
.hljs-subst {
  color: #ff7b72;
}

.hljs-number,
.hljs-literal,
.hljs-variable,
.hljs-template-variable,
.hljs-tag .hljs-attr {
  color: #79c0ff;
}

.hljs-string,
.hljs-doctag {
  color: #a5d6ff;
}

.hljs-title,
.hljs-section,
.hljs-selector-id {
  color: #d2a8ff;
  font-weight: bold;
}

.hljs-type,
.hljs-class .hljs-title {
  color: #ffa657;
}

.hljs-tag,
.hljs-name,
.hljs-attribute {
  color: #7ee787;
}

.hljs-regexp,
.hljs-link {
  color: #a5d6ff;
}

.hljs-symbol,
.hljs-bullet {
  color: #79c0ff;
}

.hljs-built_in,
.hljs-builtin-name {
  color: #ffa657;
}

.hljs-meta {
  color: #8b949e;
}

.hljs-deletion {
  background-color: #ffa198;
}

.hljs-addition {
  background-color: #56d364;
}

.hljs-emphasis {
  font-style: italic;
}

.hljs-strong {
  font-weight: bold;
}
</style>
