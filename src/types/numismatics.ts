export interface NumismaticClassification {
  nome: string;
  pais: string;
  valor_face: string;
  ano: string;
  casa_moeda: string;
  material: string;
  peso_gramas: number;
  diametro_mm: number;
  bordo: string;
  estado_conservacao: string;
  valor_mercado_min_brl: number;
  valor_mercado_max_brl: number;
  alertas_variantes_raras: string[];
  alertas_conservacao: string[];
  curiosidades: string;
  observacoes: string;
  local_armazenamento: string;
  /** Índice (0 ou 1) da imagem enviada que a IA identificou autonomamente como o ANVERSO */
  indice_anverso?: number;
  /** Índice (0 ou 1, ou -1 caso apenas uma foto tenha sido enviada) que a IA identificou como o REVERSO */
  indice_reverso?: number;
}

/**
 * Representa um exemplar físico individual pertencente a uma Ficha Técnica de Referência.
 * Permite ter múltiplas moedas iguais (mesmo país/ano/valor/casa da moeda) com estados de
 * conservação, variantes confirmadas manualmente, locais de armazenamento e notas distintas.
 */
export interface NumismaticExemplar {
  id: string;
  created_at: string;
  updated_at: string;
  estado_conservacao: string;
  valor_mercado_min_brl: number;
  valor_mercado_max_brl: number;
  alertas_conservacao: string[];
  /** Lista de variantes raras (dentre as sugeridas na base da moeda) confirmadas manualmente pelo colecionador neste exemplar */
  variantes_confirmadas: string[];
  observacoes: string;
  local_armazenamento: string;
  anverso_image?: string;
  reverso_image?: string;
}

/**
 * Ficha Técnica de Referência (dados catalográficos compartilhados) + lista de exemplares físicos.
 * Mantém também os campos espelhados do exemplar principal para compatibilidade total.
 */
export interface NumismaticRecord
  extends Omit<
    NumismaticClassification,
    "indice_anverso" | "indice_reverso"
  > {
  id: string;
  created_at: string;
  updated_at: string;
  anverso_image?: string;
  reverso_image?: string;
  exemplares: NumismaticExemplar[];
}

export interface ClassifyImageInput {
  base64: string;
  mimeType: string;
}

export interface ClassifyRequestPayload {
  /** Lista unificada de imagens (1 ou 2 fotos sem ordem pré-definida; a IA identifica qual é Anverso e qual é Reverso) */
  imagens?: ClassifyImageInput[];
  /** Campos legados mantidos por retrocompatibilidade */
  anversoBase64?: string;
  anversoMimeType?: string;
  reversoBase64?: string;
  reversoMimeType?: string;
  observacoesIniciais?: string;
  localArmazenamentoInicial?: string;
}
