import { GoogleGenAI } from '@google/genai';

interface ChatRequestBody {
  message: string;
  history?: { role: 'user' | 'model'; text: string }[];
}

const CHAT_SYSTEM_INSTRUCTION = `You are the RouteMeasure Assistant, an expert assistant built into RouteMeasure (a high-precision transmission line and utility GIS route measurement application).

Your role is to answer questions about RouteMeasure features, coordinate formats, and survey data preparation.

KNOWLEDGE BASE:
- RouteMeasure has two primary modes:
  1. LV & MV Route: Calculates ordered network polylines for Low Voltage (0.4kV) and Medium Voltage (11kV/33kV) power lines using geodesic WGS84 Karney algorithms (GeographicLib).
  2. Distance Between Points: Calculates independent canonical geodesic distance matrices between central hubs (starting points) and destination utility sites.
- Coordinates must be decimal degrees in WGS84 (e.g. Latitude: -2.58930, Longitude: 31.31071).
- RouteMeasure runs 100% in-browser on client devices for calculation privacy.
- Standard Excel template columns for LV/MV: Point ID, Latitude, Longitude, Route/Voltage (LV/MV), Description.
- For Distance mode: Site ID, Site Name, Region, Latitude, Longitude.
- You do NOT run final calculations yourself; GeographicLib calculates all distances deterministically in the client.

Keep your answers concise, practical, engineering-oriented, and friendly. Avoid excessive fluff.`;

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return res.status(503).json({
      error: 'RouteMeasure Assistant chat is currently unavailable (API key not configured).',
    });
  }

  try {
    const body: ChatRequestBody = req.body || {};
    const { message, history = [] } = body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Message is required.' });
    }

    const configuredModel = process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash';
    const candidateModels = Array.from(
      new Set([
        configuredModel,
        'gemini-3.5-flash',
        'gemini-3.5-flash-lite',
        'gemini-3.6-flash',
        'gemini-3.7-flash',
        'gemini-flash-latest',
      ])
    );
    const ai = new GoogleGenAI({ apiKey });

    const contents = [
      ...history.map((h) => ({
        role: h.role === 'model' ? 'model' : 'user',
        parts: [{ text: h.text }],
      })),
      {
        role: 'user',
        parts: [{ text: message }],
      },
    ];

    let response: any = null;
    let lastError: any = null;

    for (const modelName of candidateModels) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction: CHAT_SYSTEM_INSTRUCTION,
            temperature: 0.3,
          },
        });
        if (response) {
          break;
        }
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || '');
        if (
          err?.status === 404 ||
          err?.status === 503 ||
          msg.includes('404') ||
          msg.includes('503') ||
          msg.includes('UNAVAILABLE') ||
          msg.includes('NOT_FOUND') ||
          msg.includes('not found') ||
          msg.includes('high demand') ||
          msg.includes('no longer available')
        ) {
          console.warn(`Model ${modelName} not available for chat, trying next candidate...`);
          continue;
        }
        throw err;
      }
    }

    if (!response && lastError) {
      throw lastError;
    }

    const reply = response?.text || 'I could not generate a response. Please try asking again.';
    return res.status(200).json({ reply });
  } catch (err: any) {
    console.error('RouteMeasure Chat Error:', err);
    if (err?.status === 429 || String(err?.message).includes('429')) {
      return res.status(429).json({
        error: 'AI usage limit reached. Please try again in a moment.',
      });
    }
    if (
      err?.status === 503 ||
      String(err?.message).includes('503') ||
      String(err?.message).includes('high demand') ||
      String(err?.message).includes('UNAVAILABLE')
    ) {
      return res.status(503).json({
        error: 'RouteMeasure Assistant is experiencing high AI traffic. Please try again in a moment.',
      });
    }
    return res.status(500).json({
      error: 'Failed to process chat message.',
    });
  }
}
