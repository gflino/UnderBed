import {
  NumismaticClassification,
  NumismaticExemplar,
  NumismaticRecord,
} from "@/types/numismatics";

const STORAGE_KEY = "underbed:collection:v2";
const LEGACY_STORAGE_KEY = "numisvault:collection:v1";

/**
 * Estrutura relacional pronta para migração ao Supabase:
 * - Tabela 1: `public.numismatic_references` (dados base compartilhados: nome, pais, valor_face, ano, casa_moeda, material, peso_gramas, diametro_mm, bordo, alertas_variantes_raras, curiosidades)
 * - Tabela 2: `public.numismatic_exemplars` (exemplares físicos: reference_id, estado_conservacao, valor_mercado_min_brl, valor_mercado_max_brl, alertas_conservacao, variantes_confirmadas, local_armazenamento, observacoes, anverso_image, reverso_image)
 */
export interface CollectionRepository {
  list(): Promise<NumismaticRecord[]>;
  getById(id: string): Promise<NumismaticRecord | null>;
  create(
    data: NumismaticClassification,
    images?: { anverso?: string; reverso?: string }
  ): Promise<{ record: NumismaticRecord; exemplarId: string; isNewExemplarOnExistingRef: boolean }>;
  addExemplar(
    recordId: string,
    exemplarData: {
      estado_conservacao: string;
      valor_mercado_min_brl: number;
      valor_mercado_max_brl: number;
      local_armazenamento: string;
      observacoes: string;
      alertas_conservacao?: string[];
      variantes_confirmadas?: string[];
      anverso_image?: string;
      reverso_image?: string;
    }
  ): Promise<{ record: NumismaticRecord; exemplarId: string } | null>;
  updateExemplar(
    recordId: string,
    exemplarId: string,
    patch: Partial<
      Pick<
        NumismaticExemplar,
        | "estado_conservacao"
        | "valor_mercado_min_brl"
        | "valor_mercado_max_brl"
        | "local_armazenamento"
        | "observacoes"
        | "variantes_confirmadas"
        | "alertas_conservacao"
      >
    >
  ): Promise<NumismaticRecord | null>;
  removeExemplar(
    recordId: string,
    exemplarId: string
  ): Promise<NumismaticRecord | null>;
  remove(id: string): Promise<void>;
  exportJson(): Promise<string>;
}

