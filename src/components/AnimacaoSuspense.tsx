import styles from "./AnimacaoSuspense.module.css";

/** Névoa, vinheta e mãos de sombra nas bordas; nunca interceptam a exploração do mapa. */
export default function AnimacaoSuspense({ className = "" }: { className?: string }) {
  return <div className={`${styles.cenario} ${className}`} data-suspense aria-hidden="true">
    <div className={styles.vinheta} />
    <div className={styles.nevoa} />
    <div className={styles.nevoaDistante} />
    {[false, true].map(direita => <svg key={String(direita)} className={`${styles.mao} ${direita ? styles.direita : styles.esquerda}`} viewBox="0 0 240 540" preserveAspectRatio="xMidYMax meet">
      <path d="M 0 540 L 0 427 C 24 403 41 375 45 344 L 46 273 C 46 255 36 230 30 212 C 22 188 28 177 36 188 L 68 246 L 71 146 C 71 127 83 127 85 147 L 95 232 L 109 92 C 111 72 123 76 122 98 L 121 231 L 143 121 C 147 101 159 106 154 128 L 145 247 L 171 177 C 179 157 191 163 182 184 L 170 281 C 169 308 157 335 147 361 L 119 417 L 115 540 Z" />
      <path className={styles.dobras} d="M 49 291 Q 99 273 147 292 M 70 319 Q 102 307 137 321 M 81 361 Q 92 331 89 302" />
    </svg>)}
  </div>;
}
