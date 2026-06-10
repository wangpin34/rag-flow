import { documentService, queryHistoryService } from './prisma-service';
import { VectorDatabase } from './vector-db';

/**
 * Integrated example showing how to use Prisma and Vector Database together
 * for a complete RAG (Retrieval-Augmented Generation) system
 */

// Initialize both databases
const vectorDb = new VectorDatabase();

/**
 * Mock function to generate embeddings
 * In a real application, replace this with an actual embedding model
 * (e.g., OpenAI, Cohere, or local models like sentence-transformers)
 */
function generateEmbedding(text: string): number[] {
  // Create a deterministic embedding based on text
  // This is just for demonstration - use a real model in production
  const dimension = 768;
  const embedding = new Array(dimension).fill(0);
  
  // Simple hash-based approach for demo
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    embedding[i % dimension] += charCode / 1000;
  }
  
  return embedding;
}

/**
 * Add a document to both Prisma and Vector databases
 */
async function addDocument(content: string, metadata?: Record<string, any>) {
  console.log('Adding document to both databases...');
  
  // 1. Store document in Prisma for structured data
  const prismaDoc = await documentService.createDocument({
    content,
    metadata,
    source: metadata?.source || 'unknown',
  });
  
  console.log(`✓ Stored in Prisma (ID: ${prismaDoc.id})`);
  
  // 2. Generate embedding
  const embedding = generateEmbedding(content);
  
  // 3. Store embedding in vector database with reference to Prisma ID
  const vectorDocId = vectorDb.insertDocument(content, embedding, {
    prismaDocId: prismaDoc.id,
    ...metadata,
  });
  
  console.log(`✓ Stored embedding in Vector DB (ID: ${vectorDocId})`);
  
  return { prismaDoc, vectorDocId };
}

/**
 * Search for documents using vector similarity and enrich with Prisma data
 */
async function searchDocuments(query: string, limit: number = 5) {
  console.log(`\nSearching for: "${query}"`);
  
  // 1. Generate query embedding
  const queryEmbedding = generateEmbedding(query);
  
  // 2. Search vector database for similar documents
  const vectorResults = vectorDb.searchSimilar(queryEmbedding, limit);
  
  console.log(`✓ Found ${vectorResults.length} similar documents`);
  
  // 3. Enrich with full document data from Prisma
  const enrichedResults = await Promise.all(
    vectorResults.map(async (result: any) => {
      const metadata = JSON.parse(result.metadata || '{}');
      const prismaDocId = metadata.prismaDocId;
      
      if (prismaDocId) {
        const fullDoc = await documentService.getDocument(prismaDocId);
        return {
          ...result,
          fullDocument: fullDoc,
          distance: result.distance,
        };
      }
      return result;
    })
  );
  
  // 4. Save query to history
  await queryHistoryService.saveQuery(query, enrichedResults);
  
  return enrichedResults;
}

/**
 * Main example function
 */
async function main() {
  console.log('=== Integrated Prisma + Vector Database Example ===\n');
  
  try {
    // Add sample documents
    console.log('1. Adding sample documents...\n');
    
    await addDocument(
      'Machine learning is a subset of artificial intelligence that focuses on building systems that learn from data.',
      {
        category: 'AI',
        source: 'ai-guide.pdf',
        author: 'AI Expert',
      }
    );
    
    await addDocument(
      'Natural language processing enables computers to understand, interpret, and generate human language.',
      {
        category: 'NLP',
        source: 'nlp-basics.pdf',
        author: 'NLP Researcher',
      }
    );
    
    await addDocument(
      'Deep learning uses neural networks with multiple layers to progressively extract higher-level features from raw input.',
      {
        category: 'Deep Learning',
        source: 'deep-learning.pdf',
        author: 'DL Specialist',
      }
    );
    
    await addDocument(
      'Computer vision is a field of artificial intelligence that trains computers to interpret and understand the visual world.',
      {
        category: 'Computer Vision',
        source: 'cv-intro.pdf',
        author: 'CV Engineer',
      }
    );
    
    // Search for similar documents
    console.log('\n2. Performing semantic search...\n');
    
    const results1 = await searchDocuments('What is machine learning?', 3);
    console.log('\nTop results:');
    results1.forEach((result: any, index: number) => {
      const metadata = JSON.parse(result.metadata || '{}');
      console.log(`  ${index + 1}. [Distance: ${result.distance.toFixed(4)}]`);
      console.log(`     Category: ${metadata.category}`);
      console.log(`     Content: ${result.content.substring(0, 80)}...`);
      if (result.fullDocument) {
        console.log(`     Source: ${result.fullDocument.source}`);
      }
    });
    
    // Another search
    console.log('\n\n3. Another search query...\n');
    const results2 = await searchDocuments('neural networks', 3);
    console.log('\nTop results:');
    results2.forEach((result: any, index: number) => {
      const metadata = JSON.parse(result.metadata || '{}');
      console.log(`  ${index + 1}. [Distance: ${result.distance.toFixed(4)}] ${metadata.category}`);
    });
    
    // Get statistics
    console.log('\n\n4. Database statistics...\n');
    const stats = await documentService.getStatistics();
    console.log(`✓ Total documents in Prisma: ${stats.totalDocuments}`);
    console.log(`✓ Total chunks: ${stats.totalChunks}`);
    console.log(`✓ Total in Vector DB: ${vectorDb.getDocumentCount()}`);
    
    // Get recent queries
    console.log('\n5. Recent search queries...\n');
    const recentQueries = await queryHistoryService.getRecentQueries(5);
    console.log(`✓ Query history (${recentQueries.length}):`);
    recentQueries.forEach((q) => {
      console.log(`  - "${q.query}" (${q.createdAt.toLocaleString()})`);
    });
    
    console.log('\n=== Example completed successfully! ===');
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Run the example
if (require.main === module) {
  main()
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    })
    .finally(async () => {
      // Cleanup
      const { default: prisma } = await import('./prisma-client');
      await prisma.$disconnect();
      vectorDb.close();
      console.log('\n✓ Databases closed');
    });
}

export { addDocument, searchDocuments };
