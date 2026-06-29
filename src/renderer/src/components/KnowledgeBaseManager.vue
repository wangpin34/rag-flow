<template>
  <div style="display: flex; height: 100%; overflow: hidden">

    <!-- Left: KB list -->
    <div style="width: 220px; flex-shrink: 0; border-right: 1px solid rgba(255,255,255,0.09); display: flex; flex-direction: column; overflow: hidden">
      <div style="padding: 12px 12px 8px; flex-shrink: 0">
        <n-button type="primary" block size="small" @click="openCreate">
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
      <div style="flex: 1; overflow-y: auto">
        <div v-if="loading" style="padding: 20px; text-align: center">
          <n-spin size="small" />
        </div>
        <n-empty v-else-if="!collections.length" description="No knowledge bases" style="padding: 32px 12px; font-size: 13px" />
        <div
          v-for="kb in collections"
          :key="kb.id"
          @click="selectKb(kb)"
          :style="{
            padding: '10px 14px',
            cursor: 'pointer',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            background: selectedKb?.id === kb.id ? 'rgba(255,255,255,0.08)' : 'transparent',
            transition: 'background 0.1s',
          }"
        >
          <div style="font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{ kb.name }}</div>
          <div style="font-size: 11px; color: var(--n-text-color-3); margin-top: 2px">{{ kb.documentCount }} file{{ kb.documentCount !== 1 ? 's' : '' }}</div>
        </div>
      </div>
    </div>

    <!-- Right: Detail panel -->
    <div style="flex: 1; overflow: hidden; display: flex; flex-direction: column">
      <!-- Empty state -->
      <n-empty v-if="!selectedKb" description="Select a knowledge base" style="margin: auto" />

      <template v-else>
        <!-- Header -->
        <div style="padding: 16px 20px 0; flex-shrink: 0; display: flex; align-items: flex-start; justify-content: space-between">
          <div>
            <div style="font-size: 16px; font-weight: 600">{{ selectedKb.name }}</div>
            <div v-if="selectedKb.description" style="font-size: 13px; color: var(--n-text-color-3); margin-top: 4px">{{ selectedKb.description }}</div>
          </div>
          <n-button size="small" type="error" @click="handleDeleteKb(selectedKb)">Delete</n-button>
        </div>

        <!-- Tabs -->
        <n-tabs
          v-model:value="detailTab"
          type="line"
          animated
          style="flex: 1; overflow: hidden; display: flex; flex-direction: column"
          pane-wrapper-style="flex: 1; overflow: hidden"
          pane-style="height: 100%; overflow: hidden"
        >
          <!-- ── Files tab ── -->
          <n-tab-pane name="files" tab="Files" display-directive="show" style="height: 100%; display: flex; flex-direction: column; overflow: hidden">
            <div style="padding: 12px 20px 8px; flex-shrink: 0; display: flex; gap: 8px; align-items: center">
              <n-button size="small" @click="triggerAddFile">
                <template #icon>
                  <n-icon>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" />
                      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
                    </svg>
                  </n-icon>
                </template>
                Add Files
              </n-button>
              <label for="kb-add-file" style="display:none">Add files to knowledge base</label>
              <input ref="addFileInputRef" id="kb-add-file" type="file" multiple accept=".txt,.md,.json,.csv,.html,.xml" style="display:none" @change="handleAddFileChange" />
              <n-button size="small" type="primary" :loading="processingAll" @click="handleProcessAll">Process All</n-button>
            </div>
            <div style="flex: 1; overflow-y: auto; padding: 0 20px 16px">
              <n-data-table
                :columns="docColumns"
                :data="documents"
                :loading="docsLoading"
                :bordered="false"
                size="small"
                :row-key="(r) => r.id"
              />
            </div>
          </n-tab-pane>

          <!-- ── Chunks tab ── -->
          <n-tab-pane name="chunks" tab="Chunks" display-directive="show" style="height: 100%; display: flex; flex-direction: column; overflow: hidden">
            <div style="padding: 12px 20px 8px; flex-shrink: 0">
              <n-select
                v-model:value="chunksDocId"
                :options="chunkFileOptions"
                placeholder="Select a file to view its chunks"
                clearable
                @update:value="loadChunks"
                style="max-width: 400px"
              />
            </div>
            <div style="flex: 1; overflow-y: auto; padding: 0 20px 16px">
              <div v-if="chunksLoading" style="display:flex;justify-content:center;padding:40px">
                <n-spin size="large" />
              </div>
              <template v-else-if="chunks.length">
                <div
                  v-for="chunk in chunks"
                  :key="chunk.id"
                  style="margin-bottom: 12px; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; overflow: hidden"
                >
                  <div style="display:flex;align-items:center;gap:12px;padding:8px 12px;background:rgba(255,255,255,0.05);border-bottom:1px solid rgba(255,255,255,0.08)">
                    <n-tag size="small" round>Chunk {{ chunk.chunkIndex + 1 }}</n-tag>
                    <n-text depth="3" style="font-size:12px">{{ chunk.content.length }} chars</n-text>
                  </div>
                  <pre style="white-space: pre-wrap; word-break: break-all; font-size: 13px; font-family: monospace; margin: 0; padding: 12px 14px; line-height: 1.6">{{ chunk.content }}</pre>
                </div>
              </template>
              <n-empty v-else-if="chunksDocId" description="No chunks — run Parse on this file first" style="padding: 48px" />
              <n-empty v-else description="Select a file above to view its chunks" style="padding: 48px" />
            </div>
          </n-tab-pane>

          <!-- ── Config tab ── -->
          <n-tab-pane name="config" tab="Config" display-directive="show" style="height: 100%; overflow-y: auto">
            <div style="padding: 16px 20px; max-width: 560px">
              <n-form :model="configForm" label-placement="left" label-width="160">
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
                <n-form-item label="Auto Process on Upload">
                  <n-switch v-model:value="configForm.autoProcess" />
                </n-form-item>
                <n-divider title-placement="left" style="font-size: 13px; margin: 16px 0">Retrieval</n-divider>
                <n-form-item label="Top-K Chunks">
                  <n-input-number
                    v-model:value="configForm.retrieveTopK"
                    :min="1"
                    :max="20"
                    :step="1"
                    style="width: 100%"
                  />
                </n-form-item>
                <div style="margin-top: 20px">
                  <n-button type="primary" :loading="configSaving" @click="saveConfig">Save Configuration</n-button>
                </div>
              </n-form>
            </div>
          </n-tab-pane>

          <!-- ── Retrieve tab ── -->
          <n-tab-pane name="retrieve" tab="Retrieve" display-directive="show" style="height: 100%; display: flex; flex-direction: column; overflow: hidden">
            <div style="padding: 12px 20px 8px; flex-shrink: 0; display: flex; gap: 8px; align-items: flex-end">
              <div style="flex: 1">
                <n-input
                  v-model:value="retrieveQuery"
                  placeholder="Enter a query to retrieve relevant chunks…"
                  @keydown.enter="handleRetrieve"
                />
              </div>
              <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0">
                <n-text depth="3" style="font-size: 13px; white-space: nowrap">Top K</n-text>
                <n-input-number
                  v-model:value="retrieveTopK"
                  :min="1"
                  :max="100"
                  :step="1"
                  style="width: 80px"
                />
              </div>
              <n-button type="primary" :loading="retrieving" @click="handleRetrieve" style="flex-shrink: 0">Search</n-button>
            </div>
            <div style="flex: 1; overflow-y: auto; padding: 0 20px 16px">
              <div v-if="retrieving" style="display:flex;justify-content:center;padding:48px">
                <n-spin size="large" />
              </div>
              <n-empty
                v-else-if="retrieveResults === null"
                description="Enter a query and click Search to retrieve relevant chunks"
                style="padding: 48px"
              />
              <n-empty
                v-else-if="retrieveResults.length === 0"
                description="No results found"
                style="padding: 48px"
              />
              <template v-else>
                <div style="padding: 8px 0 12px; font-size: 12px; color: var(--n-text-color-3)">
                  {{ retrieveResults.length }} result{{ retrieveResults.length !== 1 ? 's' : '' }}
                </div>
                <div
                  v-for="(r, i) in retrieveResults"
                  :key="r.documentId + '-' + i"
                  style="margin-bottom: 16px; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; overflow: hidden"
                >
                  <!-- Result header -->
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 14px;background:rgba(255,255,255,0.05);border-bottom:1px solid rgba(255,255,255,0.08)">
                    <div style="display:flex;align-items:center;gap:10px;min-width:0">
                      <n-tag size="small" round type="info">#{{ i + 1 }}</n-tag>
                      <n-text style="font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" :title="r.source ?? undefined">
                        {{ r.source ?? 'Unknown file' }}
                      </n-text>
                      <n-text depth="3" style="font-size:12px;flex-shrink:0">{{ r.chunkCount }} chunk{{ r.chunkCount !== 1 ? 's' : '' }}</n-text>
                    </div>
                    <n-tag size="small" round type="success" style="flex-shrink:0">
                      score {{ (1 / (1 + r.score)).toFixed(4) }}
                    </n-tag>
                  </div>
                  <!-- All chunks of the matched document -->
                  <template v-if="r.chunks && r.chunks.length">
                    <div
                      v-for="chunk in r.chunks"
                      :key="chunk.id"
                      style="border-bottom: 1px solid rgba(255,255,255,0.06)"
                    >
                      <div style="display:flex;align-items:center;gap:8px;padding:5px 14px;background:rgba(255,255,255,0.02)">
                        <n-tag size="small" round style="font-size:11px">Chunk {{ chunk.chunkIndex + 1 }}</n-tag>
                        <n-text depth="3" style="font-size:11px">{{ chunk.content.length }} chars</n-text>
                      </div>
                      <pre style="white-space: pre-wrap; word-break: break-all; font-size: 13px; font-family: monospace; margin: 0; padding: 10px 14px; line-height: 1.6">{{ chunk.content }}</pre>
                    </div>
                  </template>
                  <pre v-else style="white-space: pre-wrap; word-break: break-all; font-size: 13px; font-family: monospace; margin: 0; padding: 12px 14px; line-height: 1.6">{{ r.chunkContent }}</pre>
                </div>
              </template>
            </div>
          </n-tab-pane>
        </n-tabs>
      </template>
    </div>
  </div>

  <!-- Create Modal -->
  <n-modal v-model:show="showCreate" preset="card" title="Create Knowledge Base" :style="{ width: '520px' }">
    <n-form :model="form" label-placement="left" label-width="110">
      <n-form-item label="Name" required>
        <n-input v-model:value="form.name" placeholder="My Knowledge Base" />
      </n-form-item>
      <n-form-item label="Description">
        <n-input v-model:value="form.description" type="textarea" placeholder="Optional description..." :rows="2" />
      </n-form-item>
      <n-form-item label="Files">
        <div style="width: 100%">
          <n-button size="small" @click="triggerFileInput" style="margin-bottom: 8px">
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
          <input ref="fileInputRef" id="kb-file-input" type="file" multiple accept=".txt,.md,.json,.csv,.html,.xml" style="display: none" @change="handleFileChange" />
          <div v-if="form.files.length" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; max-height: 160px; overflow-y: auto">
            <div v-for="(f, i) in form.files" :key="i" style="display:flex;align-items:center;justify-content:space-between;padding:6px 12px;border-bottom:1px solid rgba(255,255,255,0.06)">
              <n-space align="center" :size="8">
                <n-text style="font-size:13px">{{ f.name }}</n-text>
                <n-text depth="3" style="font-size:12px">{{ formatSize(f.size) }}</n-text>
              </n-space>
              <n-button text size="small" type="error" @click="removeFile(i)">Remove</n-button>
            </div>
          </div>
          <n-text v-else depth="3" style="font-size:13px">No files selected</n-text>
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
import { computed, h, onMounted, ref, watch } from 'vue';

