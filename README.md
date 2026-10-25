# Apuração 2026 · Presidente

Acompanhamento em tempo real da apuração presidencial de 2026, feito em Next.js e TypeScript. Os dados vêm direto do CDN do TSE.

- **Mapa do Brasil por estado**: cada estado tem a cor do partido que lidera, em tom mais claro quando a disputa está apertada. Clique num candidato para colorir o mapa pela intensidade do voto nele. Clique num estado para ver o resultado local.
- **Lista de candidatos** com % dos válidos, votos, brancos, nulos e abstenção.
- **Linha do tempo**: % de cada candidato conforme as seções são totalizadas, com eixo X em % apurado ou em horário. Funciona para o Brasil e para cada UF.
- **Comparações** (Brasil, no 2º turno): abas "1ºT x 2ºT" e "2022 x 2026" na linha do tempo, com a apuração atual em linha sólida e a referência tracejada, pelo % de urnas apuradas, mais a diferença "no mesmo ponto da apuração".

Os detalhes da investigação dos dados estão em [docs/fontes-de-dados.md](docs/fontes-de-dados.md).

## Rodando

Use dois terminais:

```bash
npm run recorder
```

```bash
npm run dev
```

Depois abra http://localhost:3000.

O **gravador** (`scripts/recorder.mjs`) é o que alimenta a linha do tempo. O TSE só publica o retrato atual, então os pontos só existem a partir do momento em que ele estiver rodando. Os snapshots ficam em `data/snapshots-<eleição>.jsonl`.

### 1º × 2º turno

O padrão é o **2º turno** (`6258`). No 2º turno, a projeção usa o resultado final do 1º turno em cada UF (`data/snapshots-6257.jsonl`) como ponto de partida enquanto há poucos votos apurados. Para ver o 1º turno:

```bash
TSE_ELEICAO=6257 npm run dev
```

```bash
ELEICAO=6257 npm run recorder
```

`data/referencia-2022-2t.json` guarda a evolução da apuração do 2º turno de 2022 (% de urnas × % de votos), extraída do UOL, para a comparação 2022 × 2026.

## Estrutura

| Caminho | O que é |
|---|---|
| `src/app/api/presidente/route.ts` | proxy do TSE (sem CORS), cache de 10s |
| `src/app/api/presidente/timeline/route.ts` | série histórica a partir dos snapshots |
| `src/app/api/presidente/comparacao/route.ts` | séries de referência: 2º turno de 2022 e 1º turno de 2026 |
| `src/lib/tse.ts` | tipos brutos e parsing dos JSON do TSE |
| `src/lib/parties.ts` | cores dos partidos (paleta do g1) |
| `src/components/` | `Apuracao` (página), `BrazilMap`, `CandidateList`, `Timeline`, `Comparacao` |
| `src/data/brasil-ufs.json` | malha de UFs do IBGE |
| `scripts/recorder.mjs` | gravador de snapshots |
