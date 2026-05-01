# A.L.E.X Release Workflow

Este workflow deve ser usado no Antigravity para preparar, publicar e validar releases do pacote `@dgalvarestec/alex`.

## Objetivo

Publicar uma nova versão npm com provenance, criar uma GitHub Release draft com release notes revisáveis e garantir paridade entre `package.json`, tag Git, artefato `.tgz` e documentação.

## Quando Usar

Use este workflow quando houver uma mudança pronta para publicação pública, incluindo:

- correções de bug ou segurança;
- novos agentes, prompts, comandos ou opções CLI;
- mudanças em workflow GitHub Actions;
- alterações de contrato, comportamento ou documentação de uso.

## Papéis

- **Release owner:** conduz a checklist, decide o tipo de versão e revisa as release notes.
- **A.L.E.X local:** valida código com `npm test` e, quando aplicável, `alex review`.
- **GitHub Actions:** valida, empacota, publica no npm e cria a GitHub Release draft.

## Pré-Requisitos

- Working tree revisado, sem mudanças acidentais.
- `npm-production` configurado como environment no GitHub.
- Trusted Publishing/OIDC configurado no npm para o workflow `.github/workflows/publish.yml`.
- Branch local sincronizada com `origin/main`.
- Nenhum `NPM_TOKEN` permanente deve ser usado.

## Checklist de Decisão

Classifique a versão antes de criar a tag:

| Tipo | Quando usar | Comando |
|---|---|---|
| Patch | Correção compatível, docs, CI, hardening sem mudança de API | `npm version patch` |
| Minor | Nova funcionalidade compatível ou novo agente opt-in | `npm version minor` |
| Major | Breaking change em CLI, API, contratos, defaults ou formato de saída | `npm version major` |

Se houver dúvida entre `patch` e `minor`, prefira `minor` quando o usuário perceber nova capacidade funcional.

## Pré-Release Local

Execute antes de versionar:

```bash
git status
npm run typecheck
npm test
npm pack --dry-run
```

Valide também:

- README atualizado para novos comandos, opções, variáveis e fluxos.
- `.agents/rules.md` e este workflow continuam compatíveis com `.github/workflows/publish.yml`.
- `package.json` inclui apenas arquivos intencionais via `files`.
- Não há secrets, tokens ou arquivos sensíveis no diff.
- Mudanças de prompt/template foram copiáveis pelo `npm run build`.

## Commit de Release Candidate

Inclua no commit apenas o escopo que deve entrar na release:

```bash
git add <arquivos-da-release>
git commit -m "chore: prepare release"
```

Se houver mudanças de produto junto com release workflow/docs, prefira commits separados para facilitar release notes.

## Versionamento e Tag

Crie a versão via npm para manter `package.json`, `package-lock.json` e tag em sincronia:

```bash
npm version patch
```

Substitua `patch` por `minor` ou `major` conforme a classificação.

Antes de publicar, confirme:

```bash
node -p "require('./package.json').version"
git tag --points-at HEAD
```

A tag deve ser exatamente `vX.Y.Z`, igual à versão do `package.json`.

## Publicação

Envie commit e tag:

```bash
git push origin main --follow-tags
```

O workflow `.github/workflows/publish.yml` deve executar nesta ordem:

1. `npm ci`
2. `npm run typecheck`
3. `npm test`
4. validação da tag contra `package.json`
5. `npm pack --dry-run`
6. `npm pack`
7. `npm publish <tgz> --access public --provenance`
8. criação de GitHub Release draft com release notes automáticas

Se qualquer etapa falhar, não crie release manual sem entender e corrigir a causa.

## Revisão da GitHub Release Draft

Após o workflow passar:

- confirme que a release está como draft;
- revise as notas geradas automaticamente;
- destaque breaking changes, migrações, novos comandos, riscos conhecidos e correções importantes;
- confirme que o `.tgz` anexado corresponde ao pacote publicado;
- remova entradas irrelevantes ou mensagens internas;
- publique a GitHub Release manualmente somente após a revisão.

## Validação Pós-Release

Verifique npm e CLI:

```bash
npm view @dgalvarestec/alex version
npm view @dgalvarestec/alex dist.tarball
npm install -g @dgalvarestec/alex
alex --version
alex --help
```

Confirme:

- versão npm igual à tag;
- GitHub Release publicada com a mesma tag;
- provenance disponível no npm;
- comandos principais (`alex review --help`, `alex analyze --help`, `alex ci --help`) exibem as opções documentadas.

## Rollback e Incidentes

Pacotes npm publicados não devem ser apagados como rotina. Em caso de release problemática:

- publique uma nova versão patch corrigindo o problema;
- marque a GitHub Release anterior com aviso claro;
- se houver risco de segurança, documente mitigação e rotação de credenciais quando aplicável;
- use `npm deprecate` apenas quando a versão publicada não deve mais ser consumida.

Exemplo:

```bash
npm deprecate @dgalvarestec/alex@X.Y.Z "Versao descontinuada: use X.Y.Z+1"
```

## Critério de Conclusão

A release só está concluída quando:

- GitHub Actions passou;
- npm publicou a versão esperada;
- GitHub Release foi revisada e publicada;
- release notes refletem impacto real;
- smoke test do CLI passou;
- qualquer follow-up foi registrado em backlog.
