<script setup lang="ts">
import {
    NButton,
    NConfigProvider,
    NDivider,
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
import SettingsModal from './components/SettingsModal.vue';

const showSettings = ref(false);
const selectedChatId = ref<number | null>(null);

const handleSelectChat = (id: number) => {
  selectedChatId.value = id;
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
</script>

<template>
  <n-config-provider :theme="darkTheme">
    <n-message-provider>
      <n-layout has-sider style="height: 100vh">
      <n-layout-sider
        bordered
        collapse-mode="width"
        :collapsed-width="64"
        :width="280"
        show-trigger
        :native-scrollbar="false"
        style="display: flex; flex-direction: column"
      >
        <!-- Top section: Chat history -->
        <div style="flex: 1; overflow: hidden; display: flex; flex-direction: column">
          <div style="padding: 16px; padding-bottom: 8px">
            <n-button type="primary" block @click="selectedChatId = null">
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
          <div style="flex: 1; overflow: hidden">
            <ChatList @select-chat="handleSelectChat" />
          </div>
        </div>

        <n-divider style="margin: 0" />

        <!-- Bottom section: Settings/About/Help -->
        <div style="padding: 8px">
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

      <n-layout-content
        content-style="padding: 24px; display: flex; flex-direction: column; height: 100vh;"
      >
        <div
          v-if="selectedChatId === null"
          style="
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
          "
        >
          <h1 style="margin-bottom: 16px">Welcome to Simple RAG</h1>
          <p style="color: var(--n-text-color-disabled)">Select a chat or start a new one</p>
        </div>
        <div
          v-else
          style="
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
          "
        >
          <h2>Chat {{ selectedChatId }}</h2>
          <p style="color: var(--n-text-color-disabled)">
            Chat interface will be implemented here
          </p>
        </div>
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
