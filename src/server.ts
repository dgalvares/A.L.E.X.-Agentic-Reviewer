import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { ReviewOrchestrator } from './orchestrator.js';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { extractAndParseJSON } from './utils/parser.js';
import { AnalysisPayloadSchema } from './schemas/contracts.js';

const app = express();
const PORT = process.env.PORT || 3000;

// trust proxy restrito ao loopback: aceita X-Forwarded-For apenas de proxies na mesma máquina.
// Para Cloud Run/Kubernetes, substitua 'loopback' pelo CIDR da sua rede interna (ex: '10.0.0.0/8')
// para evitar IP Spoofing via cabeçalhos X-Forwarded-For arbitrários.
const TRUSTED_PROXY = process.env.TRUSTED_PROXY_CIDR || 'loopback';
app.set('trust proxy', TRUSTED_PROXY);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rota de Health-Check (Obrigatório para Cloud Run e Kubernetes)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', version: '1.0.0' });
});

// Middleware de Autenticação Bearer (Fail-Closed + Timing-Safe)
const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = process.env.API_BEARER_TOKEN;
  // Fail-Closed: se o token não foi configurado, a API é bloqueada por segurança
  if (!token) {
    return res.status(500).json({ error: "Server Misconfiguration", message: "API_BEARER_TOKEN não está configurado no servidor. Acesso bloqueado." });
  }

  const authHeader = req.headers.authorization;
  const expected = `Bearer ${token}`;
  // Usa timingSafeEqual para evitar Timing Attack por comparação de string curta
  const isValid = authHeader !== undefined &&
    authHeader.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));

  if (!isValid) {
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
app.post('/v1/analyze', apiLimiter, authMiddleware, async (req, res) => {
  // Valida o payload de entrada via Zod (Contract-First)
  const validation = AnalysisPayloadSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ error: "Invalid Payload", details: validation.error.flatten() });
  }
  const { streamId, metadata, diff, sourceCode } = validation.data;

  const request = {
    streamId: streamId || crypto.randomUUID(),
    metadata: metadata || { stack: "Auto-detected", project: "api-client" },
    diff,
    sourceCode
  };

  try {
    const requestedModel = (req.body.metadata?.model as string | undefined) || process.env.ALEX_MODEL;
    const orchestrator = new ReviewOrchestrator(requestedModel);
    const rawResult = await orchestrator.analyze(request);
    
    // Parse the JSON result from the Orchestrator
    const jsonResult = extractAndParseJSON(rawResult);
    
    return res.status(200).json(jsonResult);
  } catch (error: unknown) {
    console.error('[API Error]', error);
    
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
        message: error.message || "Falha inesperada durante a execução do A.L.E.X" 
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
