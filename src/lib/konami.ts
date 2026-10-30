const SEQUENCIA = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

type TeclaKonami = Pick<KeyboardEvent, "key" | "repeat" | "ctrlKey" | "altKey" | "metaKey" | "isComposing">;

/** Guarda apenas as últimas teclas, permitindo recomeçar com setas sobrepostas. */
export function criarDetectorKonami() {
  let teclas: string[] = [];
  return (evento: TeclaKonami): boolean => {
    if (evento.ctrlKey || evento.altKey || evento.metaKey || evento.isComposing) {
      teclas = [];
      return false;
    }
    if (evento.repeat) return false;
    teclas = [...teclas, evento.key.length === 1 ? evento.key.toLowerCase() : evento.key].slice(-SEQUENCIA.length);
    if (!SEQUENCIA.every((tecla, indice) => teclas[indice] === tecla)) return false;
    teclas = [];
    return true;
  };
}
