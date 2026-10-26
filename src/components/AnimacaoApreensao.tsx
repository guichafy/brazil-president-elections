import styles from "./AnimacaoApreensao.module.css";

/** Reação de apreensão para o cabeçalho; SVG leve que também tem um quadro estático acessível. */
export default function AnimacaoApreensao({className=""}:{className?:string}) {
  return <svg className={`${styles.ilustracao} ${className}`} viewBox="0 0 96 88" data-reacao="apreensao" aria-hidden="true">
    <g className={styles.nuvem} fill="#424242" stroke="#b8b8b8" strokeWidth="1.5">
      <path d="M24 24C16 24 15 13 23 11C23 1 39-1 44 8C51 0 65 4 66 12C77 10 83 24 72 27H25Z"/>
    </g>
    <g className={styles.rosto}>
      <ellipse cx="48" cy="53" rx="25" ry="27" fill="#929292" stroke="#dadada" strokeWidth="2"/>
      <path d="M28 38L40 33M56 33L68 38" fill="none" stroke="#242424" strokeWidth="3.5" strokeLinecap="round"/>
      <ellipse cx="36" cy="47" rx="7" ry="8" fill="#fafafa"/>
      <ellipse cx="60" cy="47" rx="7" ry="8" fill="#fafafa"/>
      <g className={styles.olhos} fill="#171717"><ellipse cx="38" cy="47" rx="2.7" ry="4"/><ellipse cx="58" cy="47" rx="2.7" ry="4"/></g>
      <path d="M37 66Q48 53 59 66" fill="none" stroke="#282828" strokeWidth="3" strokeLinecap="round"/>
      <path d="M47 50L45 57H50" fill="none" stroke="#5a5a5a" strokeWidth="1.5" strokeLinecap="round"/>
      <g fill="#f2f2f2"><path className={styles.lagrimaEsquerda} d="M30 52Q22 62 30 65Q38 62 30 52Z"/><path className={styles.lagrimaDireita} d="M66 52Q58 62 66 65Q74 62 66 52Z"/></g>
      <g fill="#bcbcbc" stroke="#363636" strokeWidth="1.5" strokeLinejoin="round">
        <path d="M14 79L14 55Q13 44 19 35Q22 30 25 33L23 45L28 36Q32 32 34 36L28 52L23 60L26 80Z"/>
        <path d="M82 79L82 55Q83 44 77 35Q74 30 71 33L73 45L68 36Q64 32 62 36L68 52L73 60L70 80Z"/>
      </g>
    </g>
    <g className={styles.aflicao} fill="none" stroke="#d8d8d8" strokeWidth="2" strokeLinecap="round"><path d="M9 33L6 39L9 45M87 33L90 39L87 45"/></g>
  </svg>;
}
