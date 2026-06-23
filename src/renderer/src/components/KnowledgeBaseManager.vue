<template>
  <n-space vertical :size="16">
    <div style="display: flex; justify-content: flex-end">
      <n-button type="primary" @click="openCreate">
        <template #icon>
          <n-icon>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </n-icon>
        </template>
        Add Knowledge Base
      </n-button>
    </div>

    <n-data-table
      :columns="columns"
      :data="collections"
      :loading="loading"
      :bordered="false"
      :row-key="(row: any) => row.id"
    />

    <!-- Create Modal -->
    <n-modal
      v-model:show="showCreate"
      preset="card"
      title="Create Knowledge Base"
      :style="{ width: '560px' }"
    >
      <n-form :model="form" label-placement="left" label-width="110">
        <n-form-item label="Name" required>
          <n-input v-model:value="form.name" placeholder="My Knowledge Base" />
        </n-form-item>
        <n-form-item label="Description">
          <n-input
            v-model:value="form.description"
            type="textarea"
            placeholder="Optional description..."
            :rows="3"
          />
        </n-form-item>
        <n-form-item label="Files">
          <div style="width: 100%">
            <n-button @click="triggerFileInput" style="margin-bottom: 12px">
              <template #icon>
                <n-icon>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="16 16 12 12 8 16" />
                    <line x1="12" y1="12" x2="12" y2="21" />
                    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
                  </svg>
                </n-icon>
              </template>
              Select Files
            </n-button>
            <input
              ref="fileInputRef"
              type="file"
              multiple
              accept=".txt,.md,.pdf,.json,.csv,.html,.xml"
              style="display: none"
              @change="handleFileChange"
            />
            <div
              v-if="form.files.length"
              style="border: 1px solid rgba(255,255,255,0.12); border-radius: 4px; max-height: 200px; overflow-y: auto"
            >
              <div
                v-for="(file, i) in form.files"
                :key="i"
                style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.06)"
              >
                <n-space align="center" :size="8">
                  <n-icon size="16" color="#aaa">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </n-icon>
                  <n-text style="font-size: 13px">{{ file.name }}</n-text>
                  <n-text depth="3" style="font-size: 12px">{{ formatSize(file.size) }}</n-text>
                </n-space>
                <n-button text size="small" type="error" @click="removeFile(i)">Remove</n-button>
              </div>
            </div>
            <n-text v-else depth="3" style="font-size: 13px">No files selected</n-text>
          </div>
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showCreate = false">Cancel</n-button>
          <n-button type="primary" :loading="creating" @click="handleCreate">Create</n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- Documents Modal -->
    <n-modal
      v-model:show="showDocs"
      preset="card"
      :title="`${selectedCollection?.name ?? ''} — Files`"
      :style="{ width: '760px', maxHeight: '80vh' }"
      :content-style="{ overflowY: 'auto' }"
    >
      <n-data-table
        :columns="docColumns"
        :data="documents"
        :loading="docsLoading"
        :bordered="false"
        :row-key="(row: any) => row.id"
      />
    </n-modal>

    <!-- Document Detail Modal -->
    <n-modal
      v-model:show="showDetail"
      preset="card"
      :title="selectedDoc?.source ?? 'Document Detail'"
      :style="{ width: '900px', height: '80vh' }"
      :content-style="{ height: 'calc(80vh - 110px)', overflowY: 'auto' }"
    >
      <div v-if="detailLoading" style="display:flex;justify-content:center;padding:40px">
        <n-spin size="large" />
      </div>
      <template v-else-if="docDetail">
        <n-space style="margin-bottom:16px" :size="24">
          <n-text depth="3" style="font-size:13px">Source: {{ docDetail.source ?? '—' }}</n-text>
          <n-text depth="3" style="font-size:13px">Added: {{ new Date(docDetail.createdAt).toLocaleString() }}</n-text>
          <n-text depth="3" style="font-size:13px">Chunks: {{ docDetail.chunks.length }}</n-text>
        </n-space>
        <n-tabs type="line" animated>
          <n-tab-pane name="content" tab="Source Content">
            <n-scrollbar style="max-height: calc(80vh - 220px)">
              <pre style="white-space: pre-wrap; word-break: break-all; font-size: 13px; font-family: monospace; margin: 0; padding: 16px; background: rgba(255,255,255,0.04); border-radius: 6px; line-height: 1.6">{{ docDetail.content }}</pre>
            </n-scrollbar>
          </n-tab-pane>
          <n-tab-pane name="chunks" tab="Chunks">
            <n-scrollbar style="max-height: calc(80vh - 220px)">
              <div
                v-for="chunk in docDetail.chunks"
                :key="chunk.id"
                style="margin-bottom: 12px; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; overflow: hidden"
              >
                <div style="display:flex;align-items:center;gap:12px;padding:8px 12px;background:rgba(255,255,255,0.05);border-bottom:1px solid rgba(255,255,255,0.08)">
                  <n-tag size="small" round>Chunk {{ chunk.chunkIndex + 1 }}</n-tag>
                  <n-text depth="3" style="font-size:12px">{{ chunk.content.length }} chars</n-text>
                </div>
                <pre style="white-space: pre-wrap; word-break: break-all; font-size: 13px; font-family: monospace; margin: 0; padding: 12px; line-height: 1.6">{{ chunk.content }}</pre>
              </div>
              <n-empty v-if="!docDetail.chunks.length" description="No chunks" style="padding: 40px" />
            </n-scrollbar>
          </n-tab-pane>
        </n-tabs>
      </template>
      <n-empty v-else description="Failed to load document" style="padding: 40px" />
    </n-modal>
  </n-space>
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
    NScrollbar,
    NSpace,
    NSpin,
    NTabPane,
    NTabs,
    NTag,
    NText,
    useMessage,
    type DataTableColumns,
} from 'naive-ui';
import { h, onMounted, ref } from 'vue';

