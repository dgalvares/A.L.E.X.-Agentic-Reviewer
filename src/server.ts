import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ReviewOrchestrator } from './orchestrator.js';
import crypto from 'crypto';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Rota de Health-Check (Obrigatório para Cloud Run e Kubernetes)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', version: '1.0.0' });
});

// Endpoint principal de Ingestão de Diffs
app.post('/v1/analyze', async (req, res) => {
  const { streamId, metadata, diff } = req.body;

  if (!diff || typeof diff !== 'string') {
    return res.status(400).json({ error: "Campo 'diff' é obrigatório e deve ser uma string." });
  }

  const request = {
    streamId: streamId || crypto.randomUUID(),
    metadata: metadata || { stack: "Auto-detected" },
    diff: diff
  };

  try {
    const orchestrator = new ReviewOrchestrator();
    const rawResult = await orchestrator.analyze(request);
    
    // Parse the JSON result from the Orchestrator
    const cleanedJSON = rawResult.replace(/```json\n?|\n?```/g, '').trim();
    const jsonResult = JSON.parse(cleanedJSON);
    
    return res.status(200).json(jsonResult);
  } catch (error: any) {
    console.error('[API Error]', error);
    
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
});

app.listen(PORT, () => {
  console.log(`🚀 A.L.E.X API Provider rodando em http://localhost:${PORT}`);
});
