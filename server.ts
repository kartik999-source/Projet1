import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { cosineSimilarity } from './src/engine/matchmaker';

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
    res.json({ ok: true, service: 'setumatch-engine' });
  });

  // 1. Natural-Language Company Requirement -> Structured Constraints JSON
  app.post('/api/ai/parse-requirement', async (req, res) => {
    try {
      const { prompt } = req.body as { prompt?: string };
      if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 5) {
        return res.status(400).json({ error: 'Provide a descriptive requirement prompt.' });
      }

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Parse the following campus internship or evaluation sprint requirement into structured constraints.
Default academic year target is Summer 2027 (May–August 2027) unless Winter Dec 2026–Jan 2027 or explicit dates are mentioned.
Prompt: "${prompt.trim()}"`,
        config: {
          systemInstruction:
            'You are a structured constraint extractor for an Indian campus internship matching engine in Uttar Pradesh. Extract exact ISO dates (YYYY-MM-DD), monthly stipend in INR, duration in months (0.5 for a 2-week sprint), work mode (Remote, Hybrid, or On-site), UP city (Lucknow, Kanpur, Noida, Gorakhpur, Prayagraj, Jhansi, Sultanpur), PPO eligibility, and concise technical skills.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              companyName: { type: Type.STRING },
              roleTitle: { type: Type.STRING },
              startDate: { type: Type.STRING, description: 'ISO date YYYY-MM-DD' },
              endDate: { type: Type.STRING, description: 'ISO date YYYY-MM-DD' },
              durationMonths: { type: Type.NUMBER, description: '0.5 for 2-week sprint, or 1 to 6' },
              isEvaluationSprint: { type: Type.BOOLEAN },
              stipendMonthly: { type: Type.INTEGER, description: 'Monthly stipend in INR' },
              ppoAvailable: { type: Type.BOOLEAN },
              ppoRequiredByRole: { type: Type.BOOLEAN },
              mode: { type: Type.STRING, description: 'Remote, Hybrid, or On-site' },
              city: { type: Type.STRING },
              requiredSkills: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: [
              'roleTitle',
              'startDate',
              'endDate',
              'durationMonths',
              'isEvaluationSprint',
              'stipendMonthly',
              'ppoAvailable',
              'mode',
              'city',
              'requiredSkills',
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

  // 2. Natural-Language Student Bio -> Structured Availability & Skill JSON
  app.post('/api/ai/parse-profile', async (req, res) => {
    try {
      const { bio } = req.body as { bio?: string };
      if (!bio || typeof bio !== 'string' || bio.trim().length < 8) {
        return res.status(400).json({ error: 'Provide a student bio describing year, dates, skills, and stipend.' });
      }

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Extract structured student availability and preferences from this Uttar Pradesh college student bio.
Default year for summer dates like May–July or May–Aug is 2027 (e.g. 2027-05-15 to 2027-07-31). For winter Dec–Jan use 2026-12-20 to 2027-01-20.
Bio: "${bio.trim()}"`,
        config: {
          systemInstruction:
            'Extract structured JSON for a UP college student profile: yearOfStudy (2-4), branch, universityId (one of iet-aktu, hbtu-kanpur, mmmut-gkp, knit-sultanpur, biet-jhansi, iiit-allahabad if matched else iet-aktu), availabilityStart (YYYY-MM-DD), availabilityEnd (YYYY-MM-DD), maxDurationMonths (1-6), minStipend (INR integer), wantsPpo (boolean), openToSprint (boolean), preferredModes (array from Remote, Hybrid, On-site), skills (array of concise tech names).',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              yearOfStudy: { type: Type.INTEGER },
              branch: { type: Type.STRING },
              universityId: { type: Type.STRING },
              availabilityStart: { type: Type.STRING },
              availabilityEnd: { type: Type.STRING },
              maxDurationMonths: { type: Type.NUMBER },
              minStipend: { type: Type.INTEGER },
              wantsPpo: { type: Type.BOOLEAN },
              openToSprint: { type: Type.BOOLEAN },
              preferredModes: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              skills: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: [
              'yearOfStudy',
              'branch',
              'availabilityStart',
              'availabilityEnd',
              'maxDurationMonths',
              'minStipend',
              'wantsPpo',
              'preferredModes',
              'skills',
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

  // 3. Stage 2 Semantic Ranking (gemini-embedding-2) + 2-line Explainability (gemini-4-hydrogen)
  app.post('/api/ai/explain-matches', async (req, res) => {
    try {
      const { requirement, candidates } = req.body as {
        requirement: {
          roleTitle: string;
          naturalPrompt: string;
          requiredSkills: string[];
          startDate: string;
          endDate: string;
          stipendMonthly: number;
          ppoAvailable: boolean;
          blindMode: boolean;
        };
        candidates: Array<{
          id: string;
          blindCode: string;
          name: string;
          universityName: string;
          yearOfStudy: number;
          skills: string[];
          projects: Array<{ title: string; summary: string; stack: string[] }>;
          overlapDays: number;
          microTestScore: number | null;
        }>;
      };

      if (!requirement || !Array.isArray(candidates) || candidates.length === 0) {
        return res.status(400).json({ error: 'Requirement and candidates are required.' });
      }

      const ai = getAiClient();

      // Compute semantic vector similarity using gemini-embedding-2
      const reqText = `${requirement.roleTitle}. Skills: ${requirement.requiredSkills.join(', ')}. Context: ${requirement.naturalPrompt}`;
      const candidateTexts = candidates.map(
        (c) =>
          `Skills: ${c.skills.join(', ')}. Projects: ${c.projects
            .map((p) => `${p.title} (${p.stack.join(', ')}): ${p.summary}`)
            .join('; ')}`
      );

      const embedResult = await ai.models.embedContent({
        model: 'gemini-embedding-2',
        contents: [reqText, ...candidateTexts],
      });

      const embeddings = embedResult.embeddings ?? [];
      const reqVector = embeddings[0]?.values ?? [];
      const embeddingScores: Record<string, number> = {};

      candidates.forEach((c, idx) => {
        const candVector = embeddings[idx + 1]?.values ?? [];
        if (reqVector.length > 0 && candVector.length > 0) {
          embeddingScores[c.id] = cosineSimilarity(reqVector, candVector);
        }
      });

      // Generate concise 2-line "Why Shortlisted" cards with gemini-4-hydrogen
      const candidateBriefs = candidates.map((c) => ({
        id: c.id,
        label: requirement.blindMode ? `Candidate ${c.blindCode}` : `${c.name} (${c.universityName})`,
        year: c.yearOfStudy,
        overlapDays: c.overlapDays,
        skills: c.skills,
        projects: c.projects.map((p) => `${p.title}: ${p.summary}`),
        microTestScore: c.microTestScore,
      }));

      const explainRes = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Role: ${requirement.roleTitle} (${requirement.startDate} to ${requirement.endDate}, ₹${requirement.stipendMonthly}/mo, Stack: ${requirement.requiredSkills.join(', ')}).
Blind Mode: ${requirement.blindMode ? 'YES — do NOT mention student real names or university names' : 'NO'}.
Generate a crisp, factual 2-line "whyShortlisted" explanation (max 28 words each) for each candidate referencing their calendar overlap and concrete GitHub/micro-test proof:
${JSON.stringify(candidateBriefs)}`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              explanations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    whyShortlisted: { type: Type.STRING },
                  },
                  required: ['id', 'whyShortlisted'],
                },
              },
            },
            required: ['explanations'],
          },
        },
      });

      const explainJson = JSON.parse((explainRes.text ?? '{}').trim()) as {
        explanations?: Array<{ id: string; whyShortlisted: string }>;
      };

      const explanationsById: Record<string, string> = {};
      for (const item of explainJson.explanations ?? []) {
        explanationsById[item.id] = item.whyShortlisted;
      }

      return res.json({ embeddingScores, explanationsById });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to enrich matches via Gemini.';
      return res.status(502).json({ error: message });
    }
  });

  // 4. Generate 10-Min Domain Micro-Test tailored to tech stack
  app.post('/api/ai/micro-test', async (req, res) => {
    try {
      const { domain, skills } = req.body as { domain?: string; skills?: string[] };
      const stackText =
        Array.isArray(skills) && skills.length > 0 ? skills.join(', ') : domain || 'FastAPI, Python, PostgreSQL';

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Generate 3 practical, scenario-based multiple choice engineering micro-test questions for a 2nd-year engineering student applying for a stack of: ${stackText}. Keep each question concise and code/architecture grounded.`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    question: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    correctIndex: { type: Type.INTEGER },
                    explanation: { type: Type.STRING },
                  },
                  required: ['id', 'question', 'options', 'correctIndex', 'explanation'],
                },
              },
            },
            required: ['questions'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      return res.json({ questions: parsed.questions ?? [] });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate micro-test via Gemini.';
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
    console.log(`SetuMatch server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
