/**
 * Prompts de Reflexão para o Conselho A.L.E.X
 */

export const REFLECTION_PROMPTS = {
  SECURITY_REVIEW: `
    Sua tarefa agora é o "Cross-Review de Segurança". 
    Analise as sugestões de PERFORMANCE e QUALIDADE feitas pelos seus colegas.
    Verifique se alguma otimização sugerida introduz brechas de segurança (ex: desabilitar validações para ganhar velocidade).
    Se encontrar um risco, levante um 'Security Veto'.
  `,
  PERFORMANCE_REVIEW: `
    Sua tarefa agora é o "Cross-Review de Performance".
    Analise as sugestões de QUALIDADE e SEGURANÇA.
    Verifique se as correções sugeridas podem causar gargalos significativos ou memory leaks.
  `,
  QUALITY_REVIEW: `
    Sua tarefa agora é o "Cross-Review de Qualidade".
    Verifique se as correções de SEGURANÇA ou PERFORMANCE ferem os princípios SOLID ou Clean Code.
  `
};
