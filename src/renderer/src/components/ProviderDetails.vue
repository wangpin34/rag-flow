<template>
  <n-drawer v-model:show="showDrawer" :width="600" placement="right">
    <n-drawer-content :title="`${provider?.name} - Models`">
      <n-space vertical :size="16">
        <!-- Provider Info -->
        <n-card size="small" title="Provider Information">
          <n-descriptions :column="1" size="small">
            <n-descriptions-item label="Name">{{ provider?.name }}</n-descriptions-item>
            <n-descriptions-item label="API Endpoint">{{
              provider?.apiEndpoint || 'N/A'
            }}</n-descriptions-item>
            <n-descriptions-item label="Status">
              <n-tag :type="provider?.isActive ? 'success' : 'default'">
                {{ provider?.isActive ? 'Active' : 'Inactive' }}
              </n-tag>
            </n-descriptions-item>
          </n-descriptions>
        </n-card>

        <!-- Actions -->
        <n-space>
          <n-button type="primary" @click="showAddModelForm = true">
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
            Add Model Manually
          </n-button>

          <n-button
            v-if="isKnownProvider"
            type="info"
            :loading="loadingModels"
            @click="handleListModels"
          >
            <template #icon>
              <n-icon>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
              </n-icon>
            </template>
            List Models from API
          </n-button>
        </n-space>

        <!-- Models List -->
        <n-card size="small" title="Models">
          <n-data-table
            :columns="modelColumns"
            :data="models"
            :pagination="false"
            :max-height="400"
            size="small"
          />
          <n-empty v-if="models.length === 0" description="No models yet" style="margin: 20px 0" />
        </n-card>
      </n-space>
    </n-drawer-content>
  </n-drawer>

  <!-- Add/Edit Model Modal -->
  <n-modal v-model:show="showAddModelForm" preset="card" title="Add Model" style="width: 600px">
    <n-form :model="modelForm" label-placement="left" label-width="140">
      <n-form-item label="Model Name" required>
        <n-input v-model:value="modelForm.name" placeholder="e.g., gpt-4, llama3.2" />
      </n-form-item>
      <n-form-item label="Display Name">
        <n-input v-model:value="modelForm.displayName" placeholder="e.g., GPT-4, Llama 3.2" />
      </n-form-item>
      <n-form-item label="Model Type" required>
        <n-select
          v-model:value="modelForm.modelType"
          :options="modelTypeOptions"
          placeholder="Select model type"
        />
      </n-form-item>
      <n-form-item label="Context Window">
        <n-input-number
          v-model:value="modelForm.contextWindow"
          placeholder="e.g., 8192"
          :min="0"
          style="width: 100%"
        />
      </n-form-item>
      <n-form-item
        v-if="modelForm.modelType === 'embedding'"
        label="Embedding Dimensions"
      >
        <n-input-number
          v-model:value="modelForm.embeddingDim"
          placeholder="e.g., 768, 1536"
          :min="0"
          style="width: 100%"
        />
      </n-form-item>
      <n-form-item label="Active">
        <n-switch v-model:value="modelForm.isActive" />
      </n-form-item>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button @click="showAddModelForm = false">Cancel</n-button>
        <n-button type="primary" @click="handleAddModel">Add Model</n-button>
      </n-space>
    </template>
  </n-modal>

  <!-- API Key Modal for OpenAI -->
  <n-modal v-model:show="showApiKeyModal" preset="dialog" title="Enter API Key">
    <n-form>
      <n-form-item label="API Key" required>
        <n-input
          v-model:value="apiKey"
          type="password"
          placeholder="sk-..."
          show-password-on="click"
        />
      </n-form-item>
    </n-form>
    <template #action>
      <n-space>
        <n-button @click="showApiKeyModal = false">Cancel</n-button>
        <n-button type="primary" @click="fetchModelsWithApiKey">Fetch Models</n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import {
    NButton,
    NCard,
    NDataTable,
    NDescriptions,
    NDescriptionsItem,
    NDrawer,
    NDrawerContent,
    NEmpty,
    NForm,
    NFormItem,
    NIcon,
    NInput,
    NInputNumber,
    NModal,
    NSelect,
    NSpace,
    NSwitch,
    NTag,
    useMessage,
    type DataTableColumns,
} from 'naive-ui';
import { computed, h, ref, watch } from 'vue';

