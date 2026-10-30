import assert from "node:assert/strict";
import { test } from "node:test";
import { criarDetectorKonami } from "../src/lib/konami.ts";

const sequencia = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
const tecla = (key, extras = {}) => ({ key, repeat: false, ctrlKey: false, altKey: false, metaKey: false, isComposing: false, ...extras });

test("Konami só ativa na sequência completa e pode ser repetido após fechar", () => {
  const detectar = criarDetectorKonami();
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    for (const key of sequencia.slice(0, -1)) assert.equal(detectar(tecla(key)), false);
    assert.equal(detectar(tecla("a")), true);
    assert.equal(detectar(tecla("a")), false);
  }
});

test("Konami aceita B e A maiúsculos e um início sobreposto", () => {
  const detectar = criarDetectorKonami();
  assert.equal(detectar(tecla("ArrowUp")), false);
  const resultados = sequencia.map(key => detectar(tecla(key.length === 1 ? key.toUpperCase() : key)));
  assert.deepEqual(resultados, [false, false, false, false, false, false, false, false, false, true]);
});

test("uma tecla incorreta interrompe a sequência", () => {
  const detectar = criarDetectorKonami();
  sequencia.slice(0, 5).forEach(key => detectar(tecla(key)));
  detectar(tecla("x"));
  assert(sequencia.slice(5).every(key => !detectar(tecla(key))));
  assert.equal(sequencia.map(key => detectar(tecla(key))).at(-1), true);
});

test("segurar uma tecla não preenche passos adicionais do código", () => {
  const detectar = criarDetectorKonami();
  detectar(tecla("ArrowUp"));
  detectar(tecla("ArrowUp", { repeat: true }));
  assert(sequencia.slice(2).every(key => !detectar(tecla(key))));
});

test("atalhos do sistema e composição de texto interrompem o código", () => {
  for (const extra of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }, { isComposing: true }]) {
    const detectar = criarDetectorKonami();
    sequencia.slice(0, -1).forEach(key => detectar(tecla(key)));
    assert.equal(detectar(tecla("a", extra)), false);
    assert.equal(detectar(tecla("a")), false);
  }
});
