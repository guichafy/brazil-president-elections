# Trilha e suspense conforme a liderança

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Aplicar o filtro profundo aprovado, suspense animado e a troca de trilha conforme o líder do quadro nacional exibido.

**Architecture:** O próprio quadro do timelapse determina o clima. A apresentação usa esse estado para alternar as camadas visuais; o player Web Audio reaproveita os buffers e troca de faixa somente quando muda o líder. As duas músicas são preparadas antes do início para evitar downloads durante a virada.

**Tech Stack:** Next.js 16.3.8, React 19, CSS Modules, Web Audio, Lottie existente.

**Spec:** Protótipo `docs/prototypes/lideranca.html`, filtro profundo aprovado e instruções do usuário de 26/10/2026: implementar na página, animação de pesadelo/suspense com Flávio na frente, trocar a música e retirar a identificação da faixa do rodapé.

## Global Constraints

- Manter os 90 segundos, controles, música durante a pausa e chamadas fixas da versão `2705a75`.
- Liderança pelos votos nacionais do quadro exibido; empate/ausência não provoca uma falsa virada.
- Usar o áudio já baixado do vídeo `7y4kJtkioFk` durante a liderança de Flávio e a trilha atual durante a de Lula.
- Filtro preto profundo, sem confetes ou Lula dançando durante suspense; texto e controles legíveis.
- Animação em CSS/SVG nativo, sem dependências novas, respeitando movimento reduzido.
- Preservar a alteração existente no texto de abertura de `AvisoVitoria.tsx`.

## Review Focus

- Navegar repetidamente para frente e para trás não pode sobrepor áudios ou reiniciar a mesma faixa.
- Fechar/reiniciar durante carregamento cancela pedidos antigos; falhas podem ser repetidas.
- Um empate mantém o último clima válido; não declarar um vencedor por ter a liderança.
- Pausa prolongada mantém a trilha em loop; fim/fechamento encerra todo áudio.
- Exportação com basePath, movimento reduzido, celular e janela de 1499 × 500 px mantêm recursos e controles funcionais.

### Task 1: Liderança e player

**Files:** `src/lib/timelapse.ts`, `src/lib/sons.ts`, `src/lib/replay-client.ts`, `public/sons/flavio-apreensao.mp3`, `data/audio-suspense.json`, `tests/victory-audio.test.mjs`, `tests/victory-start.test.mjs`, `tests/timelapse.test.mjs`.

- [x] Acrescentar teste de liderança por votos/empate, seleção de trilha, repetição da mesma liderança, loop e cancelamento de carregamento; observar falhas.
- [x] Implementar `liderApresentacao(nacional): "13" | "22" | null`, `prepararSonsApresentacao()` e `somApresentacao(lider)` usando o player atual. Preservar alertas curtos e transporte existentes.
- [x] Preparar as duas faixas no Play, escolher a inicial pelo histórico e manter a tentativa/cancelamento existentes.
- [x] Executar `npm test`; todas as verificações devem passar.

### Task 2: Apresentação e animação

**Files:** `src/components/TimelapseVitoria.tsx`, `src/components/AvisoVitoria.tsx`, `src/components/Apresentacao.module.css`, novo `src/components/AnimacaoSuspense.tsx`, `src/components/AnimacaoSuspense.module.css`, `src/components/MapaTimelapse.module.css`, `scripts/verify-export.mjs`.

- [x] Criar verificação de navegador cobrindo as duas viradas e a navegação manual, rodapé sem música, contraste dos dados, suspensão de celebração e sombras em movimento; observar o estado anterior falhar.
- [x] Marcar o clima no timelapse e atualizar trilha a cada mudança de liderança. Aplicar o tema profundo ao diálogo inteiro, com névoa, vinheta e sombras das mãos nas bordas; manter a comemoração existente para Lula.
- [x] Remover a identificação musical do rodapé; registrar a fonte apenas nos dados do projeto.
- [x] Verificar `npm test`, `npm run lint`, `npm run build`, `npm run verify:export`, navegação desktop/mobile e cancelamento do áudio.
- [x] Revisar o diff e disponibilizar a apresentação implementada para o usuário.

## Revisão e verificações

- 41 testes passaram; lint sem avisos; exportação validada com basePath de GitHub Pages.
- Revisão independente apontou áudio em loop no fim pausado e empate inicial atribuído a Lula. Ambos foram reproduzidos por testes falhando e corrigidos, seguidos de suíte completa verde.
- O teste de navegação concorrente também reproduziu e cobriu o retorno à faixa já tocando enquanto outra carrega.
- Navegador: liderança de Flávio em 34s, volta a Lula em 60s, retorno a 34s, cores da legenda e controle de timeline funcionais. Sombras nas camadas 1, mapa 2 e chamadas 3, preservando a leitura.
- Layout de 1499 × 500: diálogo com altura de conteúdo 500px, sem rolagem. Celular de 390px: página e diálogo com largura de 390px, sem overflow horizontal.
