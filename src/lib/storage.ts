import {
  NumismaticClassification,
  NumismaticExemplar,
  NumismaticRecord,
} from "@/types/numismatics";
import { autoCropAndCompressCoin, base64ToBlob } from "@/lib/image-utils";

const STORAGE_KEY = "underbed:collection:v2";
const CROP_MIGRATION_KEY = "underbed_crop_migration_v3";

export interface CollectionRepository {
  list(): Promise<NumismaticRecord[]>;
  getById(id: string): Promise<NumismaticRecord | null>;
  create(
    data: NumismaticClassification,
    images?: { anverso?: string; reverso?: string }
  ): Promise<{
    record: NumismaticRecord;
    exemplarId: string;
    isNewExemplarOnExistingRef: boolean;
  }>;
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
    > & {
      alertas_variantes_raras?: string[];
    }
  ): Promise<NumismaticRecord | null>;
  removeExemplar(
    recordId: string,
    exemplarId: string
  ): Promise<NumismaticRecord | null>;
  remove(id: string): Promise<void>;
  exportJson(): Promise<string>;
  importCollectionData(
    jsonString: string,
    mode: "merge" | "overwrite"
  ): Promise<{ total: number; added: number; mergedExemplars: number }>;
}

function generateId(prefix: string): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const normalize = (str?: string) =>
  (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export const getCoinTypeKey = (record: Partial<NumismaticRecord>): string => {
  const cleanYear = String(record.ano ?? "").trim();
  const cleanKrause = normalize(record.krause_id).replace(/[^a-z0-9]/g, "");
  if (
    cleanKrause &&
    cleanKrause !== "na" &&
    cleanKrause !== "desconhecido" &&
    cleanKrause !== "none"
  ) {
    return `km_${cleanKrause}_${cleanYear}`;
  }
  const cleanPais = normalize(record.pais);
  const cleanUM = normalize(record.unidade_monetaria).replace(/\s+/g, "");
  return `fb_${cleanPais}_${cleanYear}_${cleanUM}`;
};

function sanitizeExemplar(
  rawEx: Partial<NumismaticExemplar> | undefined,
  fallbackRecord?: Partial<NumismaticRecord>
): NumismaticExemplar {
  const now = new Date().toISOString();
  return {
    id:
      typeof rawEx?.id === "string" && rawEx.id.trim()
        ? rawEx.id.trim()
        : generateId("ex"),
    created_at: rawEx?.created_at || fallbackRecord?.created_at || now,
    updated_at: rawEx?.updated_at || fallbackRecord?.updated_at || now,
    estado_conservacao:
      rawEx?.estado_conservacao || fallbackRecord?.estado_conservacao || "MBC",
    valor_mercado_min_brl:
      Number(
        rawEx?.valor_mercado_min_brl ?? fallbackRecord?.valor_mercado_min_brl
      ) || 0,
    valor_mercado_max_brl:
      Number(
        rawEx?.valor_mercado_max_brl ?? fallbackRecord?.valor_mercado_max_brl
      ) || 0,
    alertas_conservacao: Array.isArray(rawEx?.alertas_conservacao)
      ? rawEx.alertas_conservacao.map(String)
      : Array.isArray(fallbackRecord?.alertas_conservacao)
        ? fallbackRecord.alertas_conservacao.map(String)
        : [],
    variantes_confirmadas: Array.isArray(rawEx?.variantes_confirmadas)
      ? rawEx.variantes_confirmadas.map(String)
      : [],
    observacoes:
      typeof rawEx?.observacoes === "string"
        ? rawEx.observacoes
        : fallbackRecord?.observacoes || "",
    local_armazenamento:
      typeof rawEx?.local_armazenamento === "string"
        ? rawEx.local_armazenamento
        : fallbackRecord?.local_armazenamento || "",
    anverso_image: rawEx?.anverso_image ?? fallbackRecord?.anverso_image,
    reverso_image: rawEx?.reverso_image ?? fallbackRecord?.reverso_image,
  };
}

function ensureExemplaresArray(rawRecord: Partial<NumismaticRecord>): NumismaticExemplar[] {
  if (Array.isArray(rawRecord.exemplares) && rawRecord.exemplares.length > 0) {
    return rawRecord.exemplares.map((ex) => sanitizeExemplar(ex, rawRecord));
  }
  return [sanitizeExemplar(undefined, rawRecord)];
}

/**
 * Sanitiza estritamente o registro mantendo apenas o `id` principal, `krause_id`,
 * `numista_id` e os `exemplares[].id`, removendo quaisquer IDs ou campos legados.
 */
function syncRecordWithPrimaryExemplar(
  rawRecord: Partial<NumismaticRecord>
): NumismaticRecord {
  const now = new Date().toISOString();
  const exemplares = ensureExemplaresArray(rawRecord);
  const primary = exemplares[0];

  const krauseId =
    typeof rawRecord.krause_id === "string" && rawRecord.krause_id.trim()
      ? rawRecord.krause_id.trim()
      : undefined;
  const numistaId =
    typeof rawRecord.numista_id === "string" && rawRecord.numista_id.trim()
      ? rawRecord.numista_id.trim()
      : undefined;
  const unidadeMonetaria =
    typeof rawRecord.unidade_monetaria === "string" &&
    rawRecord.unidade_monetaria.trim()
      ? rawRecord.unidade_monetaria.trim()
      : undefined;

  return {
    id:
      typeof rawRecord.id === "string" && rawRecord.id.trim()
        ? rawRecord.id.trim()
        : generateId("ref"),
    created_at: rawRecord.created_at || now,
    updated_at: rawRecord.updated_at || now,
    nome: String(rawRecord.nome || "").trim(),
    pais: String(rawRecord.pais || "").trim(),
    valor_face: String(rawRecord.valor_face || "").trim(),
    ...(unidadeMonetaria ? { unidade_monetaria: unidadeMonetaria } : {}),
    ano: String(rawRecord.ano ?? "").trim(),
    casa_moeda: String(rawRecord.casa_moeda || "").trim(),
    material: String(rawRecord.material || "").trim(),
    peso_gramas: Number(rawRecord.peso_gramas) || 0,
    diametro_mm: Number(rawRecord.diametro_mm) || 0,
    bordo: String(rawRecord.bordo || "").trim(),
    estado_conservacao:
      primary?.estado_conservacao || rawRecord.estado_conservacao || "MBC",
    valor_mercado_min_brl:
      primary?.valor_mercado_min_brl ??
      (Number(rawRecord.valor_mercado_min_brl) || 0),
    valor_mercado_max_brl:
      primary?.valor_mercado_max_brl ??
      (Number(rawRecord.valor_mercado_max_brl) || 0),
    alertas_variantes_raras: Array.isArray(rawRecord.alertas_variantes_raras)
      ? rawRecord.alertas_variantes_raras.map(String)
      : [],
    alertas_conservacao:
      primary?.alertas_conservacao ??
      (Array.isArray(rawRecord.alertas_conservacao)
        ? rawRecord.alertas_conservacao.map(String)
        : []),
    curiosidades: String(rawRecord.curiosidades || ""),
    observacoes: primary?.observacoes ?? String(rawRecord.observacoes || ""),
    local_armazenamento:
      primary?.local_armazenamento ??
      String(rawRecord.local_armazenamento || ""),
    ...(krauseId ? { krause_id: krauseId } : {}),
    ...(numistaId ? { numista_id: numistaId } : {}),
    anverso_image: primary?.anverso_image ?? rawRecord.anverso_image,
    reverso_image: primary?.reverso_image ?? rawRecord.reverso_image,
    exemplares,
  };
}

function readLocalRecords(): NumismaticRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => syncRecordWithPrimaryExemplar(item));
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

