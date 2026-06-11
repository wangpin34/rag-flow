# RagFlow

**RagFlow** is a powerful AI chat assistant built with Electron, Vue 3, and TypeScript. It combines custom AI model providers with Retrieval-Augmented Generation (RAG) capabilities to deliver context-aware, intelligent conversations.

## Features

- 🤖 **Custom Model Providers** - Configure multiple AI providers (Ollama, OpenAI, etc.)
- 💬 **Intelligent Chat** - Markdown-formatted responses with syntax highlighting
- 📚 **RAG Support** - Vector search with SQLite for context-aware responses
- 🎨 **Modern UI** - Built with Naive UI and dark theme
- 🔒 **Privacy First** - Local-first architecture with your data under your control
- ⚡ **Fast & Lightweight** - Native desktop app with Electron

## Tech Stack

- **Frontend**: Vue 3, TypeScript, Naive UI
- **Backend**: Electron, Node.js
- **Database**: SQLite with Prisma ORM
- **Vector Search**: sqlite-vec for embeddings
- **Build**: electron-vite

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build
```

## Development

```bash
# Type checking
npm run typecheck

# Preview build
npm run preview
```

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/)
- [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar)
- [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin)

## License

MIT
