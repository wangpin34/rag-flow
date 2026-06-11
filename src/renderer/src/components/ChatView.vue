<template>
  <div class="chat-view">
    <!-- Header with model selector -->
    <div class="chat-header">
      <n-space align="center" justify="space-between">
        <n-text strong>{{ currentChat?.title || 'New Chat' }}</n-text>
        <n-select
          v-model:value="selectedModelId"
          :options="modelOptions"
          placeholder="Select Model"
          :style="{ width: '250px' }"
          filterable
          @update:value="handleModelChange"
        />
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
          <div class="message-content markdown-body" v-html="parseMarkdown(message.content)"></div>
        </div>
      </div>

      <div v-if="isStreaming || (isLoading && streamingMessage)" class="message-wrapper">
        <div class="message message-assistant">
          <div class="message-header">
            <n-text strong>Assistant</n-text>
          </div>
          <div class="message-content markdown-body">
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
  isStreaming.value = true;
  
  try {
    // Get the model details
    const model = models.value.find((m) => m.id === selectedModelId.value);
    if (!model) {
      throw new Error('Model not found');
    }

    // Build conversation history - use custom history if provided (for retry)
    const messagesToUse = customHistory || messages.value;
    const conversationMessages = messagesToUse
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    // Call the AI API with streaming
    await aiApiService.chatStream(
      model.provider.name,
      model.provider.apiEndpoint || '',
      model.name,
      conversationMessages,
      (chunk: string) => {
        streamingMessage.value += chunk;
        scrollToBottom();
      },
      apiKey
    );

    // Save the complete assistant response to database
    const assistantMessage = await window.api.chat.addMessage({
      chatId: currentChat.value!.id,
      role: 'assistant',
      content: streamingMessage.value,
    });

    messages.value.push(assistantMessage);
    streamingMessage.value = '';
    isStreaming.value = false;
    await scrollToBottom();
  } catch (error: any) {
    isStreaming.value = false;
    streamingMessage.value = '';
    console.error('Error getting AI response:', error);
    
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