/**
 * Rotina de otimização automática do banco local com controle de migração `'underbed_crop_migration_v3'`.
 */
export async function autoOptimizeDatabaseImages(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const migrationState = window.localStorage.getItem(CROP_MIGRATION_KEY);
  const forceAllImages = migrationState !== "done";

  const records = readLocalRecords();
  if (records.length === 0) {
    window.localStorage.setItem(CROP_MIGRATION_KEY, "done");
    return false;
  }

  const shouldProcessImage = (img?: string): img is string => {
    if (!img || typeof img !== "string" || !img.startsWith("data:image/")) {
      return false;
    }
    if (forceAllImages) {
      return true;
    }
    return (
      img.startsWith("data:image/jpeg") ||
      img.startsWith("data:image/jpg") ||
      img.startsWith("data:image/png")
    );
  };

  let anyModified = false;

  for (const record of records) {
    let recordChanged = false;

    if (shouldProcessImage(record.anverso_image)) {
      try {
        const blob = base64ToBlob(record.anverso_image);
        record.anverso_image = await autoCropAndCompressCoin(blob);
        recordChanged = true;
      } catch (err) {
        console.warn("Falha ao recortar record.anverso_image:", err);
      }
    }

    if (shouldProcessImage(record.reverso_image)) {
      try {
        const blob = base64ToBlob(record.reverso_image);
        record.reverso_image = await autoCropAndCompressCoin(blob);
        recordChanged = true;
      } catch (err) {
        console.warn("Falha ao recortar record.reverso_image:", err);
      }
    }

    if (Array.isArray(record.exemplares)) {
      for (const exemplar of record.exemplares) {
        if (shouldProcessImage(exemplar.anverso_image)) {
          try {
            const blob = base64ToBlob(exemplar.anverso_image);
            exemplar.anverso_image = await autoCropAndCompressCoin(blob);
            recordChanged = true;
          } catch (err) {
            console.warn("Falha ao recortar exemplar.anverso_image:", err);
          }
        }

        if (shouldProcessImage(exemplar.reverso_image)) {
          try {
            const blob = base64ToBlob(exemplar.reverso_image);
            exemplar.reverso_image = await autoCropAndCompressCoin(blob);
            recordChanged = true;
          } catch (err) {
            console.warn("Falha ao recortar exemplar.reverso_image:", err);
          }
        }
      }
    }

    if (recordChanged) {
      anyModified = true;
      const synced = syncRecordWithPrimaryExemplar(record);
      Object.assign(record, synced);
    }
  }

  if (anyModified) {
    writeLocalRecords(records);
  }

  window.localStorage.setItem(CROP_MIGRATION_KEY, "done");
  return anyModified;
}

