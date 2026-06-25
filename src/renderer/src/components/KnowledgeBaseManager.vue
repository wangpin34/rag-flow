<template>
  <n-space vertical :size="16">
    <div style="display: flex; justify-content: flex-end">
      <n-button type="primary" @click="openCreate">
        <template #icon>
          <n-icon>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </n-icon>
        </template>
        Add Knowledge Base
      </n-button>
    </div>

    <n-data-table :columns="kbColumns" :data="collections" :loading="loading" :bordered="false" :row-key="(r) => r.id" />

    <!-- Create Modal -->
    <n-modal v-model:show="showCreate" preset="card" title="Create Knowledge Base" :style="{ width: '560px' }">
      <n-form :model="form" label-placement="left" label-width="110">
        <n-form-item label="Name" required>
          <n-input v-model:value="form.name" placeholder="My Knowledge Base" />
        </n-form-item>
        <n-form-item label="Description">
          <n-input v-model:value="form.description" type="textarea" placeholder="Optional description..." :rows="2" />
        </n-form-item>
        <n-form-item label="Files">
          <div style="width: 100%">
            <n-button @click="triggerFileInput" style="margin-bottom: 8px">
              <template #icon>
                <n-icon>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" />
                    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
                  </svg>
                </n-icon>
              </template>
              Select Files
            </n-button>
            <input ref="fileInputRef" id="kb-file-input" type="file" multiple accept=".txt,.md,.pdf,.json,.csv,.html,.xml" style="display: none" @change="handleFileChange" />
            <div v-if="form.files.length" style="border: 1px solid rgba(255,255,255,0.12); border-radius: 4px; max-height: 160px; overflow-y: auto">
              <div v-for="(f, i) in form.files" :key="i" style="display: flex; align-items: center; justify-content: space-between; padding: 6px 12px; border-bottom: 1px solid rgba(255,255,255,0.06)">
                <n-space align="center" :size="8">
                  <n-text style="font-size: 13px">{{ f.name }}</n-text>
                  <n-text depth="3" style="font-size: 12px">{{ formatSize(f.size) }}</n-text>
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

    <!-- Config Modal -->
    <n-modal v-model:show="showConfig" preset="card" :title="`Configure — ${configCollection?.name ?? ''}`" :style="{ width: '600px' }">
      <n-form :model="configForm" label-placement="left" label-width="150">
        <n-divider title-placement="left" style="font-size: 13px; margin: 0 0 16px">Parser</n-divider>
        <n-form-item label="Strategy">
          <n-select v-model:value="configForm.parser.strategy" :options="strategyOptions" />
        </n-form-item>
        <n-form-item label="Chunk Size (chars)">
          <n-input-number v-model:value="configForm.parser.chunkSize" :min="100" :max="8192" :step="100" style="width: 100%" />
        </n-form-item>
        <n-form-item label="Chunk Overlap (chars)">
          <n-input-number v-model:value="configForm.parser.chunkOverlap" :min="0" :max="2048" :step="50" style="width: 100%" />
        </n-form-item>
        <n-divider title-placement="left" style="font-size: 13px; margin: 16px 0">Embedding</n-divider>
        <n-form-item label="Embedding Model">
          <n-select v-model:value="configForm.embeddingModelId" :options="embeddingModelOptions" placeholder="Select embedding model" clearable />
        </n-form-item>
        <n-form-item label="Rerank Model">
          <n-select v-model:value="configForm.rerankModelId" :options="chatModelOptions" placeholder="Optional — select rerank model" clearable />
        </n-form-item>
        <n-divider title-placement="left" style="font-size: 13px; margin: 16px 0">Processing</n-divider>
        <n-form-item label="Auto Process">
          <n-space align="center">
            <n-switch v-model:value="configForm.autoProcess" />
            <n-text depth="3" style="font-size: 12px">Automatically parse & embed files on upload</n-text>
          </n-space>
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showConfig = false">Cancel</n-button>
          <n-button type="primary" :loading="configSaving" @click="saveConfig">Save</n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- Files Modal -->
    <n-modal
      v-model:show="showDocs"
      preset="card"
      :title="`${selectedCollection?.name ?? ''} — Files`"
      :style="{ width: '900px', maxHeight: '80vh' }"
      :content-style="{ overflowY: 'auto' }"
    >
      <div style="display: flex; justify-content: flex-end; margin-bottom: 12px">
        <n-button type="primary" :loading="processingAll" @click="handleProcessAll">
          <template #icon>
            <n-icon>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </n-icon>
          </template>
          Process All
        </n-button>
      </div>
      <n-data-table :columns="docColumns" :data="documents" :loading="docsLoading" :bordered="false" :row-key="(r) => r.id" />
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
              <div v-for="chunk in docDetail.chunks" :key="chunk.id" style="margin-bottom: 12px; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; overflow: hidden">
                <div style="display:flex;align-items:center;gap:12px;padding:8px 12px;background:rgba(255,255,255,0.05);border-bottom:1px solid rgba(255,255,255,0.08)">
                  <n-tag size="small" round>Chunk {{ chunk.chunkIndex + 1 }}</n-tag>
                  <n-text depth="3" style="font-size:12px">{{ chunk.content.length }} chars</n-text>
                </div>
                <pre style="white-space: pre-wrap; word-break: break-all; font-size: 13px; font-family: monospace; margin: 0; padding: 12px; line-height: 1.6">{{ chunk.content }}</pre>
              </div>
              <n-empty v-if="!docDetail.chunks.length" description="No chunks — run Parse first" style="padding: 40px" />
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
    NDivider,
    NEmpty,
    NForm,
    NFormItem,
    NIcon,
    NInput,
    NInputNumber,
    NModal,
    NScrollbar,
    NSelect,
    NSpace,
    NSpin,
    NSwitch,
    NTabPane,
    NTabs,
    NTag,
    NText,
    useMessage,
    type DataTableColumns,
} from 'naive-ui';
import { computed, h, onMounted, ref } from 'vue';

