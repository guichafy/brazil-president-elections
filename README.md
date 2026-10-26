# Apuração 2026 · Presidente

Resultado e histórico da apuração presidencial de 2026, com Next.js e TypeScript. O site é exportado como HTML, CSS, JavaScript e JSON estáticos para o **GitHub Pages**, sem servidor Next.js em produção.

- Mapa do Brasil por estado, com destaque por candidato e seleção de UF/exterior.
- Placar, votos válidos, brancos, nulos, comparecimento e abstenção.
- Linha do tempo nacional e de cada abrangência, por percentual apurado ou horário, com projeções históricas.
- Comparações nacionais do segundo turno com o primeiro turno e com 2022.
- A própria barra de percentual das urnas funciona como slider: placar, mapa e ponto no gráfico acompanham o momento escolhido, com navegação por teclado, Play/Pausar e retorno ao resultado final, sem um card adicional. O Play respeita a duração integral dos áudios de cada candidato nas viradas.
- Ajuda pelo botão “❓ Como funciona?”, testes de áudio e comemoração da vitória. O tutorial nunca abre automaticamente. A comemoração é um timelapse de 90 segundos, com pausa, busca e saltos de 10s sincronizados à música, mapa em setores de pizza, fotos e votos por UF.

Todos os resultados, fotos, sons, animações, malha do mapa e fonte tipográfica usados pelo site são locais. **O build e os acessos não consultam o TSE nem o Google.**

## Desenvolvimento

Requer Node.js **24 ou superior**.

```bash
npm ci
npm run dev
```

Abra `http://localhost:3000`. Não é necessário executar o gravador.

## Exportar e visualizar

```bash
npm test
npm run lint
npm run build
npm run verify:export
npm run preview
```

O build gera `out/`, que pode ser servido por qualquer servidor estático. O preview abre em `http://localhost:3000` e serve exclusivamente o conteúdo exportado; `next start` não é usado.

Para simular um site de projeto do Pages:

```bash
NEXT_PUBLIC_BASE_PATH=/Eleicao npm run build
NEXT_PUBLIC_BASE_PATH=/Eleicao npm run verify:export
NEXT_PUBLIC_BASE_PATH=/Eleicao npm run preview
```

Abra `http://localhost:3000/Eleicao/`. O prefixo é definido no build e deve ser o mesmo no preview. Para domínio próprio ou `<usuario>.github.io`, use prefixo vazio. `PORT=3001 npm run preview` altera a porta local.

O padrão é o **segundo turno (`6258`)**. Para exportar o primeiro, use `TSE_ELEICAO=6257` nos comandos de build e verificação. O site publicado pelo workflow usa o segundo turno.

## GitHub Pages via Actions

O workflow [deploy-pages.yml](.github/workflows/deploy-pages.yml) instala as dependências pelo lockfile, executa lint e testes, exporta o site, verifica o artefato e publica no environment `github-pages`.