/**
 * Preenche retroativamente `krause_id` (KM# / P#), `numista_id` (N#) e `unidade_monetaria`
 * para todas as moedas salvas localmente que ainda não possuem esses campos preenchidos.
 */
export async function autoBackfillCatalogIds(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const records = readLocalRecords();
  const pending = records.filter(
    (r) =>
      !r.krause_id?.trim() ||
      !r.numista_id?.trim() ||
      !r.unidade_monetaria?.trim()
  );

  if (pending.length === 0) {
    return false;
  }

  try {
    const payload = pending.map((r) => ({
      id: r.id,
      nome: r.nome,
      pais: r.pais,
      ano: r.ano,
      valor_facial: r.valor_face,
      material: r.material,
    }));

    const response = await fetch("/api/backfill-ids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return false;
    }

    const results = (await response.json()) as Array<{
      id: string;
      krause_id: string;
      numista_id: string;
      unidade_monetaria: string;
    }>;

    if (!Array.isArray(results) || results.length === 0) {
      return false;
    }

    const mapById = new Map(results.map((item) => [item.id, item]));
    let updatedAny = false;

    const latestRecords = readLocalRecords();
    for (const rec of latestRecords) {
      const found = mapById.get(rec.id);
      if (found) {
        if (!rec.krause_id?.trim() && found.krause_id) {
          rec.krause_id = found.krause_id.trim();
          updatedAny = true;
        }
        if (!rec.numista_id?.trim() && found.numista_id) {
          rec.numista_id = found.numista_id.trim();
          updatedAny = true;
        }
        if (!rec.unidade_monetaria?.trim() && found.unidade_monetaria) {
          rec.unidade_monetaria = found.unidade_monetaria.trim();
          updatedAny = true;
        }
      }
    }

    if (updatedAny) {
      writeLocalRecords(consolidateRecordsByTypeKey(latestRecords).records);
    }

    return updatedAny;
  } catch (err) {
    console.warn("Falha no backfill automático de KM#/Numista/UM:", err);
    return false;
  }
}

