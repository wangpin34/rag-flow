import { VectorDatabase } from './vector-db';

/**
 * Example usage of the VectorDatabase class
 */

// Initialize the database
const vectorDb = new VectorDatabase();

// Example: Insert documents with embeddings
// Note: In a real application, you would generate these embeddings using an embedding model
// like OpenAI's text-embedding-3-small, sentence-transformers, etc.

const doc1Embedding = new Array(768).fill(0).map(() => Math.random());
const doc2Embedding = new Array(768).fill(0).map(() => Math.random());

const doc1Id = vectorDb.insertDocument(
  'This is a sample document about machine learning',
  doc1Embedding,
  { category: 'AI', source: 'example.pdf' }
);

const doc2Id = vectorDb.insertDocument(
  'Another document discussing natural language processing',
  doc2Embedding,
  { category: 'NLP', source: 'document.pdf' }
);

console.log(`Inserted documents with IDs: ${doc1Id}, ${doc2Id}`);
console.log(`Total documents: ${vectorDb.getDocumentCount()}`);

// Example: Search for similar documents
const queryEmbedding = new Array(768).fill(0).map(() => Math.random());
const similarDocs = vectorDb.searchSimilar(queryEmbedding, 5);

console.log('Similar documents:');
similarDocs.forEach((doc: any) => {
  console.log(`- [${doc.id}] ${doc.content.substring(0, 50)}... (distance: ${doc.distance})`);
});

// Example: Get a specific document
const document = vectorDb.getDocument(doc1Id as number);
console.log('Retrieved document:', document);

// Clean up
// vectorDb.deleteDocument(doc1Id as number);
// vectorDb.close();

export { vectorDb };
