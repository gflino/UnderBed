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
  /** Gravura / detalhamento artístico ou temático específico do exemplar físico (ex: 'Plano Piloto de Brasília', 'Dom Pedro II') */
  gravura?: string;
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
  /** Caixa delimitadora [ymin, xmin, ymax, xmax] (0 a 1000) da borda física da moeda no anverso */
  anverso_box?: [number, number, number, number];
  /** Ângulo inteiro (0, 90, 180 ou 270) no sentido horário necessário para deixar o anverso em pé */
  anverso_rotation?: number;
  /** Caixa delimitadora [ymin, xmin, ymax, xmax] (0 a 1000) da borda física da moeda no reverso */
  reverso_box?: [number, number, number, number];
  /** Ângulo inteiro (0, 90, 180 ou 270) no sentido horário necessário para deixar o reverso em pé */
  reverso_rotation?: number;
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
  /** Gravura / tema / efígie específica deste exemplar físico (ex: 'Plano Piloto de Brasília') */
  gravura?: string;
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
  /** Ângulo de rotação da foto do anverso em graus (0, 90, 180, 270) */
  anverso_rotation?: number;
  /** Ângulo de rotação da foto do reverso em graus (0, 90, 180, 270) */
  reverso_rotation?: number;
  /** Indica se as imagens deste exemplar já foram padronizadas (corte 1:1 600x600 centralizado + orientação em pé) */
  image_standardized?: boolean;
  /** Indica se o exemplar recebeu ajuste/corte manual pelo usuário */
  manual_crop?: boolean;
}

/**
 * Ficha Técnica de Referência (dados catalográficos compartilhados) + lista de exemplares físicos.
 * Utiliza:
 * - `id`: identificador único do registro (card)
 * - `friendly_code`: CUB - Código Universal de Base ([Tipo]-[PaísISO3]-[UM]-[Ano]-[Valor], ex: 'C-BRA-CRU-1977-50C')
 * - `krause_id`: código de catálogo Krause/Pick (ex: 'KM# 594' / 'P# 102')
 * - `numista_id`: código de referência Numista (ex: 'N# 4512')
 * - `exemplares[].id`: identificador único de cada exemplar físico
 */
export interface NumismaticRecord {
  id: string;
  friendly_code?: string;
  created_at: string;
  updated_at: string;
  nome: string;
  gravura?: string;
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
  anverso_rotation?: number;
  reverso_rotation?: number;
  /** Indica se as imagens deste registro/exemplares já foram padronizadas */
  image_standardized?: boolean;
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

export interface StandardizeImageRequest {
  anverso_image?: string;
  reverso_image?: string;
}

export interface StandardizeImageResponse {
  anverso_box: [number, number, number, number];
  anverso_rotation: number;
  reverso_box: [number, number, number, number];
  reverso_rotation: number;
}
