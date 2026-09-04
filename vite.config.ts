/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load server-side environment variables into process.env for local development
  const env = loadEnv(mode, process.cwd(), '')
  for (const key of Object.keys(env)) {
    if (!process.env[key]) {
      process.env[key] = env[key]
    }
  }

  return {
    plugins: [
      react(),
      {
        name: 'assistant-api-dev-middleware',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const url = req.url?.split('?')[0]
            if (url === '/api/assistant/analyze' || url === '/api/assistant/chat') {
              try {
                // Collect body
                let rawBody = ''
                req.on('data', (chunk) => {
                  rawBody += chunk
                })
                req.on('end', async () => {
                  let parsedBody = {}
                  try {
                    parsedBody = rawBody ? JSON.parse(rawBody) : {}
                  } catch {
                    parsedBody = {}
                  }
                  (req as any).body = parsedBody

                  // Provide express-like res.status().json() if missing
                  const customRes = res as any
                  customRes.status = (code: number) => {
                    customRes.statusCode = code
                    return customRes
                  }
                  customRes.json = (data: any) => {
                    customRes.setHeader('Content-Type', 'application/json')
                    customRes.end(JSON.stringify(data))
                    return customRes
                  }

                  // Dynamically reload environment variables from .env.local on dev requests
                  const freshEnv = loadEnv(mode, process.cwd(), '')
                  if (freshEnv.GEMINI_API_KEY) {
                    process.env.GEMINI_API_KEY = freshEnv.GEMINI_API_KEY
                  }
                  if (freshEnv.GEMINI_MODEL) {
                    process.env.GEMINI_MODEL = freshEnv.GEMINI_MODEL
                  }

                  if (url === '/api/assistant/analyze') {
                    const { default: analyzeHandler } = await import('./api/assistant/analyze.ts')
                    await analyzeHandler(req, customRes)
                  } else {
                    const { default: chatHandler } = await import('./api/assistant/chat.ts')
                    await chatHandler(req, customRes)
                  }
                })
              } catch (err: any) {
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: err?.message || 'Server error' }))
              }
            } else {
              next()
            }
          })
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    test: {
      globals: true,
      environment: 'node',
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    },
  }
})
