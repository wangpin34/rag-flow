<script setup lang="ts">
import {
  NButton,
  NConfigProvider,
  NIcon,
  NLayout,
  NLayoutContent,
  NLayoutSider,
  NMessageProvider,
  NSpace,
  darkTheme,
} from 'naive-ui';
import { ref } from 'vue';
import ChatList from './components/ChatList.vue';
import ChatView from './components/ChatView.vue';
import SettingsModal from './components/SettingsModal.vue';

const showSettings = ref(false);
const selectedChatId = ref<number | null>(null);
const chatListKey = ref(0);

const handleSelectChat = (id: number) => {
  selectedChatId.value = id;
};

const handleChatCreated = (id: number) => {
  selectedChatId.value = id;
  chatListKey.value++; // Force refresh chat list
};

const handleChatUpdated = () => {
  chatListKey.value++; // Force refresh chat list
};

const handleNewChat = () => {
  selectedChatId.value = null;
};

const openSettings = () => {
  showSettings.value = true;
};

const openAbout = () => {
  // TODO: Implement about dialog
  console.log('About clicked');
};

const openHelp = () => {
  // TODO: Implement help dialog
  console.log('Help clicked');
};

const siderWidth = ref(280);
let _dragStartX = 0;
let _dragStartWidth = 280;

const onResizeStart = (e: PointerEvent) => {
  _dragStartX = e.clientX;
  _dragStartWidth = siderWidth.value;
  (e.target as HTMLElement).setPointerCapture(e.pointerId);
};

const onResizeMove = (e: PointerEvent) => {
  if (!(e.target as HTMLElement).hasPointerCapture(e.pointerId)) return;
  siderWidth.value = Math.max(180, Math.min(600, _dragStartWidth + e.clientX - _dragStartX));
};

const onResizeEnd = (e: PointerEvent) => {
  (e.target as HTMLElement).releasePointerCapture(e.pointerId);
};
</script>

<template>
  <n-config-provider :theme="darkTheme">
    <n-message-provider>
      <n-layout has-sider style="height: 100vh">
      <n-layout-sider
        bordered
        :width="siderWidth"
        :native-scrollbar="false"
        style="position: relative; overflow: hidden; flex-shrink: 0"
      >
        <!-- Resize handle -->
        <div
          style="position: absolute; top: 0; right: 0; width: 4px; height: 100%; cursor: ew-resize; z-index: 100; background: transparent"
          @pointerdown="onResizeStart"
          @pointermove="onResizeMove"
          @pointerup="onResizeEnd"
        />
        <!-- Chat history: fills full height, scrollable, with bottom padding to clear the nav -->
        <div style="display: flex; flex-direction: column; height: 100%">
          <div style="padding: 16px; padding-bottom: 8px; flex-shrink: 0">
            <n-button type="primary" block @click="handleNewChat">
              <template #icon>
                <n-icon>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </n-icon>
              </template>
              New Chat
            </n-button>
          </div>
          <div style="flex: 1; overflow-y: auto; padding-bottom: 120px">
            <ChatList :key="chatListKey" @select-chat="handleSelectChat" />
          </div>
        </div>

        <!-- Bottom nav: absolutely positioned, overlaps the chat list -->
        <div
          style="
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            padding: 8px;
            background: inherit;
            border-top: 1px solid rgba(255, 255, 255, 0.09);
          "
        >
          <n-space vertical :size="4">
            <n-button text block @click="openSettings">
              <template #icon>
                <n-icon>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path
                      d="M12 1v6m0 6v6m-7-7h6m6 0h6m-2.1 7.1l-4.2-4.2m0-5.8l4.2-4.2M4.9 19.1l4.2-4.2m0-5.8L4.9 4.9"
                    />
                  </svg>
                </n-icon>
              </template>
              Settings
            </n-button>
            <n-button text block @click="openAbout">
              <template #icon>
                <n-icon>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </n-icon>
              </template>
              About
            </n-button>
            <n-button text block @click="openHelp">
              <template #icon>
                <n-icon>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </n-icon>
              </template>
              Help
            </n-button>
          </n-space>
        </div>
      </n-layout-sider>

      <n-layout-content :native-scrollbar="false" style="height: 100vh; overflow: hidden">
        <ChatView
          :chat-id="selectedChatId"
          @chat-created="handleChatCreated"
          @chat-updated="handleChatUpdated"
        />
      </n-layout-content>
    </n-layout>

    <SettingsModal v-model:show="showSettings" />
    </n-message-provider>
  </n-config-provider>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body,
#app {
  height: 100%;
  width: 100%;
  overflow: hidden;
}
</style>