function generateId(prefix: string): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeIdentityKey(item: {
  pais: string;
  valor_face: string;
  ano: string;
  casa_moeda: string;
  nome: string;
}): string {
  const clean = (s: string) =>
    (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  return `${clean(item.pais)}|${clean(item.valor_face)}|${clean(item.ano)}|${clean(item.casa_moeda || item.nome)}`;
}

function syncRecordWithPrimaryExemplar(
  record: NumismaticRecord
): NumismaticRecord {
  const sanitized = { ...(record as NumismaticRecord & { justificativa_lados?: unknown }) };
  delete sanitized.justificativa_lados;
  delete sanitized.indice_anverso;
  delete sanitized.indice_reverso;

  const primary = sanitized.exemplares[0];
  if (!primary) return sanitized;
  return {
    ...sanitized,
    estado_conservacao: primary.estado_conservacao,
    valor_mercado_min_brl: primary.valor_mercado_min_brl,
    valor_mercado_max_brl: primary.valor_mercado_max_brl,
    alertas_conservacao: primary.alertas_conservacao,
    observacoes: primary.observacoes,
    local_armazenamento: primary.local_armazenamento,
    anverso_image: primary.anverso_image ?? sanitized.anverso_image,
    reverso_image: primary.reverso_image ?? sanitized.reverso_image,
  };
}

function ensureExemplaresArray(rawRecord: NumismaticRecord): NumismaticRecord {
  if (Array.isArray(rawRecord.exemplares) && rawRecord.exemplares.length > 0) {
    return {
      ...rawRecord,
      exemplares: rawRecord.exemplares.map((ex) => ({
        ...ex,
        variantes_confirmadas: Array.isArray(ex.variantes_confirmadas)
          ? ex.variantes_confirmadas
          : [],
        alertas_conservacao: Array.isArray(ex.alertas_conservacao)
          ? ex.alertas_conservacao
          : rawRecord.alertas_conservacao || [],
      })),
    };
  }

  const migratedExemplar: NumismaticExemplar = {
    id: generateId("ex"),
    created_at: rawRecord.created_at || new Date().toISOString(),
    updated_at: rawRecord.updated_at || new Date().toISOString(),
    estado_conservacao: rawRecord.estado_conservacao || "MBC",
    valor_mercado_min_brl: Number(rawRecord.valor_mercado_min_brl) || 0,
    valor_mercado_max_brl: Number(rawRecord.valor_mercado_max_brl) || 0,
    alertas_conservacao: Array.isArray(rawRecord.alertas_conservacao)
      ? rawRecord.alertas_conservacao
      : [],
    variantes_confirmadas: [],
    observacoes: rawRecord.observacoes || "",
    local_armazenamento: rawRecord.local_armazenamento || "",
    anverso_image: rawRecord.anverso_image,
    reverso_image: rawRecord.reverso_image,
  };

  return {
    ...rawRecord,
    exemplares: [migratedExemplar],
  };
}

function readLocalRecords(): NumismaticRecord[] {
  if (typeof window === "undefined") return [];
  try {
    let raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        raw = legacy;
        window.localStorage.setItem(STORAGE_KEY, legacy);
      }
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) =>
      syncRecordWithPrimaryExemplar(ensureExemplaresArray(item))
    );
  } catch (err) {
    console.error("Erro ao ler acervo UnderBed do localStorage:", err);
    return [];
  }
}

function writeLocalRecords(records: NumismaticRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (err) {
    console.error("Erro ao salvar acervo UnderBed no localStorage:", err);
    throw new Error(
      "Limite de armazenamento local atingido. Considere exportar seu backup ou remover itens antigos."
    );
  }
}

