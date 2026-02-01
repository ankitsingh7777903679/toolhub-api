# ToolHub API

Backend API for ToolHub using **LangChain** with **Groq** for AI writing tools.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   
   Edit `.env` file with your Groq API key:
   ```
   GROQ_API_KEY=your_groq_api_key_here
   ```
   
   Get your API key from: https://console.groq.com

3. **Start the server:**
   ```bash
   npm start
   ```
   
   Or with auto-reload for development:
   ```bash
   npm run dev
   ```

## API Endpoints

### Generate AI Content
```
POST /api/ai/generate
```

**Request Body:**
```json
{
    "promptType": "coldEmail",
    "text": "Write a cold email for a frontend developer job",
    "paragraphs": 3
}
```

**Prompt Types:**
- `coldEmail` - Generate professional cold emails
- `assay` - Write essays (supports `paragraphs` parameter)
- `blogPost` - Create SEO-optimized blog posts
- `summarizing` - Summarize long content
- `jsonToXml` - Convert JSON to XML format

**Response:**
```json
{
    "success": true,
    "text": "Generated content...",
    "promptType": "coldEmail"
}
```

### Health Check
```
GET /api/health
```

### AI Status
```
GET /api/ai/status
```

## Technology Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **AI SDK:** LangChain with Groq
- **Model:** llama-3.3-70b-versatile

## Project Structure

```
toolhub-api/
├── agents/
│   └── writing.agent.js    # LangChain Writing Agent
├── routes/
│   └── ai.routes.js        # API routes
├── .env                    # Environment variables
├── index.js                # Server entry point
└── package.json
```