const message = useMessage();

// ── KB list ──
const loading = ref(false);
const collections = ref<any[]>([]);
const selectedKb = ref<any>(null);
const detailTab = ref('files');

// ── Create ──
const showCreate = ref(false);
const creating = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);
const form = ref<{ name: string; description: string; files: File[] }>({ name: '', description: '', files: [] });

// ── Files tab ──
const docsLoading = ref(false);
const documents = ref<any[]>([]);
const processingAll = ref(false);
const processingDocIds = ref(new Set<number>());
const addFileInputRef = ref<HTMLInputElement | null>(null);

// ── Chunks tab ──
const chunksDocId = ref<number | null>(null);
const chunks = ref<any[]>([]);
const chunksLoading = ref(false);

// ── Config tab ──
const configSaving = ref(false);
const configForm = ref({
  parser: { strategy: 'paragraph' as 'paragraph' | 'fixed-size' | 'sentence', chunkSize: 1000, chunkOverlap: 200 },
  embeddingModelId: null as number | null,
  rerankModelId: null as number | null,
  autoProcess: false,
  retrieveTopK: 4,
});
const embeddingModels = ref<any[]>([]);
const chatModels = ref<any[]>([]);

// ── Retrieve tab ──
const retrieveQuery = ref('');
const retrieveTopK = ref(10);
const retrieving = ref(false);
const retrieveResults = ref<any[] | null>(null);