/**
 * Une fichas que compartilham a mesma chave `getCoinTypeKey` (ex: mesmo KM# + ano)
 * agrupando seus exemplares dentro de um único card.
 */
function consolidateRecordsByTypeKey(records: NumismaticRecord[]): {
  records: NumismaticRecord[];
  mergedExemplars: number;
} {
  const result: NumismaticRecord[] = [];
  let mergedExemplars = 0;

  for (const incoming of records) {
    const incomingKey = getCoinTypeKey(incoming);
    const matchIndex = result.findIndex(
      (existing) => getCoinTypeKey(existing) === incomingKey
    );

    if (matchIndex === -1) {
      result.push(syncRecordWithPrimaryExemplar(incoming));
    } else {
      const existing = result[matchIndex];
      const existingExemplarIds = new Set(
        (existing.exemplares || []).map((ex) => ex.id)
      );

      const newExemplaresToAdd: NumismaticExemplar[] = [];
      for (const incEx of incoming.exemplares || []) {
        const sanitizedEx = sanitizeExemplar(incEx, incoming);
        // Se forem dois cards separados sendo unificados, garante um ID único caso haja colisão
        const finalId =
          existing.id !== incoming.id && existingExemplarIds.has(sanitizedEx.id)
            ? generateId("ex")
            : sanitizedEx.id;

        if (!existingExemplarIds.has(finalId)) {
          newExemplaresToAdd.push({ ...sanitizedEx, id: finalId });
          existingExemplarIds.add(finalId);
          mergedExemplars++;
        }
      }

      if (
        !existing.unidade_monetaria?.trim() &&
        incoming.unidade_monetaria?.trim()
      ) {
        existing.unidade_monetaria = incoming.unidade_monetaria.trim();
      }
      if (!existing.krause_id?.trim() && incoming.krause_id?.trim()) {
        existing.krause_id = incoming.krause_id.trim();
      }
      if (!existing.numista_id?.trim() && incoming.numista_id?.trim()) {
        existing.numista_id = incoming.numista_id.trim();
      }

      const mergedVariants = Array.from(
        new Set([
          ...(existing.alertas_variantes_raras || []),
          ...(incoming.alertas_variantes_raras || []),
        ])
      );

      result[matchIndex] = syncRecordWithPrimaryExemplar({
        ...existing,
        updated_at: new Date().toISOString(),
        alertas_variantes_raras: mergedVariants,
        anverso_image: existing.anverso_image || incoming.anverso_image,
        reverso_image: existing.reverso_image || incoming.reverso_image,
        exemplares: [...existing.exemplares, ...newExemplaresToAdd],
      });
    }
  }

  return { records: result, mergedExemplars };
}

/**
 * Varre o banco local atual e agrupa automaticamente quaisquer cards duplicados
 * que tenham a mesma chave (`getCoinTypeKey`: mesmo Krause ID e Ano), limpando a base atual.
 */
