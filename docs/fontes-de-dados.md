# Fontes de dados: apuração em tempo real (TSE)

Resultado da investigação feita em 04/10/2026, dia do 1º turno.

## Resumo

O TSE publica a apuração como **arquivos JSON estáticos num CDN público**, em `https://resultados.tse.jus.br/oficial/...`. São os mesmos arquivos usados pelo app "Resultados" e pelos portais de notícia. Não precisa de autenticação nem de chave de API.

- **Não há CORS**: as respostas não trazem cabeçalhos `Access-Control-*`. O navegador não consegue ler esses arquivos direto, então a aplicação usa um proxy (`/api/presidente`).
- **Não há histórico**: cada arquivo é sobrescrito a cada nova totalização. Para ter a linha do tempo, gravamos snapshots nós mesmos (`scripts/recorder.mjs`).

## 1. Descobrir o código da eleição

`https://resultados.tse.jus.br/oficial/comum/config/ele-c.json`

Lista os pleitos e as eleições. Para 2026 (pleito `3220`, ciclo `ele2026`):

| Código | Eleição | 2º turno (`cdt2`) |
|---|---|---|
| `6257` | Eleição Ordinária Federal – 1º turno (Presidente) | `6258` |
| `6259` | Eleição Ordinária Estadual – 1º turno (Governador, Senador, Deputados) | `6260` |
| `6261` | Municipal (Conselheiro Distrital) | — |

Para o 2º turno, basta rodar com `TSE_ELEICAO=6258` (no app e no gravador).

O caminho dos demais arquivos segue os modelos declarados no próprio `ele-c.json` (campo `arq`):
`<base>/<ambiente>/<ciclo>/<cd_eleicao>/dados/<uf>`, com `base=https://resultados.tse.jus.br` e `ambiente=oficial`.

## 2. Resultado por abrangência (o arquivo principal)

```
https://resultados.tse.jus.br/oficial/ele2026/6257/dados/{abr}/{abr}-c0001-e006257-u.json
```

- `{abr}` pode ser `br` (Brasil), uma UF em minúsculas (`sp`, `mg`…) ou `zz` (Exterior).
- `c0001` é o cargo Presidente. Os outros cargos (na eleição 6259) usam outros códigos, por exemplo `c0003` para Governador. Confirme no `ele-c.json`.
- O sufixo `-u` indica o arquivo "unificado" (votos + totais). Os sufixos antigos `-r`, `-v` e `-f`, de 2022, retornam 404 em 2026.

Campos principais (todos os números vêm como **string**, com **vírgula decimal**):

| Campo | Significado |
|---|---|
| `dt`, `ht` | data/hora da totalização, **no fuso local da UF** (AC = UTC−5; AM, MT, MS, RO, RR = UTC−4). No exterior (`zz`) vem em fuso estrangeiro (ex.: `05/10 09:19`). **Vêm vazios** enquanto a abrangência não tem nenhuma seção totalizada (nesse caso usamos `dg`/`hg`) |
| `dg`, `hg` | data/hora de geração do arquivo, sempre no horário de Brasília |
| `tf` | totalização finalizada (`s`/`n`) |
| `s.ts` / `s.st` / `s.pstn` | seções totais / totalizadas / % totalizadas |
| `e.te` / `e.c` / `e.a` | eleitorado / comparecimento / abstenção |
| `e.esnt` | eleitorado das seções ainda **não** totalizadas (usado no cálculo de vitória garantida) |
| `v.vv` / `v.vb` / `v.tvn` | votos válidos / brancos / nulos (total) |
| `carg[0].agr[].par[].cand[]` | candidatos, agrupados por coligação (`agr`) e partido (`par`) |
| `cand.n`, `nmu`, `nm` | número, nome de urna, nome completo |
| `cand.vap`, `pvapn` | votos apurados, % dos válidos |
| `cand.e`, `cand.st` | eleito (`s`/`n`) e situação ("Eleito", "2º turno"…) |
| `cand.sqcand` | id do candidato, usado na foto |
| `cand.vs[]` | vice (`tp: "v"`) |

## 3. Andamento por UF

```
https://resultados.tse.jus.br/oficial/ele2026/6257/dados/br/br-e006257-ab.json
```

Traz o percentual de seções e municípios totalizados por UF. **Atenção**: o horário dele nem sempre bate com o do `-u.json`. A linha `br` mostrava `05/10/2026 09:19`, que é o horário local de alguma seção no exterior, enquanto o `-u` mostrava `04/10 17:40`. Por isso o app usa o `% apurado` que vem dentro de cada `-u.json`.

## 4. Vitória garantida por estado

Um estado é marcado como decidido (cor cheia + ✓ no mapa) quando:

```
votos(1º) − votos(2º)  >  e.esnt   (eleitorado das seções não totalizadas)
```

É o pior caso possível: todos os eleitores que ainda faltam comparecem e votam no 2º colocado, e mesmo assim a ordem não muda. O critério é deliberadamente conservador, porque a abstenção fica em torno de 20%, então costuma decidir um estado só com a apuração bem avançada. Quando `tf = "s"` (totalização finalizada), o estado é considerado decidido de qualquer forma.

## 5. Projeção para 100% das urnas

A projeção é calculada **estado a estado** a cada atualização (`src/lib/projecao.ts`). Extrapolar a curva nacional engana, porque o resultado nacional oscila conforme a ordem em que os estados apuram.