const message = useMessage();

const loading = ref(false);
const collections = ref<any[]>([]);

const showCreate = ref(false);
const creating = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);
const form = ref<{ name: string; description: string; files: File[] }>({ name: '', description: '', files: [] });

const showConfig = ref(false);
const configSaving = ref(false);
const configCollection = ref<any>(null);
const configForm = ref({
  parser: { strategy: 'paragraph' as 'paragraph' | 'fixed-size' | 'sentence', chunkSize: 1000, chunkOverlap: 200 },
  embeddingModelId: null as number | null,
  rerankModelId: null as number | null,
  autoProcess: false,
});
const embeddingModels = ref<any[]>([]);
const chatModels = ref<any[]>([]);

const showDocs = ref(false);
const docsLoading = ref(false);
const documents = ref<any[]>([]);
const selectedCollection = ref<any>(null);
const processingAll = ref(false);
const processingDocIds = ref(new Set<number>());

const showDetail = ref(false);
const detailLoading = ref(false);
const selectedDoc = ref<any>(null);
const docDetail = ref<any>(null);

const strategyOptions = [
  { label: 'Paragraph — split on blank lines', value: 'paragraph' },
  { label: 'Fixed Size — sliding window of N chars', value: 'fixed-size' },
  { label: 'Sentence — split on sentence boundaries', value: 'sentence' },
];

const embeddingModelOptions = computed(() =>
  embeddingModels.value.map((m) => ({
    label: `${m.displayName ?? m.name} (${m.provider?.name ?? ''})`,
    value: m.id,
  }))
);

const chatModelOptions = computed(() =>
  chatModels.value.map((m) => ({
    label: `${m.displayName ?? m.name} (${m.provider?.name ?? ''})`,
    value: m.id,
  }))
);

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const loadCollections = async () => {
  loading.value = true;
  try { collections.value = await window.api.collection.findAll(); }
  catch { message.error('Failed to load knowledge bases'); }
  finally { loading.value = false; }
};