export function deduplicateLocalCollection(): NumismaticRecord[] {
  if (typeof window === "undefined") return [];
  const current = readLocalRecords();
  if (current.length === 0) return [];

  const { records: deduplicated, mergedExemplars } =
    consolidateRecordsByTypeKey(current);

  if (deduplicated.length !== current.length || mergedExemplars > 0) {
    writeLocalRecords(deduplicated);
  } else {
    // Persiste também a sanitização estrita de IDs legados
    writeLocalRecords(deduplicated);
  }

  return deduplicated;
}

/**
 * Valida uma string JSON de backup e retorna os registros normalizados
 */
export function parseAndValidateBackupJson(
  jsonString: string
): NumismaticRecord[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error("O arquivo selecionado não é um JSON válido.");
  }

  const rawList = Array.isArray(parsed)
    ? parsed
    : parsed &&
        typeof parsed === "object" &&
        Array.isArray((parsed as { records?: unknown[] }).records)
      ? (parsed as { records: unknown[] }).records
      : null;

  if (!rawList) {
    throw new Error(
      "O arquivo JSON não contém uma lista válida de peças numismáticas."
    );
  }

  const validRecords: NumismaticRecord[] = [];
  for (const rawItem of rawList) {
    if (
      !rawItem ||
      typeof rawItem !== "object" ||
      typeof (rawItem as { nome?: unknown }).nome !== "string" ||
      typeof (rawItem as { pais?: unknown }).pais !== "string"
    ) {
      continue;
    }

    const r = rawItem as Partial<NumismaticRecord> & { valor_facial?: string };
    const normalizedRecord: NumismaticRecord = syncRecordWithPrimaryExemplar({
      id: r.id || generateId("ref"),
      nome: r.nome,
      pais: r.pais,
      valor_face: r.valor_face || r.valor_facial || "",
      ano: String(r.ano ?? ""),
      casa_moeda: r.casa_moeda || "",
      material: r.material || "",
      peso_gramas: Number(r.peso_gramas) || 0,
      diametro_mm: Number(r.diametro_mm) || 0,
      bordo: r.bordo || "",
      estado_conservacao: r.estado_conservacao || "MBC",
      valor_mercado_min_brl: Number(r.valor_mercado_min_brl) || 0,
      valor_mercado_max_brl: Number(r.valor_mercado_max_brl) || 0,
      alertas_variantes_raras: Array.isArray(r.alertas_variantes_raras)
        ? r.alertas_variantes_raras
        : [],
      alertas_conservacao: Array.isArray(r.alertas_conservacao)
        ? r.alertas_conservacao
        : [],
      curiosidades: r.curiosidades || "",
      observacoes: r.observacoes || "",
      local_armazenamento: r.local_armazenamento || "",
      unidade_monetaria: r.unidade_monetaria,
      krause_id: r.krause_id,
      numista_id: r.numista_id,
      anverso_image: r.anverso_image,
      reverso_image: r.reverso_image,
      exemplares: r.exemplares,
      created_at: r.created_at || new Date().toISOString(),
      updated_at: r.updated_at || new Date().toISOString(),
    });

    validRecords.push(normalizedRecord);
  }

  if (rawList.length > 0 && validRecords.length === 0) {
    throw new Error(
      "Nenhum registro numismático válido foi encontrado no arquivo JSON."
    );
  }

  return validRecords;
}

/**
 * Importa dados de coleção a partir de uma string JSON com opção de Mesclar (`'merge'`) ou Sobrescrever (`'overwrite'`).
 */
