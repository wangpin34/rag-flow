import { collectionService, documentService, queryHistoryService } from './prisma-service';

/**
 * Example usage of Prisma services for RAG application
 */
async function main() {
  console.log('=== Prisma RAG Example ===\n');

  // 1. Create a collection
  console.log('1. Creating a collection...');
  const collection = await collectionService.createCollection(
    'Technical Documentation',
    'Collection of technical documents and guides'
  );
  console.log(`✓ Created collection: ${collection.name}\n`);

  // 2. Create a document with chunks
  console.log('2. Creating a document with chunks...');
  const document = await documentService.createDocument({
    content: 'This is a comprehensive guide to machine learning and AI.',
    source: 'ml-guide.pdf',
    metadata: {
      author: 'AI Expert',
      category: 'Machine Learning',
      tags: ['AI', 'ML', 'Deep Learning'],
    },
    chunks: [
      {
        content: 'Machine learning is a subset of artificial intelligence.',
        chunkIndex: 0,
        metadata: { page: 1 },
      },
      {
        content: 'Neural networks are inspired by biological neural networks.',
        chunkIndex: 1,
        metadata: { page: 2 },
      },
      {
        content: 'Deep learning uses multiple layers to progressively extract features.',
        chunkIndex: 2,
        metadata: { page: 3 },
      },
    ],
  });
  console.log(`✓ Created document ID: ${document.id} with ${document.chunks.length} chunks\n`);

  // 3. Get document with chunks
  console.log('3. Retrieving document...');
  const retrievedDoc = await documentService.getDocument(document.id);
  if (retrievedDoc) {
    console.log(`✓ Document: ${retrievedDoc.content.substring(0, 50)}...`);
    console.log(`  Chunks: ${retrievedDoc.chunks.length}`);
    retrievedDoc.chunks.forEach((chunk) => {
      console.log(`  - [${chunk.chunkIndex}] ${chunk.content.substring(0, 40)}...`);
    });
    console.log();
  }

  // 4. Create another document
  console.log('4. Creating another document...');
  const doc2 = await documentService.createDocument({
    content: 'Natural language processing enables computers to understand human language.',
    source: 'nlp-basics.pdf',
    metadata: {
      author: 'NLP Researcher',
      category: 'Natural Language Processing',
      tags: ['NLP', 'Text Analysis'],
    },
  });
  console.log(`✓ Created document ID: ${doc2.id}\n`);

  // 5. Search documents
  console.log('5. Searching for documents...');
  const searchResults = await documentService.searchDocuments('machine learning');
  console.log(`✓ Found ${searchResults.length} documents matching "machine learning"\n`);

  // 6. Get all documents with pagination
  console.log('6. Getting all documents (paginated)...');
  const { documents, total, page, totalPages } = await documentService.getDocuments(1, 10);
  console.log(`✓ Page ${page} of ${totalPages} (${total} total documents)`);
  documents.forEach((doc) => {
    const metadata = doc.metadata ? JSON.parse(doc.metadata) : {};
    console.log(`  - [${doc.id}] ${doc.content.substring(0, 40)}... (${metadata.category || 'No category'})`);
  });
  console.log();

  // 7. Get statistics
  console.log('7. Getting statistics...');
  const stats = await documentService.getStatistics();
  console.log(`✓ Statistics:`);
  console.log(`  - Total Documents: ${stats.totalDocuments}`);
  console.log(`  - Total Chunks: ${stats.totalChunks}`);
  console.log(`  - Avg Chunks per Document: ${stats.averageChunksPerDocument.toFixed(2)}\n`);

  // 8. Save query history
  console.log('8. Saving query to history...');
  await queryHistoryService.saveQuery('What is machine learning?', searchResults);
  console.log('✓ Query saved to history\n');

  // 9. Get recent queries
  console.log('9. Getting recent queries...');
  const recentQueries = await queryHistoryService.getRecentQueries(5);
  console.log(`✓ Recent queries (${recentQueries.length}):`);
  recentQueries.forEach((q) => {
    console.log(`  - ${q.query} (${q.createdAt.toISOString()})`);
  });
  console.log();

  // 10. Get all collections
  console.log('10. Getting all collections...');
  const collections = await collectionService.getCollections();
  console.log(`✓ Collections (${collections.length}):`);
  collections.forEach((c) => {
    console.log(`  - ${c.name}: ${c.description || 'No description'}`);
  });
  console.log();

  // 11. Update a document
  console.log('11. Updating document...');
  const updated = await documentService.updateDocument(document.id, {
    metadata: {
      author: 'AI Expert',
      category: 'Machine Learning',
      tags: ['AI', 'ML', 'Deep Learning'],
      updated: true,
    },
  });
  console.log(`✓ Updated document ID: ${updated.id}\n`);

  console.log('=== Example completed successfully! ===');
}

// Run the example
main()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    const { default: prisma } = await import('./prisma-client');
    await prisma.$disconnect();
  });