const loadModels = async () => {
  try {
    const [emb, chat] = await Promise.all([
      window.api.model.findEmbeddingModels(false),
      window.api.model.findChatModels(false),
    ]);
    embeddingModels.value = emb;
    chatModels.value = chat;
  } catch { /* non-critical */ }
};

const openCreate = () => { form.value = { name: '', description: '', files: [] }; showCreate.value = true; };
const triggerFileInput = () => fileInputRef.value?.click();

const handleFileChange = (e: Event) => {
  const input = e.target as HTMLInputElement;
  if (!input.files) return;
  form.value.files.push(...Array.from(input.files));
  input.value = '';
};
const removeFile = (i: number) => form.value.files.splice(i, 1);

const handleCreate = async () => {
  if (!form.value.name.trim()) { message.warning('Name is required'); return; }
  creating.value = true;
  try {
    const kb = await window.api.collection.create({ name: form.value.name.trim(), description: form.value.description.trim() || undefined });
    const cfg = await window.api.collection.getConfig(kb.id);
    for (const file of form.value.files) {
      const content = await file.text();
      const doc = await window.api.collection.addDocument(kb.id, { content, fileName: file.name });
      if (cfg.autoProcess) {
        await window.api.collection.processDocument(doc.id, cfg).catch(() => {});
      }
    }
    message.success('Knowledge base created');
    showCreate.value = false;
    await loadCollections();
  } catch (err: any) {
    message.error(err?.message ?? 'Failed to create knowledge base');
  } finally { creating.value = false; }
};

const openConfig = async (row: any) => {
  configCollection.value = row;
  configSaving.value = false;
  await loadModels();
  const cfg = await window.api.collection.getConfig(row.id);
  configForm.value = {
    parser: { ...cfg.parser },
    embeddingModelId: cfg.embeddingModelId,
    rerankModelId: cfg.rerankModelId,
    autoProcess: cfg.autoProcess,
  };
  showConfig.value = true;
};

const saveConfig = async () => {
  if (!configCollection.value) return;
  configSaving.value = true;
  try {
    const plainConfig = JSON.parse(JSON.stringify(configForm.value));
    await window.api.collection.setConfig(configCollection.value.id, plainConfig);
    message.success('Configuration saved');
    showConfig.value = false;
  } catch { message.error('Failed to save configuration'); }
  finally { configSaving.value = false; }
};

const openDocs = async (row: any) => {
  selectedCollection.value = row;
  documents.value = [];
  showDocs.value = true;
  docsLoading.value = true;
  try { documents.value = await window.api.collection.getDocumentsWithStatus(row.id); }
  catch { message.error('Failed to load files'); }
  finally { docsLoading.value = false; }
};

const refreshDocs = async () => {
  if (!selectedCollection.value) return;
  documents.value = await window.api.collection.getDocumentsWithStatus(selectedCollection.value.id);
  await loadCollections();
};

const handleProcessAll = async () => {
  if (!selectedCollection.value) return;
  processingAll.value = true;
  try {
    const cfg = await window.api.collection.getConfig(selectedCollection.value.id);
    const result = await window.api.collection.processAll(selectedCollection.value.id, cfg);
    message.success(`Processed ${result.processed} file(s)${result.errors ? `, ${result.errors} error(s)` : ''}`);
    await refreshDocs();
  } catch { message.error('Processing failed'); }
  finally { processingAll.value = false; }
};

const handleParseDoc = async (docId: number) => {
  processingDocIds.value = new Set(processingDocIds.value).add(docId);
  try {
    const cfg = await window.api.collection.getConfig(selectedCollection.value.id);
    await window.api.collection.parseDocument(docId, cfg.parser);
    await refreshDocs();
  } catch (err: any) { message.error(err?.message ?? 'Parse failed'); }
  finally {
    const next = new Set(processingDocIds.value);
    next.delete(docId);
    processingDocIds.value = next;
  }
};

