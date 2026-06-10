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
            <n-text depth="3" :style="{ fontSize: '12px' }">
              {{ formatTime(message.createdAt) }}
            </n-text>
          </div>
          <div class="message-content">
            <n-text>{{ message.content }}</n-text>
          </div>
        </div>
      </div>

      <div v-if="isLoading" class="message-wrapper">
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
  </div>
</template>

<script setup lang="ts">
import { NButton, NEmpty, NInput, NSelect, NSpace, NSpin, NText, useMessage } from 'naive-ui';
import { computed, nextTick, onMounted, ref, watch } from 'vue';

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

// Model options for the dropdown
const modelOptions = computed(() =>
  models.value
    .filter((m) => m.modelType === 'chat')
    .map((m) => ({
      label: m.displayName || m.name,
      value: m.id,
    }))
);

// Load models
const loadModels = async () => {
  try {
    models.value = await window.api.model.findAll({ includeInactive: true });
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

    // TODO: Call AI model API to get response
    // For now, simulate a response
    await simulateAIResponse(content);

  } catch (error) {
    console.error('Error sending message:', error);
    message.error('Failed to send message');
  } finally {
    isLoading.value = false;
  }
};

// Simulate AI response (placeholder)
const simulateAIResponse = async (userMessage: string) => {
  // Wait a bit to simulate API call
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const responseContent = `This is a placeholder response to: "${userMessage}". AI integration coming soon!`;

  const assistantMessage = await window.api.chat.addMessage({
    chatId: currentChat.value!.id,
    role: 'assistant',
    content: responseContent,
  });

  messages.value.push(assistantMessage);
  await scrollToBottom();
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

.input-container {
  padding: 16px 24px;
  border-top: 1px solid #2c2c32;
  background: #18181c;
}
</style>
