# Funcionamento do replay e do timelapse

Detalhes de implementação que não cabem no [README](../README.md). A origem dos dados e as fórmulas estão em [fontes-de-dados.md](fontes-de-dados.md).

## Fidelidade aos dados do TSE

Os arquivos capturados registram 100% das seções nas 29 abrangências (Brasil, 27 UFs e exterior), nos dois turnos. O indicador oficial `tf` é preservado literalmente: no arquivo do segundo turno, Roraima tem `tf=n` mesmo com todas as seções apuradas, enquanto a totalização nacional tem `tf=s`. O site não inventa a finalização regional nem a situação dos candidatos.

## Replay da apuração

- O replay inicia no resultado final e carrega `dados/replay.json` uma única vez.
- Cada posição usa o retrato de um ciclo gravado. As UFs podem chegar até 15 segundos após o registro nacional.
- Nomes, fotos e partidos vêm do arquivo permanente; votos e percentuais vêm do snapshot daquele momento.
- Situações oficiais de eleito não são antecipadas.
- A abstenção histórica aparece como “Não registrada”, porque o gravador não guardava esse campo. O resultado final mantém o valor oficial completo.
- O início do replay corresponde ao primeiro registro disponível, não ao início da apuração.
- A barra de percentual das urnas funciona como slider: placar, mapa e ponto no gráfico acompanham o momento escolhido, com navegação por teclado, Play/Pausar e retorno ao resultado final. O Play respeita a duração integral dos áudios de cada candidato nas viradas.

## Timelapse da vitória

- O timelapse dura 90 segundos, com pausa, busca e saltos de 10 s sincronizados à música.
- Pausar ou buscar reposiciona o áudio e o filme juntos; o botão de áudio reinicia ambos.
- Os marcos vêm dos votos gravados: primeira virada às 19:44:44, retomada de Lula às 20:24:14 e garantia matemática às 21:08:54.
- Os insights são diferenças entre registros, não uma atribuição causal da vitória a um estado.

### Mapa do timelapse

O Brasil ocupa a área central, com territórios em setores e pizzas proporcionais aos votos válidos. Ao clicar em uma UF, aparece uma única chamada com fotos, votos absolutos, percentuais e avanço da apuração; o detalhe acompanha o momento da timeline. No celular, o detalhe aparece abaixo do mapa. A visualização se ajusta à tela sem zoom, pan ou rolagem interna, e um seletor permite explorar estados pequenos e os votos do exterior.

## Áudios

As músicas da comemoração e do suspense foram obtidas com `yt-dlp` e convertidas localmente com `ffmpeg`. Origem, recorte e SHA-256 de cada arquivo estão em:

- `data/audio-vitoria.json`: primeiros 90 segundos do vídeo de origem, com fade nos dois segundos finais.
- `data/audio-suspense.json`: trilha usada enquanto Flávio Bolsonaro lidera.

## Atualização após retotalização

Depois de uma retotalização, confira o último ponto dos snapshots: `npm test` e `npm run verify:export` rejeitam divergências com o resultado arquivado. O histórico deve ser reconciliado com os novos dados de forma explícita. Corrigir arquivos publicados exige um novo build e deploy; não há atualização automática da fonte.
