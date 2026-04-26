import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { ReviewOrchestrator } from './orchestrator.js';
import crypto from 'crypto';
import { createHash } from 'crypto';
import rateLimit from 'express-rate-limit';
import { extractAndParseJSON } from './utils/parser.js';
import { AnalysisPayloadSchema, FinalReportSchema } from './schemas/contracts.js';
import { getDefaultModel } from './config.js';
import { resolveAgentIds } from './agents/agent_parser.js';
import { AgentId } from './agents/catalog.js';
import { LlmResultParseError } from './errors.js';

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_CONCURRENT_ANALYSES = readPositiveInteger(process.env.ALEX_API_MAX_CONCURRENT_ANALYSES, 2);
let activeAnalyses = 0;

// trust proxy restrito ao loopback: aceita X-Forwarded-For apenas de proxies na mesma máquina.
// Para Cloud Run/Kubernetes, substitua 'loopback' pelo CIDR da sua rede interna (ex: '10.0.0.0/8')
// para evitar IP Spoofing via cabeçalhos X-Forwarded-For arbitrários.
const TRUSTED_PROXY = process.env.TRUSTED_PROXY_CIDR || 'loopback';
app.set('trust proxy', TRUSTED_PROXY);

app.use(cors());
const jsonParser = express.json({ limit: '10mb' });

function readPositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function withAnalysisSlot<T>(fn: () => Promise<T>): Promise<T | undefined> {
  if (activeAnalyses >= MAX_CONCURRENT_ANALYSES) return undefined;
  activeAnalyses += 1;
  try {
    return await fn();
  } finally {
    activeAnalyses -= 1;
  }
}

// Rota de Health-Check (Obrigatório para Cloud Run e Kubernetes)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', version: '1.0.0' });
});

// Middleware de Autenticação Bearer (Fail-Closed + Timing-Safe)
const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = process.env.API_BEARER_TOKEN;
  // Fail-Closed: se o token não foi configurado, a API é bloqueada por segurança
  if (!token) {
    console.error('[API Auth Misconfigured]', { path: req.path });
    return res.status(500).json({ error: "Server Misconfiguration", message: "API_BEARER_TOKEN não está configurado no servidor. Acesso bloqueado." });
  }

  const authHeader = req.headers.authorization;
  const expected = `Bearer ${token}`;
  // Usa timingSafeEqual para evitar Timing Attack por comparação de string curta
  const providedHash = createHash('sha256').update(authHeader || '').digest();
  const expectedHash = createHash('sha256').update(expected).digest();
  const isValid = crypto.timingSafeEqual(providedHash, expectedHash);

  if (!isValid) {
    console.warn('[API Unauthorized]', { path: req.path, ip: req.ip });
    return res.status(401).json({ error: "Unauthorized", message: "Token de acesso inválido ou ausente." });
  }
  next();
};

// Rate Limiter: Max 10 reqs por minuto por IP
// AVISO: MemoryStore (padrão) não é compartilhado entre instâncias em Cloud Run/Kubernetes.
// Em ambientes multi-pod, substitua por RedisStore: https://github.com/express-rate-limit/rate-limit-redis
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  standardHeaders: true,  // Retorna RateLimit-* headers padrão RFC
  legacyHeaders: false,
  message: { error: "Too Many Requests", message: "Limite de requisições excedido. Tente novamente mais tarde." }
});

// Endpoint principal de Ingestão de Diffs e Arquivos
app.post('/v1/analyze', apiLimiter, authMiddleware, jsonParser, async (req, res) => {
  const requestStreamId = typeof req.body?.streamId === 'string' && req.body.streamId.length <= 100 && req.body.streamId !== ''
    ? req.body.streamId
    : crypto.randomUUID();

  // Valida o payload de entrada via Zod (Contract-First)
  const validation = AnalysisPayloadSchema.safeParse(req.body);
  if (!validation.success) {
    console.warn('[API Invalid Payload]', {
      streamId: requestStreamId,
      details: validation.error.flatten(),
    });
    return res.status(400).json({ error: "Invalid Payload", details: validation.error.flatten() });
  }
  const { streamId, metadata, diff, sourceCode } = validation.data;
  const effectiveStreamId = streamId || requestStreamId;
  let enabledAgents: AgentId[];

  try {
    enabledAgents = resolveAgentIds({
      agents: metadata?.agents?.join(','),
      disabledAgents: metadata?.disabledAgents?.join(','),
    });
  } catch (error: unknown) {
    console.warn('[API Invalid Agent Selection]', {
      streamId: effectiveStreamId,
      message: error instanceof Error ? error.message : 'Selecao de agentes invalida.',
    });
    return res.status(400).json({
      error: "Invalid Agent Selection",
      message: error instanceof Error ? error.message : "Selecao de agentes invalida.",
    });
  }

  const request = {
    streamId: effectiveStreamId,
    metadata: metadata || { stack: "Auto-detected", project: "api-client" },
    diff,
    sourceCode
  };

  try {
    const rawResult = await withAnalysisSlot(async () => {
      const requestedModel = request.metadata?.model || getDefaultModel();
      const orchestrator = new ReviewOrchestrator(requestedModel, { enabledAgents });
      return orchestrator.analyze(request);
    });
    if (rawResult === undefined) {
      console.warn('[API Backpressure]', {
        streamId: effectiveStreamId,
        activeAnalyses,
        maxConcurrentAnalyses: MAX_CONCURRENT_ANALYSES,
      });
      res.setHeader('Retry-After', '30');
      return res.status(503).json({
        error: "Service Unavailable",
        message: "A.L.E.X esta processando o limite maximo de analises simultaneas. Tente novamente em instantes.",
      });
    }
    
    // Parse the JSON result from the Orchestrator
    let jsonResult;
    try {
      jsonResult = extractAndParseJSON(rawResult);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Falha ao interpretar JSON da IA.';
      throw new LlmResultParseError(message, rawResult);
    }

    const reportValidation = FinalReportSchema.safeParse(jsonResult);
    if (!reportValidation.success) {
      throw new LlmResultParseError(
        `Contrato de resposta invalido: ${reportValidation.error.message}`,
        rawResult,
      );
    }
    
    return res.status(200).json(reportValidation.data);
  } catch (error: unknown) {
    console.error('[API Error]', {
      streamId: effectiveStreamId,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      rawResult: error instanceof LlmResultParseError ? error.rawResult.slice(0, 16_384) : undefined,
    });
    
    if (error instanceof Error) {
      // Tratar erro de Cota Excedida do Gemini
      if (error.message && error.message.includes('429')) {
        return res.status(429).json({ 
          error: "Rate Limit Exceeded", 
          message: "O limite da cota do Gemini API foi excedido. Atualize a sua chave de API ou habilite faturamento no projeto."
        });
      }

      return res.status(500).json({ 
        error: "Internal Server Error", 
        message: "Falha inesperada durante a execução do A.L.E.X" 
      });
    }

    return res.status(500).json({ 
      error: "Internal Server Error", 
      message: "Falha inesperada durante a execução do A.L.E.X" 
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 A.L.E.X API Provider rodando em http://localhost:${PORT}`);
});