Em cada UF e no exterior:

```
votos válidos que faltam ≈ (te − est) × (c / est) × (vv / c)
                           eleitores     comparecimento   taxa de válidos
                           não apurados  observado        observada
```

Os votos que faltam são divididos entre os candidatos de duas formas:

- **Tendência** (método principal): usa a divisão dos votos apurados nos últimos 30 minutos naquela UF, calculada pelos snapshots do gravador. Quando a janela tem menos de 30 mil votos, ela é misturada à divisão acumulada.
- **Proporcional**: usa a divisão de todo o acumulado da UF. Serve para mostrar a faixa de incerteza.

**No 2º turno**, a divisão em cada UF parte do resultado final do 1º turno ali (último snapshot de `data/snapshots-6257.jsonl`, normalizado entre os dois finalistas). Ela é misturada aos votos já apurados com peso `vv / (vv + 30 mil)` (`PESO_REFERENCIA`), então perde força conforme a UF apura. Sem isso, no começo da noite as UFs ainda zeradas herdavam a divisão nacional, dominada pelo Norte e Nordeste. Enquanto menos de 20% dos votos projetados estão apurados, o painel diz "cedo para tendência".

A soma das UFs dá a projeção nacional. A linha do tempo recalcula a projeção em cada atualização nacional gravada, com o retrato das UFs naquele momento. O eleitorado fixo de cada abrangência fica em `data/eleitorado-<eleição>.json`, escrito pelo gravador.

É uma estimativa simples: supõe que o padrão recente de cada estado se mantém e não modela regiões dentro do estado.

## 6. Fotos

```
https://resultados.tse.jus.br/oficial/ele2026/6257/fotos/br/{sqcand}.jpeg
```

## 7. Municípios (para uma próxima etapa)

`https://resultados.tse.jus.br/oficial/ele2026/6257/config/mun-e006257-cm.json` lista os municípios de cada UF (código TSE `cd` + código IBGE `cdi`). O resultado por município deve seguir o padrão de 2024: `dados/{uf}/{uf}{cdMunicipio}-c0001-e006257-u.json`. Isso ainda não foi validado.

## 8. Como a aplicação usa isso

Desde a migração para SSG, o site usa um arquivo permanente, sem proxy ou consulta periódica em produção:

```
TSE CDN ──(captura manual: npm run archive)──> data/resultados-<eleição>.json + public/fotos/
Snapshots + eleitorado + referência 2022 + resultado completo ──(next build)──> out/
GitHub Pages ──> HTML inicial + assets locais + JSON de timeline por abrangência
```

As respostas brutas das 29 abrangências e as fotos dos dois turnos ficam versionadas. A captura exige 100% das seções e finalização nacional, mas preserva os indicadores regionais originais: Roraima tem `tf=n` no segundo turno mesmo com 100% apurado. Metadados como nomes, partido, coligação, vice e situação oficial vêm dos arquivos completos, não são reconstruídos a partir dos snapshots.

`src/lib/static-data.ts` executa as transformações e a projeção histórica no build. Os 29 históricos são exportados em `dados/timeline/<scope>.json`. O navegador recebe o resultado nacional e seu histórico no HTML e busca os demais históricos uma vez, conforme o usuário seleciona as abrangências. O mapa, comparações, tutorial, testes de áudio e comemoração continuam no navegador. A fonte Inter também é local.

O slider usa `dados/replay.json`, com snapshots compactos e índices por abrangência em cada ciclo nacional. Os retratos regionais usam a mesma tolerância de 15 segundos após o registro nacional adotada pela projeção histórica. A reprodução mantém as contagens gravadas e não antecipa situações oficiais de candidatos. Os snapshots não preservavam `e.a`, por isso a abstenção fica indisponível durante a reprodução; na posição final, o site restaura integralmente o arquivo oficial. A ajuda abre apenas pelo botão “Como funciona?”.

O fluxo original durante a apuração, mantido aqui como registro da coleta, era:

```
TSE CDN ──(a cada 30s)──> scripts/recorder.mjs ──> data/snapshots-6257.jsonl ──> /api/presidente/timeline
TSE CDN ──(cache 10s)───> /api/presidente (29 abrangências em paralelo) ──> navegador (polling 15s)
```

- O mapa usa a malha de UFs do IBGE (`servicodados.ibge.gov.br/api/v3/malhas/paises/BR?intrarregiao=UF&qualidade=minima`), salva em `src/data/brasil-ufs.json`.
- As cores dos partidos são as mesmas da apuração do g1 (variável CSS `--apc-party--clr`, extraída da página) e ficam em `src/lib/parties.ts`.

## 9. Série de 2022 para comparação (UOL)

`https://stc.eleicoes2026.uol.com/2026/historical/2022/br-c1-t2-ev.json` traz a evolução da apuração do 2º turno de 2022, usada pelo UOL na aba "2022 x 2026": `series` = `[% urnas apuradas, % Lula, % Bolsonaro]`, 211 pontos com duas casas decimais. Uma cópia fica em `data/referencia-2022-2t.json`. O UOL recebe os dados de 2026 por socket (`rtevent.uol.com`), e o caminho dos arquivos dele aparece no bundle `app.*.js` (`2026/{turno}turno/br/br-c1-ev.json`).
