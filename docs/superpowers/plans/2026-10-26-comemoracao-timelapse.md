# Comemoração de 90 segundos com timelapse

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans para implementar nesta sessão.

**Goal:** Usar o áudio do vídeo indicado pelo usuário e exibir 90 segundos da evolução nacional e estadual até a vitória de Lula.

**Spec:** Solicitação do usuário em 26/10/2026: áudio https://www.youtube.com/watch?v=r4L7BYH1JHA via ~/Workspaces/Bin/yt-dlp; duração 1min30s; timelapse com as duas viradas, consolidação e insights de votação e apuração em cada estado.

**Architecture:** Reaproveitar o replay estático e o mapa existentes, sem novos serviços ou bibliotecas. Calcular marcos e agenda de 90 segundos a partir dos snapshots. O modal de vitória mostra placar nacional, mapa, contagens por UF e maiores entradas de votos no trecho; a animação existente de Lula acompanha a apresentação. Áudio local com 90 segundos (primeiros 90s do vídeo de 155s), encerrado junto da apresentação. Nenhum download durante build ou navegação.

**Tech Stack:** Next.js 16.3.8 / React 19 / TypeScript, Web Audio, yt-dlp local e ffmpeg instalado.

## Global Constraints

- Preservar o trabalho SSG e os snapshots existentes.
- Trilha local; apresentação e áudio com 90 segundos quando habilitado.
- Clique para liberar áudio reinicia a apresentação e o relógio juntos; fechar/Escape cancela som e temporizadores.
- Detectar as duas trocas de liderança por votos gravados, sem inventar eventos ou causalidade.
- Distinguir vitória matematicamente garantida de declaração oficial e resultado final.
- Exibir votos dos dois candidatos e percentual apurado em todas as 27 UFs e exterior, permitindo inspeção por estado.
- Manter prefixo Pages, modo sem som e movimento reduzido; conteúdo rolável em telas pequenas.

## Direção visual

Manter Inter local, verde da comemoração (#07401d), amarelo (#FFDF00), branco (#ffffff), vermelho de Lula (#D60828), azul do adversário (#272D97). Tratar o modal como uma transmissão da noite eleitoral: placar e relógio acima, mapa e lista estadual lado a lado, marcos e progresso abaixo. Texto alinhado à esquerda para os dados; fotos e confete subordinados à informação. Sem redesenhar o site ou criar novas imagens.

## Tasks

- [ ] Baixar a fonte com o yt-dlp indicado; gerar MP3 de 90s e registrar origem/recorte; verificar com ffprobe.
- [ ] Escrever testes dos marcos, agenda, conclusão em 90s e deltas estaduais; observar falha; implementar funções puras em src/lib/timelapse.ts.
- [ ] Integrar relógio, carregamento do replay e apresentação responsiva ao modal; sincronizar início/reinício do áudio e descarte no fechamento.
- [ ] Validar testes, lint, TypeScript e export Pages; verificar carregamento, teclado, áudio, duas viradas e desfecho no navegador.
- [ ] Revisar as mudanças e documentar origem do áudio e leitura dos insights.

## Review Focus

- Áudio bloqueado, download lento/falha, toque repetido e fechamento enquanto o áudio carrega.
- Relógio reiniciado quando o som começa; janela de 90s não depende de uma duração diferente do arquivo.
- Marcos e deltas calculados com os mesmos ciclos do replay; nenhum selo oficial antecipado.
- Lista estadual legível e acessível em celular; movimento reduzido preserva informação.
- Primeiro turno/ausência de viradas não pode gerar narrativa falsa.

## Ajuste do mapa solicitado pelo usuário

Remover a tabela estadual do timelapse. Ampliar o mapa, preencher os estados em setores de pizza e exibir em chamadas geográficas as fotos, votos absolutos e percentual de votos válidos de cada candidato. As chamadas ficam em duas margens ordenadas pela latitude, com linhas até cada UF, para evitar sobreposição em UFs pequenas. Manter o exterior separado da malha brasileira. No celular, mapa com pan/zoom e resumo acessível do estado selecionado. O restante do site mantém seu mapa existente.

## Revisão e progresso

- Áudio baixado com o executável indicado; ffprobe confirmou 90,000000 segundos. Origem e SHA-256 preservados em data/audio-vitoria.json.
- Marcos reais encontrados: Flávio 19:44:44 (13,65%); Lula 20:24:14 (47,24%); garantia matemática 21:08:54 (97,69%).
- Revisão independente identificou recuperação pelo botão do cabeçalho, falsa classificação de eleito no primeiro turno e cache de erro do áudio. Corrigidos; testes de classificação e retry RED→GREEN, recuperação de histórico em validação no navegador.
- Aguardando finalizar o novo mapa e validar a apresentação completa.

## Controles adicionais aprovados

- Mapa encaixado na altura/largura disponíveis sem scroll no zoom padrão; layout compacto no celular com detalhe por UF. Pan apenas após zoom explícito. Marcadores e rótulos não devem se sobrepor.
- Timelapse: pausa/retomada, saltos ±10s e slider de posição de 0 a 90s; áudio deve pausar, retomar e buscar a mesma posição. Aos 90s continua valendo a duração de mídia (pausas não contam).
- Timeline principal: Play/Pausar na barra existente. O usuário escolheu duração adaptada aos áudios completos. Segmento inicial sem som, áudio de Flávio na primeira virada e áudio de Lula na segunda; cada segmento dura pelo menos a faixa tocada. Não sobrepor músicas; arrastar a barra interrompe reprodução automática. Abrir a comemoração ou ajuda cancela o Play principal.

- Revisão dos controles: cancelamento de áudio ao abrir ajuda e mute imediato corrigidos. Testes cobrem posições de áudio, retomada, duração dos segmentos e marcos; lint e export novamente exigidos antes do push.
- CI/CD autorizado pelo usuário para guichafy/brazil-president-elections. Source GitHub Actions e HTTPS configurados pela interface Chrome; repositório inicialmente vazio e main padrão. Publicar código e dados, sem out/node_modules, e verificar o deploy público.