export async function importCollectionData(
  jsonString: string,
  mode: "merge" | "overwrite"
): Promise<{ total: number; added: number; mergedExemplars: number }> {
  const importedRecords = parseAndValidateBackupJson(jsonString);

  if (mode === "overwrite") {
    const consolidated = consolidateRecordsByTypeKey(importedRecords);
    writeLocalRecords(consolidated.records);
    await autoBackfillCatalogIds();
    const finalRecords = deduplicateLocalCollection();
    return {
      total: finalRecords.length,
      added: finalRecords.length,
      mergedExemplars: consolidated.mergedExemplars,
    };
  }

  // Modo 'merge': primeiro limpa/agrupa eventuais duplicatas locais existentes
  const consolidatedLocal = consolidateRecordsByTypeKey(readLocalRecords());
  const localRecords = consolidatedLocal.records;
  let added = 0;
  let mergedExemplars = consolidatedLocal.mergedExemplars;

  for (const incoming of importedRecords) {
    const incomingKey = getCoinTypeKey(incoming);
    const matchIndex = localRecords.findIndex(
      (local) => getCoinTypeKey(local) === incomingKey
    );

    if (matchIndex === -1) {
      localRecords.push(incoming);
      added++;
    } else {
      const existing = localRecords[matchIndex];
      const existingExemplarIds = new Set(
        (existing.exemplares || []).map((ex) => ex.id)
      );

      const newExemplaresToAdd: NumismaticExemplar[] = [];
      for (const incEx of incoming.exemplares || []) {
        const sanitizedEx = sanitizeExemplar(incEx, incoming);
        // Garante que cada exemplar do registro importado seja anexado ao array `exemplares`
        // do registro local existente, atribuindo novo ID caso haja colisão de ID entre arquivos
        const finalExId = existingExemplarIds.has(sanitizedEx.id)
          ? generateId("ex")
          : sanitizedEx.id;

        newExemplaresToAdd.push({
          ...sanitizedEx,
          id: finalExId,
        });
        existingExemplarIds.add(finalExId);
        mergedExemplars++;
      }

      if (
        !existing.unidade_monetaria?.trim() &&
        incoming.unidade_monetaria?.trim()
      ) {
        existing.unidade_monetaria = incoming.unidade_monetaria.trim();
      }
      if (!existing.krause_id?.trim() && incoming.krause_id?.trim()) {
        existing.krause_id = incoming.krause_id.trim();
      }
      if (!existing.numista_id?.trim() && incoming.numista_id?.trim()) {
        existing.numista_id = incoming.numista_id.trim();
      }

      const mergedVariants = Array.from(
        new Set([
          ...(existing.alertas_variantes_raras || []),
          ...(incoming.alertas_variantes_raras || []),
        ])
      );

      localRecords[matchIndex] = syncRecordWithPrimaryExemplar({
        ...existing,
        updated_at: new Date().toISOString(),
        alertas_variantes_raras: mergedVariants,
        anverso_image: existing.anverso_image || incoming.anverso_image,
        reverso_image: existing.reverso_image || incoming.reverso_image,
        exemplares: [...existing.exemplares, ...newExemplaresToAdd],
      });
    }
  }

  writeLocalRecords(localRecords);
  await autoBackfillCatalogIds();
  const finalRecords = deduplicateLocalCollection();

  return {
    total: finalRecords.length,
    added,
    mergedExemplars,
  };
}

export const numismaticRepository: CollectionRepository = {
  async list(): Promise<NumismaticRecord[]> {
    const items = deduplicateLocalCollection();
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

    const incomingKey = getCoinTypeKey(data);
    const existingIndex = items.findIndex(
      (existing) => getCoinTypeKey(existing) === incomingKey
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
        unidade_monetaria: existing.unidade_monetaria || data.unidade_monetaria,
        krause_id: existing.krause_id || data.krause_id,
        numista_id: existing.numista_id || data.numista_id,
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

    const { alertas_variantes_raras, ...exemplarPatch } = patch;
    const now = new Date().toISOString();
    const updatedExemplares = items[index].exemplares.map((ex) =>
      ex.id === exemplarId
        ? {
            ...ex,
            ...exemplarPatch,
            updated_at: now,
          }
        : ex
    );

    const updated = syncRecordWithPrimaryExemplar({
      ...items[index],
      ...(Array.isArray(alertas_variantes_raras)
        ? { alertas_variantes_raras }
        : {}),
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

  async importCollectionData(jsonString: string, mode: "merge" | "overwrite") {
    return importCollectionData(jsonString, mode);
  },
};