const handleRetrieve = async () => {
  if (!selectedKb.value) return;
  if (!retrieveQuery.value.trim()) { message.warning('Enter a query first'); return; }
  retrieving.value = true;
  try {
    retrieveResults.value = await window.api.collection.retrieve(
      selectedKb.value.id,
      retrieveQuery.value.trim(),
      retrieveTopK.value,
    );
  } catch (err: any) {
    message.error(err?.message ?? 'Retrieval failed');
  } finally {
    retrieving.value = false;
  }
};

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

const chunkFileOptions = computed(() =>
  documents.value
    .filter((d) => d.parsed)
    .map((d) => ({ label: d.source ?? ('Document ' + d.id), value: d.id }))
);

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

// ── Load ──
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

const loadDocs = async (kbId: number) => {
  docsLoading.value = true;
  try { documents.value = await window.api.collection.getDocumentsWithStatus(kbId); }
  catch { message.error('Failed to load files'); }
  finally { docsLoading.value = false; }
};

const loadConfig = async (kbId: number) => {
  const cfg = await window.api.collection.getConfig(kbId);
  configForm.value = {
    parser: { ...cfg.parser },
    embeddingModelId: cfg.embeddingModelId,
    rerankModelId: cfg.rerankModelId,
    autoProcess: cfg.autoProcess,
    retrieveTopK: cfg.retrieveTopK ?? 4,
  };
};