const handleEmbedDoc = async (docId: number) => {
  processingDocIds.value = new Set(processingDocIds.value).add(docId);
  try {
    const cfg = await window.api.collection.getConfig(selectedCollection.value.id);
    if (!cfg.embeddingModelId) { message.warning('No embedding model configured — open Configure first'); return; }
    await window.api.collection.embedDocument(docId, cfg.embeddingModelId);
    await refreshDocs();
  } catch (err: any) { message.error(err?.message ?? 'Embedding failed'); }
  finally {
    const next = new Set(processingDocIds.value);
    next.delete(docId);
    processingDocIds.value = next;
  }
};

const openDocDetail = async (row: any) => {
  selectedDoc.value = row;
  docDetail.value = null;
  showDetail.value = true;
  detailLoading.value = true;
  try { docDetail.value = await window.api.collection.getDocumentDetail(row.id); }
  catch { message.error('Failed to load document detail'); }
  finally { detailLoading.value = false; }
};

const handleDeleteKb = async (row: any) => {
  try {
    await window.api.collection.delete(row.id);
    message.success('Knowledge base deleted');
    await loadCollections();
  } catch { message.error('Failed to delete knowledge base'); }
};

const handleRemoveDoc = async (docId: number) => {
  try {
    await window.api.collection.removeDocument(docId);
    documents.value = documents.value.filter((d) => d.id !== docId);
    await loadCollections();
  } catch { message.error('Failed to remove file'); }
};

const kbColumns: DataTableColumns<any> = [
  { title: 'Name', key: 'name' },
  { title: 'Description', key: 'description', ellipsis: { tooltip: true } },
  { title: 'Files', key: 'documentCount', width: 70, align: 'center' },
  { title: 'Created', key: 'createdAt', width: 120, render: (row) => new Date(row.createdAt).toLocaleDateString() },
  {
    title: 'Actions',
    key: 'actions',
    width: 220,
    render: (row) =>
      h(NSpace, { size: 6 }, {
        default: () => [
          h(NButton, { size: 'small', onClick: () => openDocs(row) }, { default: () => 'Files' }),
          h(NButton, { size: 'small', onClick: () => openConfig(row) }, { default: () => 'Configure' }),
          h(NButton, { size: 'small', type: 'error', onClick: () => handleDeleteKb(row) }, { default: () => 'Delete' }),
        ],
      }),
  },
];

const docColumns = computed<DataTableColumns<any>>(() => [
  { title: 'File Name', key: 'source', render: (row) => row.source ?? '—' },
  {
    title: 'Status',
    key: 'status',
    width: 200,
    render: (row) =>
      h(NSpace, { size: 4 }, {
        default: () => {
          if (row.error) return [h(NTag, { size: 'small', type: 'error' }, { default: () => 'Error' })];
          return [
            h(NTag, { size: 'small', type: row.parsed ? 'success' : 'default' },
              { default: () => row.parsed ? `Parsed (${row.chunkCount} chunks)` : 'Raw' }),
            h(NTag, { size: 'small', type: row.embedded ? 'info' : 'default' },
              { default: () => row.embedded ? 'Embedded' : 'No Vector' }),
          ];
        },
      }),
  },
  { title: 'Added', key: 'createdAt', width: 110, render: (row) => new Date(row.createdAt).toLocaleDateString() },
  {
    title: 'Actions',
    key: 'actions',
    width: 230,
    render: (row) => {
      const busy = processingDocIds.value.has(row.id);
      return h(NSpace, { size: 4 }, {
        default: () => [
          h(NButton, { size: 'small', loading: busy, onClick: () => openDocDetail(row) }, { default: () => 'Detail' }),
          h(NButton, { size: 'small', loading: busy, onClick: () => handleParseDoc(row.id) }, { default: () => 'Parse' }),
          h(NButton, { size: 'small', loading: busy, onClick: () => handleEmbedDoc(row.id) }, { default: () => 'Embed' }),
          h(NButton, { size: 'small', type: 'error', text: true, onClick: () => handleRemoveDoc(row.id) }, { default: () => 'Remove' }),
        ],
      });
    },
  },
]);

onMounted(loadCollections);
</script>
