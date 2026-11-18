import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured in environment secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'up-internai' });
  });

  // 1. Auto-Fill Recruiter Role Filters from Natural Language
  app.post('/api/ai/parse-requirement', async (req, res) => {
    try {
      const { prompt } = req.body as { prompt?: string };
      if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 5) {
        return res.status(400).json({ error: 'Provide a descriptive internship requirement.' });
      }

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Extract structured internship filter constraints from this recruiter prompt.
Default year for summer dates like "May 15" is 2027 (YYYY-MM-DD). Clamp durationWeeks between 4 and 16, and stipendMonthly between 0 and 25000.
Prompt: "${prompt.trim()}"`,
        config: {
          systemInstruction:
            'Extract exact structured JSON for UP-InternAI recruiter filters: companyName, roleTitle, requiredSkills (array of concise tech tags), startDate (YYYY-MM-DD), durationWeeks (integer 4-16), stipendMonthly (integer 0-25000), ppoAvailable (boolean), mode ("Remote" | "Hybrid" | "On-site"), city.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              companyName: { type: Type.STRING },
              roleTitle: { type: Type.STRING },
              requiredSkills: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              startDate: { type: Type.STRING },
              durationWeeks: { type: Type.INTEGER },
              stipendMonthly: { type: Type.INTEGER },
              ppoAvailable: { type: Type.BOOLEAN },
              mode: { type: Type.STRING },
              city: { type: Type.STRING },
            },
            required: [
              'roleTitle',
              'requiredSkills',
              'startDate',
              'durationWeeks',
              'stipendMonthly',
              'ppoAvailable',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      return res.json({ parsed });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse requirement via Gemini.';
      return res.status(502).json({ error: message });
    }
  });

  // 2. Student Onboarding: Natural-Language Profile Builder
  app.post('/api/ai/parse-profile', async (req, res) => {
    try {
      const { bio } = req.body as { bio?: string };
      if (!bio || typeof bio !== 'string' || bio.trim().length < 8) {
        return res.status(400).json({ error: 'Write a short paragraph describing your university, year, skills, dates, and stipend.' });
      }

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Extract structured student onboarding fields from this Uttar Pradesh student introduction.
Default year for dates like May 1 to July 31 is 2027 (YYYY-MM-DD).
Student intro: "${bio.trim()}"`,
        config: {
          systemInstruction:
            'Extract JSON for UP-InternAI student onboarding: name, university (short campus name like MJPRU Bareilly, IET Lucknow, MMMUT Gorakhpur, HBTU Kanpur, KNIT Sultanpur, GLA Mathura, or AKTU), city, year (integer 2-4), branch, skills (array), available_from (YYYY-MM-DD), available_to (YYYY-MM-DD), min_stipend (integer INR), wants_ppo (boolean), projectsSummary (concise 1-sentence summary inferred or stated).',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              university: { type: Type.STRING },
              city: { type: Type.STRING },
              year: { type: Type.INTEGER },
              branch: { type: Type.STRING },
              skills: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              available_from: { type: Type.STRING },
              available_to: { type: Type.STRING },
              min_stipend: { type: Type.INTEGER },
              wants_ppo: { type: Type.BOOLEAN },
              projectsSummary: { type: Type.STRING },
            },
            required: [
              'name',
              'university',
              'year',
              'skills',
              'available_from',
              'available_to',
              'min_stipend',
              'wants_ppo',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      return res.json({ parsed });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse student profile via Gemini.';
      return res.status(502).json({ error: message });
    }
  });

  // 3. Stage 2 AI Semantic Ranking + 1-Sentence "Why Shortlisted"
  app.post('/api/ai/rank-shortlist', async (req, res) => {
    try {
      const { opening, candidates } = req.body as {
        opening: {
          roleTitle: string;
          requiredSkills: string[];
          startDate: string;
          durationWeeks: number;
          stipendMonthly: number;
          ppoAvailable: boolean;
          blindMode: boolean;
        };
        candidates: Array<{
          id: string;
          name: string;
          universityName: string;
          year: number;
          skills: string[];
          projectsSummary: string;
          availableFrom: string;
          availableTo: string;
        }>;
      };

      if (!opening || !Array.isArray(candidates) || candidates.length === 0) {
        return res.status(400).json({ error: 'Opening and shortlisted candidates are required.' });
      }

      const ai = getAiClient();
      const sanitizedCandidates = candidates.map((c) => ({
        id: c.id,
        name: c.name,
        campus: opening.blindMode ? 'University Hidden — Blind Mode' : c.universityName,
        year: c.year,
        skills: c.skills,
        projectsSummary: c.projectsSummary,
        availability: `${c.availableFrom} to ${c.availableTo}`,
      }));

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Score each candidate 0-100 on skill and project alignment for "${opening.roleTitle}" (Required: ${opening.requiredSkills.join(', ')}, ${opening.durationWeeks} weeks from ${opening.startDate}, ₹${opening.stipendMonthly}/mo, PPO: ${opening.ppoAvailable}).
Provide a crisp 1-sentence "whyShortlisted" insight for each candidate.${
          opening.blindMode
            ? ' CRITICAL: Blind College Mode is ON — do NOT mention any university or city name in whyShortlisted.'
            : ''
        }
Candidates: ${JSON.stringify(sanitizedCandidates)}`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              rankings: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    score: { type: Type.INTEGER },
                    whyShortlisted: { type: Type.STRING },
                  },
                  required: ['id', 'score', 'whyShortlisted'],
                },
              },
            },
            required: ['rankings'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        rankings?: Array<{ id: string; score: number; whyShortlisted: string }>;
      };

      const rankingsById: Record<string, { score: number; whyShortlisted: string }> = {};
      for (const item of parsed.rankings ?? []) {
        rankingsById[item.id] = {
          score: Math.max(0, Math.min(100, Math.round(item.score))),
          whyShortlisted: item.whyShortlisted,
        };
      }

      return res.json({ rankingsById });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to rank candidates via Gemini.';
      return res.status(502).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`UP-InternAI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
