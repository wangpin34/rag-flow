<template>
  <n-scrollbar style="max-height: 100%">
    <n-list hoverable clickable>
      <n-list-item
        v-for="chat in chats"
        :key="chat.id"
        @click="selectChat(chat.id)"
        :class="{ active: selectedChatId === chat.id }"
      >
        <template #prefix>
          <n-icon>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </n-icon>
        </template>
        <n-thing :title="chat.title" :description="chat.preview" />
      </n-list-item>
    </n-list>
    <n-empty v-if="chats.length === 0" description="No chats yet" style="margin-top: 60px" />
  </n-scrollbar>
</template>

<script setup lang="ts">
import { NEmpty, NIcon, NList, NListItem, NScrollbar, NThing } from 'naive-ui';
import { ref } from 'vue';

interface Chat {
  id: number;
  title: string;
  preview: string;
  updatedAt: Date;
}

const emit = defineEmits<{
  selectChat: [id: number];
}>();

const selectedChatId = ref<number | null>(null);

// Mock data - replace with actual API calls
const chats = ref<Chat[]>([
  {
    id: 1,
    title: 'New Chat',
    preview: 'How can I help you today?',
    updatedAt: new Date(),
  },
  {
    id: 2,
    title: 'Previous Conversation',
    preview: 'Let me explain that...',
    updatedAt: new Date(Date.now() - 86400000),
  },
]);

const selectChat = (id: number) => {
  selectedChatId.value = id;
  emit('selectChat', id);
};
</script>

<style scoped>
.n-list-item.active {
  background-color: var(--n-color-hover);
}
</style>
