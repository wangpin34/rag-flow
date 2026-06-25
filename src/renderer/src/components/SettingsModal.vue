<template>
  <n-modal
    v-model:show="showModal"
    preset="card"
    title="Settings"
    :style="{ width: '100vw', height: '100vh', maxHeight: '100vh', borderRadius: 0, margin: 0 }"
    :content-style="{ height: 'calc(100vh - 110px)', padding: 0, overflow: 'hidden' }"
    :segmented="{ content: 'soft' }"
  >
    <div style="display: flex; height: 100%; overflow: hidden">
      <!-- Sidebar -->
      <div style="width: 200px; flex-shrink: 0; border-right: 1px solid rgba(255,255,255,0.09); display: flex; flex-direction: column; padding: 12px 0; overflow-y: auto">
        <div
          v-for="item in navItems"
          :key="item.key"
          @click="activeSection = item.key"
          :style="{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '9px 20px',
            cursor: 'pointer',
            borderRadius: '6px',
            margin: '1px 8px',
            fontSize: '14px',
            background: activeSection === item.key ? 'rgba(255,255,255,0.1)' : 'transparent',
            color: activeSection === item.key ? 'var(--n-text-color)' : 'var(--n-text-color-3)',
            fontWeight: activeSection === item.key ? 500 : 400,
            transition: 'background 0.15s',
          }"
        >
          <n-icon size="16" v-html="item.icon" />
          {{ item.label }}
        </div>
      </div>

      <!-- Content -->
      <div style="flex: 1; overflow-y: auto; padding: 24px 28px">
        <!-- Model Providers -->
        <template v-if="activeSection === 'providers'">
          <n-space vertical :size="16">
            <n-button type="primary" @click="showAddProvider = true">
              <template #icon>
                <n-icon>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </n-icon>
              </template>
              Add Provider
            </n-button>
            <n-data-table :columns="providerColumns" :data="providers" :pagination="false" :bordered="false" />
          </n-space>
        </template>

        <!-- Models -->
        <template v-else-if="activeSection === 'models'">
          <n-space vertical :size="16">
            <n-select
              v-model:value="selectedProvider"
              :options="providerOptions"
              placeholder="Filter by provider"
              clearable
            />
            <n-data-table :columns="modelColumns" :data="filteredModels" :pagination="false" />
          </n-space>
        </template>

        <!-- Knowledge Bases -->
        <template v-else-if="activeSection === 'knowledge'">
          <KnowledgeBaseManager />
        </template>
      </div>
    </div>
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
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NModal,
  NSelect,
  NSpace,
  NSwitch,
  useMessage,
  type DataTableColumns,
} from 'naive-ui';
import { computed, h, onMounted, ref, watch } from 'vue';
import KnowledgeBaseManager from './KnowledgeBaseManager.vue';
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

const activeSection = ref('providers');

const navItems = [
  {
    key: 'providers',
    label: 'Model Providers',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  },
  {
    key: 'models',
    label: 'Models',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M4.22 4.22l2.83 2.83m9.9 9.9 2.83 2.83M2 12h4m12 0h4M4.22 19.78l2.83-2.83m9.9-9.9 2.83-2.83"/></svg>`,
  },
  {
    key: 'knowledge',
    label: 'Knowledge Bases',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  },
];

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
