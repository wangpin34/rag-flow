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

const siderVisible = ref(true);
const siderWidth = ref(280);
let _dragStartX = 0;
let _dragStartWidth = 280;

const toggleSider = () => {
  siderVisible.value = !siderVisible.value;
};

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
        v-if="siderVisible"
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
          <div style="padding: 12px 16px 8px; flex-shrink: 0; display: flex; justify-content: space-between; align-items: center">
            <n-button circle @click="toggleSider" title="Hide sidebar">
              <template #icon>
                <n-icon>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="9" y1="3" x2="9" y2="21" />
                  </svg>
                </n-icon>
              </template>
            </n-button>
            <n-button circle type="primary" @click="handleNewChat" title="New Chat">
              <template #icon>
                <n-icon>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </n-icon>
              </template>
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

      <n-layout-content :native-scrollbar="false" style="height: 100vh; overflow: hidden; position: relative">
        <!-- Toggle button shown when sidebar is hidden -->
        <div v-if="!siderVisible" style="position: absolute; top: 12px; left: 12px; z-index: 10">
          <n-button circle @click="toggleSider" title="Show sidebar">
            <template #icon>
              <n-icon>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                </svg>
              </n-icon>
            </template>
          </n-button>
        </div>
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
