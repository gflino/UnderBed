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
  /** Unidade monetária / padrão monetário para agrupamento e filtro (ex: 'Cruzeiro', 'Réis', 'Real', 'Won Sul-Coreano') */
  unidade_monetaria?: string;
  /** Código de catálogo Krause/Pick visível na UI (ex: 'KM# 594' para moedas ou 'P# 102' para cédulas) */
  krause_id?: string;
  /** Código de referência Numista oculto na UI, mantido apenas no banco e backups JSON (ex: 'N# 4512') */
  numista_id?: string;
  /** Índice (0 ou 1) da imagem enviada que a IA identificou autonomamente como o ANVERSO */
  indice_anverso?: number;
  /** Índice (0 ou 1, ou -1 caso apenas uma foto tenha sido enviada) que a IA identificou como o REVERSO */
  indice_reverso?: number;
}

/**
 * Representa um exemplar físico individual pertencente a uma Ficha Técnica de Referência.
 * Permite ter múltiplas moedas iguais (mesmo país/ano/valor/KM#) com estados de
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
 * Utiliza exclusivamente:
 * - `id`: identificador único do registro (card)
 * - `krause_id`: código de catálogo visível (KM# / P#)
 * - `numista_id`: código de referência oculto (N#)
 * - `exemplares[].id`: identificador único de cada exemplar físico
 */
export interface NumismaticRecord {
  id: string;
  created_at: string;
  updated_at: string;
  nome: string;
  pais: string;
  valor_face: string;
  unidade_monetaria?: string;
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
  krause_id?: string;
  numista_id?: string;
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
  observacoesIniciais?: string;
  localArmazenamentoInicial?: string;
}