const loadChunks = async (docId: number | null) => {
  if (!docId) { chunks.value = []; return; }
  chunksLoading.value = true;
  try {
    const detail = await window.api.collection.getDocumentDetail(docId);
    chunks.value = detail?.chunks ?? [];
  } catch { message.error('Failed to load chunks'); }
  finally { chunksLoading.value = false; }
};

// ── Select KB ──
const selectKb = async (kb: any) => {
  selectedKb.value = kb;
  chunksDocId.value = null;
  chunks.value = [];
  await Promise.all([loadDocs(kb.id), loadConfig(kb.id), loadModels()]);
};

watch(selectedKb, (kb) => {
  if (!kb) return;
  // reset chunk + retrieve state when switching KBs
  chunksDocId.value = null;
  chunks.value = [];
  retrieveQuery.value = '';
  retrieveResults.value = null;
});

// ── Create KB ──
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
      if (cfg.autoProcess) await window.api.collection.processDocument(doc.id, cfg).catch(() => {});
    }
    message.success('Knowledge base created');
    showCreate.value = false;
    await loadCollections();
    const fresh = collections.value.find((c) => c.id === kb.id);
    if (fresh) await selectKb(fresh);
  } catch (err: any) {
    message.error(err?.message ?? 'Failed to create knowledge base');
  } finally { creating.value = false; }
};

// ── Add files to existing KB ──
const triggerAddFile = () => addFileInputRef.value?.click();
const handleAddFileChange = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  if (!input.files || !selectedKb.value) return;
  const files = Array.from(input.files);
  input.value = '';
  const cfg = await window.api.collection.getConfig(selectedKb.value.id);
  for (const file of files) {
    const content = await file.text();
    const doc = await window.api.collection.addDocument(selectedKb.value.id, { content, fileName: file.name });
    if (cfg.autoProcess) await window.api.collection.processDocument(doc.id, cfg).catch(() => {});
  }
  await loadDocs(selectedKb.value.id);
  await loadCollections();
  const updated = collections.value.find((c) => c.id === selectedKb.value.id);
  if (updated) selectedKb.value = updated;
};