export const numismaticRepository: CollectionRepository = {
  async list(): Promise<NumismaticRecord[]> {
    const items = readLocalRecords();
    return items.sort(
      (a, b) =>
        new Date(b.updated_at || b.created_at).getTime() -
        new Date(a.updated_at || a.created_at).getTime()
    );
  },

  async getById(id: string): Promise<NumismaticRecord | null> {
    const items = readLocalRecords();
    return items.find((item) => item.id === id) ?? null;
  },

  async create(
    data: NumismaticClassification,
    images?: { anverso?: string; reverso?: string }
  ): Promise<{
    record: NumismaticRecord;
    exemplarId: string;
    isNewExemplarOnExistingRef: boolean;
  }> {
    const items = readLocalRecords();
    const now = new Date().toISOString();
    const newExemplar: NumismaticExemplar = {
      id: generateId("ex"),
      created_at: now,
      updated_at: now,
      estado_conservacao: data.estado_conservacao,
      valor_mercado_min_brl: data.valor_mercado_min_brl,
      valor_mercado_max_brl: data.valor_mercado_max_brl,
      alertas_conservacao: data.alertas_conservacao || [],
      variantes_confirmadas: [],
      observacoes: data.observacoes || "",
      local_armazenamento: data.local_armazenamento || "",
      anverso_image: images?.anverso,
      reverso_image: images?.reverso,
    };

    const incomingKey = normalizeIdentityKey(data);
    const existingIndex = items.findIndex(
      (existing) => normalizeIdentityKey(existing) === incomingKey
    );

    if (existingIndex !== -1) {
      const existing = items[existingIndex];
      const mergedVariants = Array.from(
        new Set([
          ...(existing.alertas_variantes_raras || []),
          ...(data.alertas_variantes_raras || []),
        ])
      );

      const updatedRecord = syncRecordWithPrimaryExemplar({
        ...existing,
        updated_at: now,
        alertas_variantes_raras: mergedVariants,
        anverso_image: existing.anverso_image || images?.anverso,
        reverso_image: existing.reverso_image || images?.reverso,
        exemplares: [newExemplar, ...existing.exemplares],
      });

      items[existingIndex] = updatedRecord;
      writeLocalRecords(items);
      return {
        record: updatedRecord,
        exemplarId: newExemplar.id,
        isNewExemplarOnExistingRef: true,
      };
    }

    const record: NumismaticRecord = syncRecordWithPrimaryExemplar({
      ...data,
      id: generateId("ref"),
      created_at: now,
      updated_at: now,
      anverso_image: images?.anverso,
      reverso_image: images?.reverso,
      exemplares: [newExemplar],
    });

    writeLocalRecords([record, ...items]);
    return {
      record,
      exemplarId: newExemplar.id,
      isNewExemplarOnExistingRef: false,
    };
  },

  async addExemplar(
    recordId: string,
    exemplarData
  ): Promise<{ record: NumismaticRecord; exemplarId: string } | null> {
    const items = readLocalRecords();
    const index = items.findIndex((item) => item.id === recordId);
    if (index === -1) return null;

    const now = new Date().toISOString();
    const newExemplar: NumismaticExemplar = {
      id: generateId("ex"),
      created_at: now,
      updated_at: now,
      estado_conservacao: exemplarData.estado_conservacao,
      valor_mercado_min_brl: exemplarData.valor_mercado_min_brl,
      valor_mercado_max_brl: exemplarData.valor_mercado_max_brl,
      alertas_conservacao:
        exemplarData.alertas_conservacao ??
        items[index].alertas_conservacao ??
        [],
      variantes_confirmadas: exemplarData.variantes_confirmadas ?? [],
      observacoes: exemplarData.observacoes,
      local_armazenamento: exemplarData.local_armazenamento,
      anverso_image: exemplarData.anverso_image,
      reverso_image: exemplarData.reverso_image,
    };

    const updated = syncRecordWithPrimaryExemplar({
      ...items[index],
      updated_at: now,
      exemplares: [...items[index].exemplares, newExemplar],
    });

    items[index] = updated;
    writeLocalRecords(items);
    return { record: updated, exemplarId: newExemplar.id };
  },

  async updateExemplar(
    recordId: string,
    exemplarId: string,
    patch
  ): Promise<NumismaticRecord | null> {
    const items = readLocalRecords();
    const index = items.findIndex((item) => item.id === recordId);
    if (index === -1) return null;

    const now = new Date().toISOString();
    const updatedExemplares = items[index].exemplares.map((ex) =>
      ex.id === exemplarId
        ? {
            ...ex,
            ...patch,
            updated_at: now,
          }
        : ex
    );

    const updated = syncRecordWithPrimaryExemplar({
      ...items[index],
      updated_at: now,
      exemplares: updatedExemplares,
    });

    items[index] = updated;
    writeLocalRecords(items);
    return updated;
  },

  async removeExemplar(
    recordId: string,
    exemplarId: string
  ): Promise<NumismaticRecord | null> {
    const items = readLocalRecords();
    const index = items.findIndex((item) => item.id === recordId);
    if (index === -1) return null;

    const remaining = items[index].exemplares.filter(
      (ex) => ex.id !== exemplarId
    );

    if (remaining.length === 0) {
      writeLocalRecords(items.filter((item) => item.id !== recordId));
      return null;
    }

    const updated = syncRecordWithPrimaryExemplar({
      ...items[index],
      updated_at: new Date().toISOString(),
      exemplares: remaining,
    });

    items[index] = updated;
    writeLocalRecords(items);
    return updated;
  },

  async remove(id: string): Promise<void> {
    const items = readLocalRecords();
    writeLocalRecords(items.filter((item) => item.id !== id));
  },

  async exportJson(): Promise<string> {
    const items = await this.list();
    return JSON.stringify(items, null, 2);
  },
};
