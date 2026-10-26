# SSG e GitHub Pages — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans para executar as tarefas nesta sessão.

**Goal:** Publicar a apuração encerrada como site estático, com dados completos e fotos versionáveis e todas as interações existentes.

**Architecture:** Arquivar as respostas brutas completas das 29 abrangências dos dois turnos e suas fotos. Ler os arquivos somente no build; gerar HTML com o resultado inicial e JSON de timeline por abrangência. A interface carrega cada histórico sob demanda, sem polling. Publicar `out/` via GitHub Actions com o prefixo informado pelo Pages.

**Tech Stack:** Next.js 16.3.8, React 19, TypeScript, Node.js 24, node:test, GitHub Actions.

**Spec:** Descrição da migração aprovada pelo usuário nesta conversa em 26/10/2026.

## Global Constraints

- Preservar os snapshots existentes, inclusive a alteração prévia em snapshots-6258.jsonl.
- Dados completos e fotos locais; nenhum acesso ao TSE ou ao Google no build ou na navegação.
- Manter mapa, seleção de abrangência/candidato, timelines, comparações, projeção histórica, tutorial, sons e comemoração.
- Suportar domínio raiz e subdiretório de repositório; não versionar `out/` ou `.next/`.
- Configurar o workflow; não há remote Git configurado nesta cópia, portanto não publicar remotamente.

## Review Focus

- Prefixos em fotos, áudio e recursos internos das animações.
- Troca rápida de UF: uma resposta anterior não pode substituir o histórico atual.
- Comemoração após fechar o tutorial deve funcionar sem uma próxima consulta periódica.
- Arquivos incompletos ou abrangências faltantes devem interromper o build.
- Dados estáticos devem manter totais e metadados oficiais de ambos os turnos.

### Task 1: Arquivo permanente da apuração

**Files:** criar scripts/archive-results.mjs, scripts/lib/archive.mjs, tests/archive.test.mjs, data/resultados-{6257,6258}.json, public/fotos/; fonte e licença em src/app/fonts/.

**Interfaces:** arquivo `{ eleicao, arquivadoEm, abrangencias }` com as respostas brutas completas por scope; fotos `/fotos/<eleicao>/<sqcand>.jpeg`.

- [x] Testar validação de abrangências, totalização, consistência de votos e fotos; observar falha antes da implementação.
- [x] Implementar download explícito e validação; baixar e preservar os dois turnos e fotos sem alterar snapshots.
- [x] Verificar os arquivos e a correspondência dos totais com snapshots.

### Task 2: Exportação e navegação estática

**Files:** adaptar src/lib/tse.ts e snapshots.ts; criar src/lib/static-data.ts e src/lib/assets.ts; adaptar page, layout, Apuracao, AlertaSom, Onboarding, sons e AvisoVitoria; substituir APIs dinâmicas por timeline estática; configurar next.config.ts.

**Interfaces:** `carregarApuracao(): Promise<ApuracaoResponse>`, `carregarComparacao(): Promise<ComparacaoResponse>`, `carregarTimeline(scope: Scope): Promise<TimelineResponse>`; `assetPath(path: string): string` aplica NEXT_PUBLIC_BASE_PATH uma vez.

- [x] Testar prefixo, integridade dos dados e geração das 29 timelines; verificar falha antes da implementação.
- [x] Extrair processamento atual para build sem alterar fórmulas, passar dados iniciais pelo Server Component e carregar timelines estáticas sob demanda.
- [x] Adaptar comemoração e tutorial para ausência de polling; ajustar texto de arquivo histórico.
- [x] Gerar e verificar export em raiz e subdiretório, incluindo fotos, áudio e animações.

### Task 3: Deploy e documentação

**Files:** .github/workflows/deploy-pages.yml, README.md, docs/fontes-de-dados.md, package.json e lockfile quando necessário; script de verificação de `out/`.

- [x] Configurar instalação reprodutível, lint, testes, build, upload e deploy com permissões Pages/OIDC e environment github-pages.
- [x] Documentar dados versionados, atualização explícita, preview estático, domínio customizado e habilitação Pages/Actions.
- [x] Executar lint, testes, TypeScript e export; validar no navegador mapa, comparações, tutorial e comemoração.
- [x] Revisar o conjunto das mudanças antes de concluir; relatar que a execução remota depende de configurar um repositório.

## Progresso

- Escopo adicional aprovado: tutorial apenas pelo botão de ajuda; slider global reproduz placar, mapa e gráfico. Gerar retratos compactos no build a partir dos snapshots e carregar esse JSON local uma vez. Posição inicial no resultado final; botões de navegação e retorno ao final. Não inventar abstenção histórica ausente dos snapshots. Testar retratos inicial/intermediário/final e metadados sem antecipar eleitos.
- Ajuste solicitado: incorporar o slider à barra existente de percentual das urnas, eliminando o card separado; a posição visual corresponde ao percentual da abrangência selecionada. Setas navegam pelos ciclos gravados, Home/End levam ao início/final.
- Revisão: corrigida a exclusão dos snapshots de UFs com zero seções (sem dt), com teste RED→GREEN das 29 abrangências iniciais e das projeções consistentes; horário rec usado nesses registros. Fallback regional usa o momento do replay, nunca o horário final.

- Baseline: `npm run lint` passou; não havia suíte de testes.
- Execução autorizada pelo usuário; implementar diretamente na sessão e na branch local, preservando a alteração prévia nos snapshots. Não criar outro worktree nem solicitar nova aprovação do plano.
- Ruling: Roraima tem 100% das seções e tf=n na fonte; exigir finalização nacional e todas as seções contadas, preservando literalmente o status regional em vez de inventar finalização.
- Task 1: complete — arquivos completos dos dois turnos, 14 fotos e fonte local; testes de integridade e correspondência com snapshots passaram.
- Ruling: usar `next build --webpack`, suportado pela versão instalada; o Turbopack falha ao abrir uma porta interna neste ambiente, inclusive após escalonamento. Webpack exportou as 33 entradas sem erro e sem consulta externa.
- Task 2 e Task 3: complete — 16 testes passaram para cada turno; lint, TypeScript e diff-check passaram. Build e verify:export passaram para segundo turno na raiz, primeiro turno na raiz e segundo turno em /Eleicao/ (34 entradas estáticas).
- Verificação no navegador do artefato /Eleicao/: tutorial fechado na primeira visita; botão de ajuda abre/fecha; slider integrado à barra move Brasil e UF pelo percentual e mantém o mesmo ciclo no mapa; comparação usa o ponto selecionado; setas do teclado avançam; fotos e animações locais carregam; console sem erros/avisos.
- Revisões independentes identificaram a corrida do tutorial antigo (eliminada pelo novo requisito de abertura manual) e os dois casos iniciais de replay (corrigidos com teste RED→GREEN). Nenhum apontamento importante permanece pendente. Snapshot preexistente preservado sem edição.
- Execução remota não realizada: esta cópia não possui remote Git. Workflow e instruções de habilitação Pages/Actions estão prontos no projeto; nenhum repositório ou publicação externa foi criado.
