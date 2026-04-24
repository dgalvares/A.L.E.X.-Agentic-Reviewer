#!/usr/bin/env node

import { Command } from 'commander';
import { execSync } from 'child_process';
import ora from 'ora';
import pc from 'picocolors';
import { ReviewOrchestrator } from './orchestrator.js';
import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carrega o .env da pasta onde o CLI foi instalado (A.L.E.X raiz)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

if (!process.env.GEMINI_API_KEY) {
  console.error(pc.red('Erro: GEMINI_API_KEY não configurada!'));
  console.log(pc.yellow('Crie um arquivo .env na raiz do projeto A.L.E.X ou exporte a variável globalmente.'));
  process.exit(1);
}

const program = new Command();

program
  .name('alex')
  .description('A.L.E.X (Advanced Logic Evaluation X-ray) CLI')
  .version('1.0.0');

program
  .command('review')
  .description('Analisa as modificações locais (git diff) usando o conselho de especialistas.')
  .action(async () => {
    console.log(pc.cyan(pc.bold('\n🛡️ A.L.E.X Code Review Iniciado\n')));

    const spinner = ora('Capturando git diff local...').start();

    let diffContent = '';
    try {
      // Pega o diff do working directory e staged files.
      diffContent = execSync('git diff HEAD', { encoding: 'utf-8' });
    } catch (error: any) {
      spinner.fail(pc.red('Falha ao tentar executar git diff. Certifique-se de que está em um repositório git.'));
      process.exit(1);
    }

    if (!diffContent || diffContent.trim() === '') {
      spinner.succeed(pc.green('Nenhuma modificação encontrada no repositório. O código está limpo.'));
      process.exit(0);
    }

    spinner.text = 'Analisando código com o Conselho de Especialistas (gemini-2.0-flash)... Isso pode levar alguns segundos.';

    const orchestrator = new ReviewOrchestrator();
    
    const request = {
      streamId: crypto.randomUUID(),
      metadata: {
        stack: "Auto-detected",
        project: process.cwd().split(/[\/\\]/).pop() || 'local-workspace'
      },
      diff: diffContent
    };

    try {
      const rawResult = await orchestrator.analyze(request);
      
      let result;
      try {
        const cleanedJSON = rawResult.replace(/```json\n?|\n?```/g, '').trim();
        result = JSON.parse(cleanedJSON);
      } catch (parseError) {
        spinner.fail(pc.red('Erro ao interpretar a resposta da IA. O formato JSON esperado falhou.'));
        console.error(rawResult);
        process.exit(1);
      }

      spinner.stop();
      
      // Imprimindo o Veredito
      const isPass = result.verdict === 'PASS';
      const isWarn = result.verdict === 'WARN';
      
      const verdictColor = isPass ? pc.green : (isWarn ? pc.yellow : pc.red);
      console.log(verdictColor(pc.bold(`\nVeredito Final: ${result.verdict}`)));
      console.log(pc.gray(`--------------------------------------------------`));
      console.log(pc.white(result.summary));
      console.log(pc.gray(`--------------------------------------------------\n`));

      if (result.issues && result.issues.length > 0) {
        console.log(pc.bold('Detalhes dos Apontamentos:\n'));
        result.issues.forEach((issue: any) => {
          const sevColor = issue.severity === 'Blocker' || issue.severity === 'Critical' ? pc.red : pc.yellow;
          console.log(`[${sevColor(issue.severity)}] ${pc.cyan(issue.origin)}`);
          console.log(`Arquivo: ${pc.underline(issue.file)}${issue.line ? ` (Linha ${issue.line})` : ''}`);
          console.log(`Mensagem: ${issue.message}`);
          if (issue.codeSnippet) {
            console.log(pc.gray(`Trecho: ${issue.codeSnippet.trim()}`));
          }
          console.log('');
        });
      }

      if (!isPass) {
        process.exit(1); // Retorna erro pro CI/CD se reprovado
      }
      
    } catch (error: any) {
      spinner.fail(pc.red('Erro durante a análise do A.L.E.X.'));
      
      if (error.message && error.message.includes('429')) {
         console.error(pc.yellow('\n⚠️ Limite de Cota Atingido (429 Too Many Requests). Verifique sua chave de API ou aguarde alguns minutos.\n'));
      } else {
         console.error(error);
      }
      process.exit(1);
    }
  });

program.parse(process.argv);