1. O repositório de publicação é [guichafy/brazil-president-elections](https://github.com/guichafy/brazil-president-elections), com branch principal `main`.
2. Em **Settings → Pages → Build and deployment → Source**, selecione **GitHub Actions**.
3. Faça push na `main` ou execute o workflow manualmente nessa branch.

O prefixo de URL vem de `actions/configure-pages`: funciona em `/<repositorio>/` e com domínio próprio. Pull requests executam validação e build, sem publicar. Não são necessários tokens pessoais ou secrets adicionais; o deploy usa o `GITHUB_TOKEN` e OIDC.

URL do projeto: [guichafy.github.io/brazil-president-elections](https://guichafy.github.io/brazil-president-elections/).

Versione `data/`, `public/`, `src/app/fonts/`, código e lockfile. **Não versione `out/`, `.next/` ou `node_modules/`**: o Actions cria e envia `out/` como artefato do Pages. As configurações de Pages e as regras do environment precisam permitir o deploy da `main`.

## Dados preservados e atualização explícita

| Arquivo | Conteúdo |
|---|---|
| `data/resultados-6257.json` / `resultados-6258.json` | Respostas brutas completas do TSE: Brasil, 27 UFs e exterior, com data de captura e fonte |
| `public/fotos/<eleicao>/<sqcand>.jpeg` | Fotos dos candidatos, preservadas localmente |
| `data/snapshots-<eleicao>.jsonl` | Histórico gravado durante a apuração; não é substituído pela captura final |
| `data/eleitorado-<eleicao>.json` | Eleitorado por abrangência usado na projeção histórica |
| `data/referencia-2022-2t.json` | Série histórica nacional de 2022 para comparação |

Os arquivos capturados registram 100% das seções nas 29 abrangências, nos dois turnos. O indicador oficial `tf` é preservado literalmente: no arquivo do segundo turno, Roraima tem `tf=n` mesmo com todas as seções apuradas; a totalização nacional tem `tf=s`. O site não inventa a finalização regional ou a situação dos candidatos.

O replay inicia no resultado final e carrega `dados/replay.json` uma única vez. Cada posição usa o retrato de um ciclo gravado (as UFs podem chegar até 15 segundos após o registro nacional, como na projeção histórica). Nomes, fotos e partidos vêm do arquivo permanente, enquanto votos e percentuais vêm daquele snapshot. Situações oficiais de eleito não são antecipadas. A abstenção histórica aparece como “Não registrada”, porque o gravador não guardava esse campo; o resultado final mantém o valor oficial completo. O início do replay corresponde ao primeiro registro disponível, não ao início da apuração.

A comemoração usa os primeiros 90 segundos do [vídeo indicado](https://www.youtube.com/watch?v=r4L7BYH1JHA), obtidos com `~/Workspaces/Bin/yt-dlp` e convertidos localmente com `ffmpeg`, com fade nos dois segundos finais. Origem, recorte e SHA-256 estão em `data/audio-vitoria.json`. Pausar ou buscar reposiciona o áudio e o filme juntos; o botão de áudio reinicia ambos. Os marcos vêm dos votos gravados: primeira virada às 19:44:44, retomada de Lula às 20:24:14 e garantia matemática às 21:08:54. Os insights são diferenças entre registros, não uma atribuição causal da vitória a um estado.

O mapa do timelapse substitui a tabela estadual: o Brasil ocupa a área central, com territórios em setores e pizzas proporcionais aos votos válidos. Clique em uma UF para exibir uma única chamada com fotos, votos absolutos, percentuais e avanço da apuração; o detalhe acompanha o momento da timeline. No celular, o detalhe aparece abaixo do mapa. A visualização se ajusta à tela sem zoom, pan ou rolagem interna; um seletor também permite explorar estados pequenos e os votos do exterior.

Para capturar novamente dados completos e fotos, **somente quando desejar atualizar o arquivo**:

```bash
npm run archive
# Ou apenas uma eleição:
npm run archive -- 6258
```

Esse comando precisa de internet e substitui as capturas/fotos da eleição após validar todas as respostas e baixar suas fotos. Nunca é chamado pelo build ou pelo deploy. Exige finalização nacional, todas as seções contadas e totais consistentes. Revise o diff antes de versionar.

Depois de uma retotalização, confira também o último ponto dos snapshots: `npm test` e `verify:export` rejeitam divergências com o resultado arquivado. O histórico deve ser reconciliado com os novos dados de forma explícita. Corrigir arquivos publicados exige um novo build/deploy; não há atualização automática da fonte.

O gravador original continua disponível em `npm run recorder` para pesquisa/coleta. Ele escreve snapshots e não é parte da hospedagem estática. O TSE não disponibiliza a evolução completa retrospectivamente; preserve os históricos já gravados.

## Estrutura

| Caminho | Responsabilidade |
|---|---|
| `src/lib/static-data.ts` | Lê o arquivo local e calcula resultado, comparações e timelines no build |
| `src/lib/tse.ts` | Tipos e transformação das respostas brutas do TSE |
| `src/app/page.tsx` | Gera o HTML inicial com resultado e timeline nacional |
| `src/app/dados/timeline/[arquivo]/route.ts` | Exporta 29 arquivos JSON, sem servidor em produção |
| `src/lib/assets.ts` | Aplica o prefixo de hospedagem aos assets locais |
| `src/lib/replay.ts` | Restaura contagens históricas sem antecipar resultados ou modificar o arquivo final |
| `src/app/dados/replay.json/route.ts` | Exporta os snapshots compactos e os índices de cada ciclo para o slider |
| `src/components/` | Interações de mapa, placar, gráficos, tutorial e áudio no navegador |
| `scripts/archive-results.mjs` | Captura explícita dos resultados e fotos |
| `scripts/verify-export.mjs` | Confere HTML, URLs, timelines, fotos e demais recursos do artefato |

Detalhes da origem dos dados e das fórmulas em [docs/fontes-de-dados.md](docs/fontes-de-dados.md).