// ── Process all ──
const refreshDocs = async () => {
  if (!selectedKb.value) return;
  await loadDocs(selectedKb.value.id);
  await loadCollections();
  const updated = collections.value.find((c) => c.id === selectedKb.value.id);
  if (updated) selectedKb.value = updated;
};

const handleProcessAll = async () => {
  if (!selectedKb.value) return;
  processingAll.value = true;
  try {
    const cfg = await window.api.collection.getConfig(selectedKb.value.id);
    const result = await window.api.collection.processAll(selectedKb.value.id, cfg);
    const errPart = result.errors ? `, ${result.errors} error(s)` : '';
    message.success(`Processed ${result.processed} file(s)${errPart}`);
    await refreshDocs();
  } catch { message.error('Processing failed'); }
  finally { processingAll.value = false; }
};

const handleParseDoc = async (docId: number) => {
  processingDocIds.value = new Set(processingDocIds.value).add(docId);
  try {
    const cfg = await window.api.collection.getConfig(selectedKb.value.id);
    await window.api.collection.parseDocument(docId, cfg.parser);
    await refreshDocs();
    if (chunksDocId.value === docId) await loadChunks(docId);
  } catch (err: any) { message.error(err?.message ?? 'Parse failed'); }
  finally {
    const s = new Set(processingDocIds.value); s.delete(docId); processingDocIds.value = s;
  }
};

const handleEmbedDoc = async (docId: number) => {
  processingDocIds.value = new Set(processingDocIds.value).add(docId);
  try {
    const cfg = await window.api.collection.getConfig(selectedKb.value.id);
    if (!cfg.embeddingModelId) { message.warning('No embedding model configured — set it in the Config tab'); return; }
    await window.api.collection.embedDocument(docId, cfg.embeddingModelId);
    await refreshDocs();
  } catch (err: any) { message.error(err?.message ?? 'Embedding failed'); }
  finally {
    const s = new Set(processingDocIds.value); s.delete(docId); processingDocIds.value = s;
  }
};

const handleRemoveDoc = async (docId: number) => {
  try {
    await window.api.collection.removeDocument(docId);
    documents.value = documents.value.filter((d) => d.id !== docId);
    if (chunksDocId.value === docId) { chunksDocId.value = null; chunks.value = []; }
    await loadCollections();
    const updated = collections.value.find((c) => c.id === selectedKb.value?.id);
    if (updated) selectedKb.value = updated;
  } catch { message.error('Failed to remove file'); }
};

const handleDeleteKb = async (kb: any) => {
  try {
    await window.api.collection.delete(kb.id);
    message.success('Knowledge base deleted');
    if (selectedKb.value?.id === kb.id) selectedKb.value = null;
    await loadCollections();
  } catch { message.error('Failed to delete knowledge base'); }
};

// ── Config ──
const saveConfig = async () => {
  if (!selectedKb.value) return;
  configSaving.value = true;
  try {
    await window.api.collection.setConfig(selectedKb.value.id, JSON.parse(JSON.stringify(configForm.value)));
    message.success('Configuration saved');
  } catch { message.error('Failed to save configuration'); }
  finally { configSaving.value = false; }
};

// ── Table columns ──
const docColumns = computed<DataTableColumns<any>>(() => [
  { title: 'File', key: 'source', render: (row) => row.source ?? '—' },
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
              { default: () => row.parsed ? `${row.chunkCount} chunks` : 'Raw' }),
            h(NTag, { size: 'small', type: row.embedded ? 'info' : 'default' },
              { default: () => row.embedded ? 'Embedded' : 'No Vector' }),
          ];
        },
      }),
  },
  { title: 'Added', key: 'createdAt', width: 100, render: (row) => new Date(row.createdAt).toLocaleDateString() },
  {
    title: 'Actions',
    key: 'actions',
    width: 230,
    render: (row) => {
      const busy = processingDocIds.value.has(row.id);
      return h(NSpace, { size: 4 }, {
        default: () => [
          h(NButton, {
            size: 'small', loading: busy,
            onClick: () => { chunksDocId.value = row.id; detailTab.value = 'chunks'; loadChunks(row.id); },
          }, { default: () => 'Chunks' }),
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