const props = defineProps<{
  show: boolean;
  providerId: number | null;
}>();

const emit = defineEmits<{
  'update:show': [value: boolean];
  refresh: [];
}>();

const message = useMessage();
const showDrawer = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
});

const provider = ref<any>(null);
const models = ref<any[]>([]);
const loadingModels = ref(false);
const showAddModelForm = ref(false);
const showApiKeyModal = ref(false);
const apiKey = ref('');

const modelForm = ref({
  name: '',
  displayName: '',
  modelType: 'chat',
  contextWindow: null as number | null,
  embeddingDim: null as number | null,
  isActive: false,
});

const modelTypeOptions = [
  { label: 'Chat', value: 'chat' },
  { label: 'Embedding', value: 'embedding' },
  { label: 'Completion', value: 'completion' },
];

const isKnownProvider = computed(() => {
  if (!provider.value) return false;
  const name = provider.value.name.toLowerCase();
  return name === 'ollama' || name === 'openai';
});

// Model columns
const modelColumns: DataTableColumns<any> = [
  { title: 'Name', key: 'name', ellipsis: { tooltip: true } },
  { title: 'Type', key: 'modelType', width: 100 },
  { title: 'Context', key: 'contextWindow', width: 100 },
  {
    title: 'Active',
    key: 'isActive',
    width: 80,
    render: (row) =>
      h(NSwitch, {
        value: row.isActive,
        onUpdateValue: () => toggleModelActive(row.id),
      }),
  },
];

// Load provider and models
const loadData = async () => {
  if (!props.providerId) return;

  try {
    provider.value = await window.api.provider.findById(props.providerId);
    models.value = await window.api.model.findByProviderId(props.providerId, true);
  } catch (error) {
    console.error('Error loading provider details:', error);
    message.error('Failed to load provider details');
  }
};

// Watch for drawer open
watch(showDrawer, (isOpen) => {
  if (isOpen) {
    loadData();
  }
});

// Handle list models from API
const handleListModels = async () => {
  if (!provider.value) return;

  // If OpenAI, ask for API key
  if (provider.value.name.toLowerCase() === 'openai') {
    showApiKeyModal.value = true;
    return;
  }

  // For Ollama, fetch directly
  await fetchModelsFromProvider();
};

const fetchModelsWithApiKey = async () => {
  if (!apiKey.value) {
    message.error('Please enter an API key');
    return;
  }
  showApiKeyModal.value = false;
  await fetchModelsFromProvider(apiKey.value);
  apiKey.value = '';
};

const fetchModelsFromProvider = async (key?: string) => {
  if (!props.providerId) return;

  loadingModels.value = true;
  try {
    const result = await window.api.provider.listModels(props.providerId, key);
    message.success(`Found ${result.total} models, added ${result.added} new models`);
    await loadData();
    emit('refresh');
  } catch (error: any) {
    console.error('Error listing models:', error);
    message.error(`Failed to list models: ${error.message || error}`);
  } finally {
    loadingModels.value = false;
  }
};

// Handle add model manually
const handleAddModel = async () => {
  if (!props.providerId || !modelForm.value.name || !modelForm.value.modelType) {
    message.error('Please fill in required fields');
    return;
  }

  try {
    await window.api.model.create({
      provider: { connect: { id: props.providerId } },
      name: modelForm.value.name,
      displayName: modelForm.value.displayName || modelForm.value.name,
      modelType: modelForm.value.modelType,
      contextWindow: modelForm.value.contextWindow,
      embeddingDim: modelForm.value.embeddingDim,
      isActive: modelForm.value.isActive,
    });

    message.success('Model added successfully');
    showAddModelForm.value = false;
    modelForm.value = {
      name: '',
      displayName: '',
      modelType: 'chat',
      contextWindow: null,
      embeddingDim: null,
      isActive: false,
    };
    await loadData();
    emit('refresh');
  } catch (error: any) {
    console.error('Error adding model:', error);
    message.error(`Failed to add model: ${error.message || error}`);
  }
};

// Toggle model active status
const toggleModelActive = async (modelId: number) => {
  try {
    await window.api.model.toggleActive(modelId);
    await loadData();
    emit('refresh');
  } catch (error) {
    console.error('Error toggling model:', error);
    message.error('Failed to toggle model status');
  }
};
</script>
