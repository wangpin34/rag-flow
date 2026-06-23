<template>
  <n-modal
    v-model:show="showModal"
    preset="card"
    title="Settings"
    :style="{ width: '100vw', height: '100vh', maxHeight: '100vh', borderRadius: 0, margin: 0 }"
    :content-style="{ height: 'calc(100vh - 110px)', overflowY: 'auto' }"
    :segmented="{ content: 'soft' }"
  >
    <n-tabs type="line" animated>
      <n-tab-pane name="providers" tab="Model Providers">
        <n-space vertical :size="16">
          <n-button type="primary" @click="showAddProvider = true">
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
            Add Provider
          </n-button>

          <n-data-table
            :columns="providerColumns"
            :data="providers"
            :pagination="false"
            :bordered="false"
          />
        </n-space>
      </n-tab-pane>

      <n-tab-pane name="models" tab="Models">
        <n-space vertical :size="16">
          <n-select
            v-model:value="selectedProvider"
            :options="providerOptions"
            placeholder="Filter by provider"
            clearable
          />

          <n-data-table :columns="modelColumns" :data="filteredModels" :pagination="false" />
        </n-space>
      </n-tab-pane>

      <n-tab-pane name="knowledge" tab="Knowledge Bases">
        <n-empty description="Knowledge base management coming soon" style="margin-top: 40px">
          <template #icon>
            <n-icon size="48">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path
                  d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"
                />
              </svg>
            </n-icon>
          </template>
        </n-empty>
      </n-tab-pane>
    </n-tabs>
  </n-modal>

  <!-- Add Provider Modal -->
  <n-modal v-model:show="showAddProvider" preset="dialog" title="Add Provider">
    <n-form :model="newProvider" label-placement="left" label-width="120">
      <n-form-item label="Name" required>
        <n-input v-model:value="newProvider.name" placeholder="OpenAI, Anthropic, etc." />
      </n-form-item>
      <n-form-item label="API Endpoint">
        <n-input v-model:value="newProvider.apiEndpoint" placeholder="https://api.openai.com/v1" />
      </n-form-item>
      <n-form-item label="API Key Name">
        <n-input v-model:value="newProvider.apiKeyName" placeholder="OPENAI_API_KEY" />
      </n-form-item>
    </n-form>
    <template #action>
      <n-space>
        <n-button @click="showAddProvider = false">Cancel</n-button>
        <n-button type="primary" @click="handleAddProvider">Add</n-button>
      </n-space>
    </template>
  </n-modal>

  <!-- Provider Details Drawer -->
  <ProviderDetails
    v-model:show="showProviderDetails"
    :provider-id="selectedProviderId"
    @refresh="loadData"
  />
</template>

<script setup lang="ts">
import {
  NButton,
  NDataTable,
  NEmpty,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NModal,
  NSelect,
  NSpace,
  NSwitch,
  NTabPane,
  NTabs,
  useMessage,
  type DataTableColumns,
} from 'naive-ui';
import { computed, h, onMounted, ref, watch } from 'vue';
import ProviderDetails from './ProviderDetails.vue';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  'update:show': [value: boolean];
}>();

const message = useMessage();
const showModal = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
});

const showAddProvider = ref(false);
const selectedProvider = ref<number | null>(null);
const providers = ref<any[]>([]);
const models = ref<any[]>([]);
const showProviderDetails = ref(false);
const selectedProviderId = ref<number | null>(null);

const newProvider = ref({
  name: '',
  apiEndpoint: '',
  apiKeyName: '',
});

// Provider columns
const providerColumns: DataTableColumns<any> = [
  { title: 'Name', key: 'name' },
  { title: 'API Endpoint', key: 'apiEndpoint', ellipsis: { tooltip: true } },
  { title: 'API Key', key: 'apiKeyName' },
  {
    title: 'Active',
    key: 'isActive',
    width: 80,
    render: (row) =>
      h(NSwitch, {
        value: row.isActive,
        onUpdateValue: () => toggleProviderActive(row.id),
      }),
  },
  {
    title: 'Actions',
    key: 'actions',
    width: 120,
    render: (row) =>
      h(
        NButton,
        {
          size: 'small',
          onClick: () => openProviderDetails(row.id),
        },
        { default: () => 'Manage Models' }
      ),
  },
];

// Model columns
const modelColumns: DataTableColumns<any> = [
  { title: 'Name', key: 'name' },
  { title: 'Display Name', key: 'displayName' },
  { title: 'Type', key: 'modelType' },
  { title: 'Context Window', key: 'contextWindow' },
  {
    title: 'Active',
    key: 'isActive',
    render: (row) =>
      h(NSwitch, {
        value: row.isActive,
        onUpdateValue: () => toggleModelActive(row.id),
      }),
  },
];

const providerOptions = computed(() =>
  providers.value.map((p) => ({ label: p.name, value: p.id })),
);

const filteredModels = computed(() => {
  if (!selectedProvider.value) return models.value;
  return models.value.filter((m) => m.providerId === selectedProvider.value);
});

// Open provider details
const openProviderDetails = (providerId: number) => {
  selectedProviderId.value = providerId;
  showProviderDetails.value = true;
};

// Load providers and models
const loadData = async () => {
  try {
    providers.value = await window.api.provider.findAll(true); // Include inactive
    models.value = await window.api.model.findAll({ includeInactive: true }); // Include inactive
  } catch (error) {
    console.error('Error loading data:', error);
    message.error('Failed to load data');
  }
};

const handleAddProvider = async () => {
  try {
    await window.api.provider.create({
      name: newProvider.value.name,
      apiEndpoint: newProvider.value.apiEndpoint || null,
      apiKeyName: newProvider.value.apiKeyName || null,
    });
    message.success('Provider added successfully');
    showAddProvider.value = false;
    newProvider.value = { name: '', apiEndpoint: '', apiKeyName: '' };
    await loadData();
  } catch (error) {
    message.error('Failed to add provider');
    console.error(error);
  }
};

const toggleProviderActive = async (id: number) => {
  try {
    await window.api.provider.toggleActive(id);
    await loadData();
  } catch (error) {
    message.error('Failed to toggle provider status');
    console.error(error);
  }
};

const toggleModelActive = async (id: number) => {
  try {
    await window.api.model.toggleActive(id);
    await loadData();
  } catch (error) {
    message.error('Failed to toggle model status');
    console.error(error);
  }
};

// Watch for modal open and load data
watch(showModal, (isOpen) => {
  if (isOpen) {
    loadData();
  }
});

onMounted(() => {
  if (showModal.value) {
    loadData();
  }
});
</script>
