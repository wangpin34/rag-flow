import prisma from './prisma-client';
import { VectorDatabase } from './vector-db-unified';

/**
 * Example showing unified database usage:
 * Both Prisma and Vector Database using the same SQLite file (dev.db)
 */

// Initialize vector database to use same file as Prisma
const vectorDb = new VectorDatabase('./dev.db');

/**
 * Mock embedding generation
 */
function generateEmbedding(text: string): number[] {
  const dimension = 768;
  const embedding = new Array(dimension).fill(0);
  
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    embedding[i % dimension] += charCode / 1000;
  }
  
  return embedding;
}

async function main() {
  console.log('=== Unified Database Example ===\n');
  console.log('Using single database file: ./dev.db\n');

  // 1. Create documents with Prisma
  console.log('1. Creating documents with Prisma...');
  
  const doc1 = await prisma.document.create({
    data: {
      content: 'Machine learning enables computers to learn from data without explicit programming.',
      source: 'ml-intro.pdf',
      metadata: JSON.stringify({ category: 'AI', tags: ['ML', 'AI'] }),
    },
  });
  console.log(`✓ Created document ${doc1.id}`);

  const doc2 = await prisma.document.create({
    data: {
      content: 'Natural language processing focuses on the interaction between computers and human language.',
      source: 'nlp-guide.pdf',
      metadata: JSON.stringify({ category: 'NLP', tags: ['NLP', 'Text'] }),
    },
  });
  console.log(`✓ Created document ${doc2.id}`);

  const doc3 = await prisma.document.create({
    data: {
      content: 'Deep learning uses neural networks with multiple layers for complex pattern recognition.',
      source: 'dl-basics.pdf',
      metadata: JSON.stringify({ category: 'Deep Learning', tags: ['DL', 'Neural Networks'] }),
    },
  });
  console.log(`✓ Created document ${doc3.id}\n`);

  // 2. Generate and store embeddings in same database
  console.log('2. Generating and storing embeddings...');
  
  const embedding1 = generateEmbedding(doc1.content);
  vectorDb.insertEmbedding(doc1.id, embedding1);
  console.log(`✓ Stored embedding for document ${doc1.id}`);

  const embedding2 = generateEmbedding(doc2.content);
  vectorDb.insertEmbedding(doc2.id, embedding2);
  console.log(`✓ Stored embedding for document ${doc2.id}`);

  const embedding3 = generateEmbedding(doc3.content);
  vectorDb.insertEmbedding(doc3.id, embedding3);
  console.log(`✓ Stored embedding for document ${doc3.id}\n`);

  // 3. Verify data
  console.log('3. Verifying data...');
  const docCount = await prisma.document.count();
  const embCount = vectorDb.getEmbeddingCount();
  console.log(`✓ Documents in Prisma: ${docCount}`);
  console.log(`✓ Embeddings in Vector DB: ${embCount}`);
  console.log(`✓ Both in same file: ./dev.db\n`);

  // 4. Perform vector search
  console.log('4. Performing vector search...');
  const query = 'What is artificial intelligence and machine learning?';
  const queryEmbedding = generateEmbedding(query);
  
  const results = vectorDb.searchSimilar(queryEmbedding, 3);
  console.log(`✓ Found ${results.length} similar documents\n`);

  // 5. Enrich results with Prisma data
  console.log('5. Enriching results with full document data...\n');
  
  for (const result of results) {
    const doc = await prisma.document.findUnique({
      where: { id: result.document_id },
    });
    
    if (doc) {
      const metadata = doc.metadata ? JSON.parse(doc.metadata) : {};
      console.log(`Document ${doc.id} (distance: ${result.distance.toFixed(4)})`);
      console.log(`  Category: ${metadata.category || 'N/A'}`);
      console.log(`  Content: ${doc.content.substring(0, 80)}...`);
      console.log(`  Source: ${doc.source}\n`);
    }
  }

  // 6. Demonstrate atomic operations
  console.log('6. Demonstrating transactional consistency...');
  
  try {
    // Using Prisma transaction
    const newDoc = await prisma.$transaction(async (tx) => {
      // Create document
      const doc = await tx.document.create({
        data: {
          content: 'Computer vision enables machines to interpret and understand visual information.',
          source: 'cv-intro.pdf',
          metadata: JSON.stringify({ category: 'Computer Vision' }),
        },
      });
      
      // Generate and store embedding in same transaction context
      const embedding = generateEmbedding(doc.content);
      vectorDb.insertEmbedding(doc.id, embedding);
      
      return doc;
    });
    
    console.log(`✓ Created document ${newDoc.id} with embedding in transaction\n`);
  } catch (error) {
    console.error('Transaction failed:', error);
  }

  // 7. Batch operations
  console.log('7. Testing batch operations...');
  
  const batchDocs = await prisma.document.createMany({
    data: [
      {
        content: 'Reinforcement learning trains agents through rewards and penalties.',
        source: 'rl-guide.pdf',
      },
      {
        content: 'Transfer learning leverages pre-trained models for new tasks.',
        source: 'transfer-learning.pdf',
      },
    ],
  });
  
  console.log(`✓ Created ${batchDocs.count} documents`);
  
  // Get the created documents and add embeddings
  const recentDocs = await prisma.document.findMany({
    orderBy: { id: 'desc' },
    take: 2,
  });
  
  const embeddings = recentDocs.map(doc => ({
    documentId: doc.id,
    embedding: generateEmbedding(doc.content),
  }));
  
  vectorDb.insertEmbeddingsBatch(embeddings);
  console.log(`✓ Added ${embeddings.length} embeddings in batch\n`);

  // 8. Demonstrate cascading delete
  console.log('8. Testing cascading delete...');
  
  const toDelete = await prisma.document.findFirst({
    where: { source: 'rl-guide.pdf' },
  });
  
  if (toDelete) {
    // Delete document from Prisma
    await prisma.document.delete({ where: { id: toDelete.id } });
    
    // Manually delete embedding (or use SQL triggers for automatic cascading)
    vectorDb.deleteEmbedding(toDelete.id);
    
    console.log(`✓ Deleted document ${toDelete.id} and its embedding\n`);
  }

  // 9. Final statistics
  console.log('9. Final statistics...');
  const finalDocCount = await prisma.document.count();
  const finalEmbCount = vectorDb.getEmbeddingCount();
  
  console.log(`✓ Total documents: ${finalDocCount}`);
  console.log(`✓ Total embeddings: ${finalEmbCount}`);
  console.log(`✓ All data in single file: ./dev.db\n`);

  console.log('=== Example completed successfully! ===');
  console.log('\nBenefits of unified database:');
  console.log('  • Single file to manage and backup');
  console.log('  • Better data consistency');
  console.log('  • Simpler deployment');
  console.log('  • Can use SQL joins between tables');
  console.log('  • Transactional integrity across both systems');
}

// Run example
main()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    vectorDb.close();
    console.log('\n✓ Database connections closed');
  });