const message = useMessage();

const loading = ref(false);
const creating = ref(false);
const collections = ref<any[]>([]);
const showCreate = ref(false);
const showDocs = ref(false);
const documents = ref<any[]>([]);
const docsLoading = ref(false);
const selectedCollection = ref<any>(null);
const showDetail = ref(false);
const selectedDoc = ref<any>(null);
const docDetail = ref<any>(null);
const detailLoading = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);

const form = ref<{ name: string; description: string; files: File[] }>({
  name: '',
  description: '',
  files: [],
});

const openCreate = () => {
  form.value = { name: '', description: '', files: [] };
  showCreate.value = true;
};

const triggerFileInput = () => fileInputRef.value?.click();

const handleFileChange = (e: Event) => {
  const input = e.target as HTMLInputElement;
  if (!input.files) return;
  form.value.files.push(...Array.from(input.files));
  input.value = '';
};

const removeFile = (i: number) => {
  form.value.files.splice(i, 1);
};

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const loadCollections = async () => {
  loading.value = true;
  try {
    collections.value = await window.api.collection.findAll();
  } catch {
    message.error('Failed to load knowledge bases');
  } finally {
    loading.value = false;
  }
};

const handleCreate = async () => {
  if (!form.value.name.trim()) {
    message.warning('Name is required');
    return;
  }
  creating.value = true;
  try {
    const kb = await window.api.collection.create({
      name: form.value.name.trim(),
      description: form.value.description.trim() || undefined,
    });
    for (const file of form.value.files) {
      const content = await file.text();
      await window.api.collection.addDocument(kb.id, { content, fileName: file.name });
    }
    message.success('Knowledge base created');
    showCreate.value = false;
    await loadCollections();
  } catch (err: any) {
    message.error(err?.message ?? 'Failed to create knowledge base');
  } finally {
    creating.value = false;
  }
};

const openDocs = async (row: any) => {
  selectedCollection.value = row;
  documents.value = [];
  showDocs.value = true;
  docsLoading.value = true;
  try {
    documents.value = await window.api.collection.getDocuments(row.id);
  } catch {
    message.error('Failed to load files');
  } finally {
    docsLoading.value = false;
  }
};

const openDocDetail = async (row: any) => {
  selectedDoc.value = row;
  docDetail.value = null;
  showDetail.value = true;
  detailLoading.value = true;
  try {
    docDetail.value = await window.api.collection.getDocumentDetail(row.id);
  } catch {
    message.error('Failed to load document detail');
  } finally {
    detailLoading.value = false;
  }
};

const handleDelete = async (row: any) => {
  try {
    await window.api.collection.delete(row.id);
    message.success('Knowledge base deleted');
    await loadCollections();
  } catch {
    message.error('Failed to delete knowledge base');
  }
};

const columns: DataTableColumns<any> = [
  { title: 'Name', key: 'name' },
  { title: 'Description', key: 'description', ellipsis: { tooltip: true } },
  {
    title: 'Files',
    key: 'documentCount',
    width: 70,
    align: 'center',
  },
  {
    title: 'Created',
    key: 'createdAt',
    width: 120,
    render: (row) => new Date(row.createdAt).toLocaleDateString(),
  },
  {
    title: 'Actions',
    key: 'actions',
    width: 160,
    render: (row) =>
      h(NSpace, { size: 8 }, {
        default: () => [
          h(NButton, { size: 'small', onClick: () => openDocs(row) }, { default: () => 'View Files' }),
          h(NButton, { size: 'small', type: 'error', onClick: () => handleDelete(row) }, { default: () => 'Delete' }),
        ],
      }),
  },
];

const docColumns: DataTableColumns<any> = [
  {
    title: 'File Name',
    key: 'source',
    render: (row) => row.source ?? '—',
  },
  {
    title: 'Added',
    key: 'createdAt',
    width: 140,
    render: (row) => new Date(row.createdAt).toLocaleDateString(),
  },
  {
    title: 'Actions',
    key: 'actions',
    width: 160,
    render: (row) =>
      h(NSpace, { size: 8 }, {
        default: () => [
          h(NButton, { size: 'small', onClick: () => openDocDetail(row) }, { default: () => 'Details' }),
          h(NButton, {
            size: 'small',
            type: 'error',
            text: true,
            onClick: async () => {
              try {
                await window.api.collection.removeDocument(row.id);
                documents.value = documents.value.filter((d) => d.id !== row.id);
                await loadCollections();
              } catch {
                message.error('Failed to remove file');
              }
            },
          }, { default: () => 'Remove' }),
        ],
      }),
  },
];

onMounted(loadCollections);
</script>
