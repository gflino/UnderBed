import {
  NumismaticClassification,
  NumismaticExemplar,
  NumismaticRecord,
  StandardizeImageResponse,
} from "@/types/numismatics";
import { autoCropAndCompressCoin, base64ToBlob } from "@/lib/image-utils";
import {
  cropCenterAndRotateCoin,
  rotateBase64Image,
} from "@/lib/imageProcessor";

export { cropCenterAndRotateCoin, rotateBase64Image };

const STORAGE_KEY = "underbed:collection:v2";
const CROP_MIGRATION_KEY = "underbed_crop_migration_v3";
const PRIMARY_FACE_STORAGE_KEY = "underbed:primary_face";

export type PrimaryFacePreference = "anverso" | "reverso";

export function getPrimaryFacePreference(): PrimaryFacePreference {
  if (typeof window === "undefined") return "anverso";
  const val = window.localStorage.getItem(PRIMARY_FACE_STORAGE_KEY);
  return val === "reverso" ? "reverso" : "anverso";
}

export function setPrimaryFacePreference(face: PrimaryFacePreference): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PRIMARY_FACE_STORAGE_KEY, face);
}

export interface CollectionRepository {
  list(): Promise<NumismaticRecord[]>;
  getById(id: string): Promise<NumismaticRecord | null>;
  create(
    data: NumismaticClassification,
    images?: {
      anverso?: string;
      reverso?: string;
      alreadyStandardized?: boolean;
    }
  ): Promise<{
    record: NumismaticRecord;
    exemplarId: string;
    isNewExemplarOnExistingRef: boolean;
  }>;
  addExemplar(
    recordId: string,
    exemplarData: {
      gravura?: string;
      estado_conservacao: string;
      valor_mercado_min_brl: number;
      valor_mercado_max_brl: number;
      local_armazenamento: string;
      observacoes: string;
      alertas_conservacao?: string[];
      variantes_confirmadas?: string[];
      anverso_image?: string;
      reverso_image?: string;
      anverso_rotation?: number;
      reverso_rotation?: number;
      image_standardized?: boolean;
    }
  ): Promise<{ record: NumismaticRecord; exemplarId: string } | null>;
  updateExemplar(
    recordId: string,
    exemplarId: string,
    patch: Partial<
      Pick<
        NumismaticExemplar,
        | "gravura"
        | "estado_conservacao"
        | "valor_mercado_min_brl"
        | "valor_mercado_max_brl"
        | "local_armazenamento"
        | "observacoes"
        | "variantes_confirmadas"
        | "alertas_conservacao"
        | "anverso_image"
        | "reverso_image"
        | "anverso_rotation"
        | "reverso_rotation"
        | "image_standardized"
      >
    > & {
      alertas_variantes_raras?: string[];
    }
  ): Promise<NumismaticRecord | null>;
  updateRecord(
    recordId: string,
    patch: Partial<
      Pick<
        NumismaticRecord,
        | "nome"
        | "pais"
        | "ano"
        | "valor_face"
        | "unidade_monetaria"
        | "casa_moeda"
        | "material"
        | "peso_gramas"
        | "diametro_mm"
        | "bordo"
        | "krause_id"
        | "numista_id"
        | "curiosidades"
      >
    > & {
      gravura?: string;
      exemplarId?: string;
    }
  ): Promise<NumismaticRecord | null>;
  removeExemplar(
    recordId: string,
    exemplarId: string
  ): Promise<NumismaticRecord | null>;
  mergeRecords(
    sourceRecordId: string,
    targetRecordId: string,
    onlyExemplarId?: string
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

const COUNTRY_ISO3_MAP: Record<string, string> = {
  brasil: "BRA",
  brazil: "BRA",
  "republica federativa do brasil": "BRA",
  "estados unidos do brasil": "BRA",
  "imperio do brasil": "BRA",
  "reino unido de portugal, brasil e algarves": "BRA",
  "coreia do sul": "KOR",
  "republica da coreia": "KOR",
  "south korea": "KOR",
  coreia: "KOR",
  korea: "KOR",
  "coreia do norte": "PRK",
  "north korea": "PRK",
  "estados unidos": "USA",
  "estados unidos da america": "USA",
  eua: "USA",
  usa: "USA",
  "united states": "USA",
  "united states of america": "USA",
  portugal: "PRT",
  "republica portuguesa": "PRT",
  argentina: "ARG",
  "republica argentina": "ARG",
  uruguai: "URY",
  uruguay: "URY",
  paraguai: "PRY",
  paraguay: "PRY",
  chile: "CHL",
  bolivia: "BOL",
  peru: "PER",
  colombia: "COL",
  venezuela: "VEN",
  equador: "ECU",
  ecuador: "ECU",
  mexico: "MEX",
  "estados unidos mexicanos": "MEX",
  canada: "CAN",
  "reino unido": "GBR",
  "gra-bretanha": "GBR",
  "gra bretanha": "GBR",
  inglaterra: "GBR",
  "united kingdom": "GBR",
  "great britain": "GBR",
  alemanha: "DEU",
  germany: "DEU",
  "republica federal da alemanha": "DEU",
  "imperio alemao": "DEU",
  franca: "FRA",
  france: "FRA",
  "republica francesa": "FRA",
  italia: "ITA",
  italy: "ITA",
  "republica italiana": "ITA",
  espanha: "ESP",
  spain: "ESP",
  suica: "CHE",
  switzerland: "CHE",
  "paises baixos": "NLD",
  holanda: "NLD",
  netherlands: "NLD",
  belgica: "BEL",
  belgium: "BEL",
  austria: "AUT",
  polonia: "POL",
  poland: "POL",
  grecia: "GRC",
  greece: "GRC",
  turquia: "TUR",
  turkey: "TUR",
  russia: "RUS",
  "federacao russa": "RUS",
  "imperio russo": "RUS",
  "uniao sovietica": "SUN",
  urss: "SUN",
  ussr: "SUN",
  japao: "JPN",
  japan: "JPN",
  china: "CHN",
  "republica popular da china": "CHN",
  india: "IND",
  australia: "AUS",
  "nova zelandia": "NZL",
  "new zealand": "NZL",
  "africa do sul": "ZAF",
  "south africa": "ZAF",
  egito: "EGY",
  egypt: "EGY",
  israel: "ISR",
  cuba: "CUB",
  suecia: "SWE",
  sweden: "SWE",
  noruega: "NOR",
  norway: "NOR",
  dinamarca: "DNK",
  denmark: "DNK",
  finlandia: "FIN",
  finland: "FIN",
  irlanda: "IRL",
  ireland: "IRL",
  "uniao europeia": "EUR",
  "zona do euro": "EUR",
};

const UM_CODE_MAP: Record<string, string> = {
  "cruzeiro novo": "CRN",
  "cruzeiros novos": "CRN",
  "cruzeiro real": "CRV",
  "cruzeiros reais": "CRV",
  cruzeiro: "CRU",
  cruzeiros: "CRU",
  "cruzado novo": "CZN",
  "cruzados novos": "CZN",
  cruzado: "CRZ",
  cruzados: "CRZ",
  reis: "REI",
  "real antigo": "REI",
  "mil-reis": "REI",
  "mil reis": "REI",
  "conto de reis": "REI",
  real: "BRL",
  reais: "BRL",
  "real brasileiro": "BRL",
  "won sul-coreano": "KRW",
  "won sul coreano": "KRW",
  "won coreano": "KRW",
  "south korean won": "KRW",
  won: "KRW",
  "won norte-coreano": "KPW",
  "dolar americano": "USD",
  "dolar dos estados unidos": "USD",
  "dolar norte-americano": "USD",
  "us dollar": "USD",
  dollar: "USD",
  dolar: "USD",
  "dolar canadense": "CAD",
  "dolar australiano": "AUD",
  euro: "EUR",
  euros: "EUR",
  "libra esterlina": "GBP",
  libra: "GBP",
  pound: "GBP",
  iene: "JPY",
  ienejapones: "JPY",
  yen: "JPY",
  yuan: "CNY",
  renminbi: "CNY",
  "peso argentino": "ARS",
  "peso uruguaio": "UYU",
  "peso chileno": "CLP",
  "peso mexicano": "MXN",
  "peso colombiano": "COP",
  "peso cubano": "CUP",
  peso: "PES",
  pesos: "PES",
  guarani: "PYG",
  boliviano: "BOB",
  sol: "PEN",
  "novo sol": "PEN",
  inti: "PEN",
  bolivar: "VES",
  escudo: "ESC",
  "escudo portugues": "ESC",
  peseta: "PTA",
  "franco suico": "CHF",
  "franco frances": "FRF",
  franco: "FRF",
  "marco alemao": "DEM",
  "deutsche mark": "DEM",
  reichsmark: "DEM",
  marco: "DEM",
  "lira italiana": "ITL",
  lira: "ITL",
  rublo: "RUB",
  rupia: "INR",
  rand: "ZAR",
};

function resolveCountryIso3(pais?: string): string {
  const norm = normalize(pais);
  if (!norm) return "UNK";
  if (COUNTRY_ISO3_MAP[norm]) return COUNTRY_ISO3_MAP[norm];
  for (const [key, code] of Object.entries(COUNTRY_ISO3_MAP)) {
    if (norm.includes(key)) return code;
  }
  const letters = norm.replace(/[^a-z]/g, "").toUpperCase();
  return (letters.slice(0, 3) || "UNK").padEnd(3, "X");
}

function resolveBrazilianUMByYear(yearNum: number): string {
  if (!Number.isFinite(yearNum) || yearNum <= 0) return "BRL";
  if (yearNum <= 1942) return "REI";
  if (yearNum >= 1943 && yearNum <= 1966) return "CRU";
  if (yearNum >= 1967 && yearNum <= 1969) return "CRN";
  if (yearNum >= 1970 && yearNum <= 1985) return "CRU";
  if (yearNum >= 1986 && yearNum <= 1988) return "CRZ";
  if (yearNum === 1989) return "CZN";
  if (yearNum >= 1990 && yearNum <= 1992) return "CRU";
  if (yearNum === 1993) return "CRV";
  return "BRL";
}

function resolveUMCode(
  record: Partial<NumismaticRecord>,
  countryIso3: string,
  yearStr: string
): string {
  const rawUM = normalize(record.unidade_monetaria);
  if (rawUM && rawUM !== "centavo" && rawUM !== "centavos") {
    if (UM_CODE_MAP[rawUM]) return UM_CODE_MAP[rawUM];
    for (const [key, code] of Object.entries(UM_CODE_MAP)) {
      if (rawUM.includes(key)) return code;
    }
    const letters = rawUM.replace(/[^a-z]/g, "").toUpperCase();
    if (letters.length >= 2) return letters.slice(0, 3);
  }

  // Tenta inferir a partir de valor_face ou nome
  const combined = normalize(`${record.valor_face || ""} ${record.nome || ""}`);
  for (const [key, code] of Object.entries(UM_CODE_MAP)) {
    if (new RegExp(`\\b${key}\\b`).test(combined)) {
      return code;
    }
  }

  if (countryIso3 === "BRA") {
    return resolveBrazilianUMByYear(Number(yearStr));
  }
  if (countryIso3 === "KOR") return "KRW";
  if (countryIso3 === "USA") return "USD";
  if (countryIso3 === "GBR") return "GBP";
  if (countryIso3 === "JPN") return "JPY";

  return "GEN";
}

function resolveCleanFaceValue(record: Partial<NumismaticRecord>): string {
  const raw = normalize(record.valor_face || record.nome || "");
  if (!raw) return "0";

  const isSubunitWord =
    /\b(centavo|centavos|cent|cents|centime|centimes|centesimo|centesimos|centesimi|pfennig|kopek|kopeck|sen|penny|pence|agora)\b/.test(
      raw
    );

  // Frações explícitas (ex: 1/2)
  const fractionMatch = raw.match(/(\d+)\s*\/\s*(\d+)/);
  if (fractionMatch) {
    const num = Number(fractionMatch[1]);
    const den = Number(fractionMatch[2]);
    if (den > 0) {
      const ratio = num / den;
      if (ratio < 1) {
        return `${Math.round(ratio * 100)}C`;
      }
    }
  }

  const numTokenMatch = raw.match(/\d+(?:[.,]\d+)*/);
  if (!numTokenMatch) return "0";
  const token = numTokenMatch[0];

  let numericValue = 0;
  if (token.includes(",")) {
    numericValue = Number(token.replace(/\./g, "").replace(",", "."));
  } else if (/^\d{1,3}(\.\d{3})+$/.test(token)) {
    numericValue = Number(token.replace(/\./g, ""));
  } else {
    numericValue = Number(token);
  }

  if (!Number.isFinite(numericValue) || numericValue <= 0) return "0";

  // Se o número for decimal menor que 1 (ex: "0,50 Cruzeiro" -> 50C)
  if (numericValue > 0 && numericValue < 1) {
    return `${Math.round(numericValue * 100)}C`;
  }

  if (isSubunitWord) {
    return `${Math.round(numericValue)}C`;
  }

  return Number.isInteger(numericValue)
    ? String(numericValue)
    : String(numericValue).replace(".", "_");
}

/**
 * Gera o Código Amigável Universal independente de idioma no formato:
 * `[Tipo]-[PaísISO3]-[UM]-[Ano]-[Valor]` (ex: `C-BRA-CRU-1977-50C`).
 */
export const generateFriendlyCode = (
  record: Partial<NumismaticRecord>
): string => {
  const krauseNorm = normalize(record.krause_id);
  const materialNorm = normalize(record.material);
  const bordoNorm = normalize(record.bordo);
  const nomeNorm = normalize(record.nome);

  const isBanknote =
    /^p\s*#?\s*\d/.test(krauseNorm) ||
    bordoNorm.includes("cedula") ||
    materialNorm.includes("papel") ||
    materialNorm.includes("polimero") ||
    materialNorm.includes("fiduci") ||
    nomeNorm.includes("cedula");

  const tipo = isBanknote ? "B" : "C";
  const paisIso3 = resolveCountryIso3(record.pais);
  const yearMatch = String(record.ano ?? "").match(/\d{3,4}/);
  const cleanYear = yearMatch
    ? yearMatch[0]
    : String(record.ano ?? "")
        .trim()
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase() || "0000";
  const umCode = resolveUMCode(record, paisIso3, cleanYear);
  const cleanValue = resolveCleanFaceValue(record);

  return `${tipo}-${paisIso3}-${umCode}-${cleanYear}-${cleanValue}`;
};

export const getCoinTypeKey = (record: Partial<NumismaticRecord>): string => {
  const friendly = generateFriendlyCode(record).toUpperCase().trim();
  return friendly;
};

/**
 * Formata o título principal do card/registro seguindo estritamente a regra:
 * `[Valor Facial] - [Unidade Monetária]` (ex: `50 Centavos - Cruzeiro`, `50 Won - Won Sul-Coreano`, `400 Réis - Réis`).
 */
export function formatStandardCoinTitle(
  record: Partial<NumismaticRecord>
): string {
  const rawValor = String(record.valor_face || "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .split(/\s*[-—–]\s*/)[0]
    .trim();
  const rawUM = String(record.unidade_monetaria || "").trim();

  if (rawValor && rawUM) {
    return `${rawValor} - ${rawUM}`;
  }
  if (rawValor) {
    return rawValor;
  }
  const fallbackName = String(record.nome || "")
    .split(/\s*[-—–]\s*/)[0]
    .trim();
  if (fallbackName && rawUM) {
    return `${fallbackName} - ${rawUM}`;
  }
  return fallbackName || "Peça Numismática";
}

/**
 * Extrai a gravura/detalhamento temático de um registro legado quando `nome` continha
 * o formato antigo `"Valor - Efígie/Tema"`.
 */
function extractLegacyGravuraFromRecord(
  rawRecord: Partial<NumismaticRecord> & { gravura?: string }
): string | undefined {
  if (typeof rawRecord.gravura === "string" && rawRecord.gravura.trim()) {
    return rawRecord.gravura.trim();
  }
  const rawName = String(rawRecord.nome || "").trim();
  const parts = rawName.split(/\s*[-—–]\s*/);
  if (parts.length >= 2) {
    const candidate = parts.slice(1).join(" - ").trim();
    const umNorm = normalize(rawRecord.unidade_monetaria);
    if (candidate && normalize(candidate) !== umNorm) {
      return candidate;
    }
  }
  return undefined;
}

/**
 * Gera os rótulos de exibição dos exemplares físicos aplicando numeração sequencial
 * automática (`#1`, `#2`) quando múltiplos exemplares compartilham a mesma gravura.
 */
export function getExemplarDisplayLabels(
  exemplares: NumismaticExemplar[]
): string[] {
  const baseLabels = exemplares.map(
    (ex) => (ex.gravura || "").trim() || "Exemplar"
  );
  const counts = new Map<string, number>();
  for (const label of baseLabels) {
    const key = normalize(label);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const seen = new Map<string, number>();
  return baseLabels.map((label) => {
    const key = normalize(label);
    const total = counts.get(key) || 1;
    const nextIdx = (seen.get(key) || 0) + 1;
    seen.set(key, nextIdx);

    if (total > 1 || key === "exemplar") {
      return `${label} #${nextIdx}`;
    }
    return label;
  });
}

const normalizeRotation = (angle?: number): number => {
  const num = Number(angle) || 0;
  const mod = ((num % 360) + 360) % 360;
  if (mod === 90 || mod === 180 || mod === 270) return mod;
  return 0;
};

function sanitizeExemplar(
  rawEx: Partial<NumismaticExemplar> | undefined,
  fallbackRecord?: Partial<NumismaticRecord> & { gravura?: string }
): NumismaticExemplar {
  const now = new Date().toISOString();
  const gravura =
    typeof rawEx?.gravura === "string" && rawEx.gravura.trim()
      ? rawEx.gravura.trim()
      : fallbackRecord
        ? extractLegacyGravuraFromRecord(fallbackRecord)
        : undefined;

  return {
    id:
      typeof rawEx?.id === "string" && rawEx.id.trim()
        ? rawEx.id.trim()
        : generateId("ex"),
    created_at: rawEx?.created_at || fallbackRecord?.created_at || now,
    updated_at: rawEx?.updated_at || fallbackRecord?.updated_at || now,
    ...(gravura ? { gravura } : {}),
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
    anverso_rotation: normalizeRotation(
      rawEx?.anverso_rotation ?? fallbackRecord?.anverso_rotation
    ),
    reverso_rotation: normalizeRotation(
      rawEx?.reverso_rotation ?? fallbackRecord?.reverso_rotation
    ),
    ...(rawEx?.image_standardized !== undefined
      ? { image_standardized: Boolean(rawEx.image_standardized) }
      : fallbackRecord?.image_standardized !== undefined
        ? { image_standardized: Boolean(fallbackRecord.image_standardized) }
        : {}),
  };
}

function ensureExemplaresArray(
  rawRecord: Partial<NumismaticRecord> & { gravura?: string }
): NumismaticExemplar[] {
  if (Array.isArray(rawRecord.exemplares) && rawRecord.exemplares.length > 0) {
    return rawRecord.exemplares.map((ex) => sanitizeExemplar(ex, rawRecord));
  }
  return [sanitizeExemplar(undefined, rawRecord)];
}

/**
 * Sanitiza estritamente o registro mantendo apenas o `id` principal, `krause_id`,
 * `numista_id` e os `exemplares[].id`, padronizando o título `[Valor Facial] - [Unidade Monetária]`
 * e recalculando o CUB (`friendly_code`).
 */
function syncRecordWithPrimaryExemplar(
  rawRecord: Partial<NumismaticRecord> & { gravura?: string }
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

  const standardizedName = formatStandardCoinTitle({
    ...rawRecord,
    unidade_monetaria: unidadeMonetaria,
  });

  const baseRecord: NumismaticRecord = {
    id:
      typeof rawRecord.id === "string" && rawRecord.id.trim()
        ? rawRecord.id.trim()
        : generateId("ref"),
    created_at: rawRecord.created_at || now,
    updated_at: rawRecord.updated_at || now,
    nome: standardizedName,
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
    anverso_rotation: normalizeRotation(
      primary?.anverso_rotation ?? rawRecord.anverso_rotation
    ),
    reverso_rotation: normalizeRotation(
      primary?.reverso_rotation ?? rawRecord.reverso_rotation
    ),
    image_standardized:
      exemplares.length > 0 &&
      exemplares.every((ex) => Boolean(ex.image_standardized)),
    exemplares,
  };

  baseRecord.friendly_code = generateFriendlyCode(baseRecord);
  return baseRecord;
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

type StandardizationListener = {
  onProgress?: (current: number, total: number) => void;
  onItemUpdated?: () => void;
};

let activeStandardizationPromise: Promise<boolean> | null = null;
const standardizationListeners = new Set<StandardizationListener>();

/**
 * Varredura retroativa sequencial em toda a base de dados local:
 * Filtra todos os exemplares sem `image_standardized: true`, envia `anverso_image` e `reverso_image`
 * para `/api/standardize-image`, aplica `cropCenterAndRotateCoin` (600x600 1:1 em pé),
 * zera `anverso_rotation`/`reverso_rotation`, marca `image_standardized = true` e salva a cada exemplar.
 */
export async function autoStandardizeDatabaseImages(
  onProgress?: (current: number, total: number) => void,
  onItemUpdated?: () => void
): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const listener: StandardizationListener = { onProgress, onItemUpdated };
  standardizationListeners.add(listener);

  if (activeStandardizationPromise) {
    try {
      return await activeStandardizationPromise;
    } finally {
      standardizationListeners.delete(listener);
    }
  }

  activeStandardizationPromise = (async () => {
    let anyUpdated = false;

    try {
      const initialRecords = readLocalRecords();
      const queue: Array<{ recordId: string; exemplarId: string }> = [];

      let markedEmpty = false;
      for (const rec of initialRecords) {
        for (const ex of rec.exemplares || []) {
          if (ex.image_standardized) continue;
          const hasAnverso =
            typeof ex.anverso_image === "string" &&
            ex.anverso_image.trim().length > 0;
          const hasReverso =
            typeof ex.reverso_image === "string" &&
            ex.reverso_image.trim().length > 0;
          if (!hasAnverso && !hasReverso) {
            ex.image_standardized = true;
            markedEmpty = true;
          } else {
            queue.push({ recordId: rec.id, exemplarId: ex.id });
          }
        }
      }

      if (markedEmpty) {
        writeLocalRecords(
          initialRecords.map((r) => syncRecordWithPrimaryExemplar(r))
        );
      }

      const total = queue.length;
      if (total === 0) {
        return markedEmpty;
      }

      for (let i = 0; i < total; i++) {
        const currentStep = i + 1;
        const { recordId, exemplarId } = queue[i];

        standardizationListeners.forEach((l) => {
          l.onProgress?.(currentStep, total);
        });

        // Lê o estado mais recente antes de processar este exemplar
        const currentRecords = readLocalRecords();
        const targetRec = currentRecords.find((r) => r.id === recordId);
        const targetEx = targetRec?.exemplares?.find(
          (e) => e.id === exemplarId
        );

        if (!targetRec || !targetEx || targetEx.image_standardized) {
          continue;
        }

        try {
          const response = await fetch("/api/standardize-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              anverso_image: targetEx.anverso_image,
              reverso_image: targetEx.reverso_image,
            }),
          });

          if (!response.ok) {
            console.warn(
              `[autoStandardizeDatabaseImages] Falha na API (${response.status}) para exemplar ${exemplarId}`
            );
            continue;
          }

          const boxes = (await response.json()) as StandardizeImageResponse;

          let newAnverso = targetEx.anverso_image;
          let newReverso = targetEx.reverso_image;

          if (targetEx.anverso_image) {
            newAnverso = await cropCenterAndRotateCoin(
              targetEx.anverso_image,
              boxes.anverso_box,
              boxes.anverso_rotation
            );
          }

          if (targetEx.reverso_image) {
            newReverso = await cropCenterAndRotateCoin(
              targetEx.reverso_image,
              boxes.reverso_box,
              boxes.reverso_rotation
            );
          }

          // Re-lê registros locais para não sobrescrever edições concorrentes do usuário
          const latestRecords = readLocalRecords();
          const recIdx = latestRecords.findIndex((r) => r.id === recordId);
          if (recIdx !== -1) {
            const rec = latestRecords[recIdx];
            const updatedExemplares = (rec.exemplares || []).map((ex) =>
              ex.id === exemplarId
                ? {
                    ...ex,
                    anverso_image: newAnverso,
                    reverso_image: newReverso,
                    anverso_rotation: 0,
                    reverso_rotation: 0,
                    image_standardized: true,
                    updated_at: new Date().toISOString(),
                  }
                : ex
            );

            // syncRecordWithPrimaryExemplar atualiza automaticamente as fotos do card principal se for o Exemplar #1
            latestRecords[recIdx] = syncRecordWithPrimaryExemplar({
              ...rec,
              anverso_image:
                rec.exemplares?.[0]?.id === exemplarId
                  ? newAnverso
                  : rec.anverso_image,
              reverso_image:
                rec.exemplares?.[0]?.id === exemplarId
                  ? newReverso
                  : rec.reverso_image,
              anverso_rotation:
                rec.exemplares?.[0]?.id === exemplarId
                  ? 0
                  : rec.anverso_rotation,
              reverso_rotation:
                rec.exemplares?.[0]?.id === exemplarId
                  ? 0
                  : rec.reverso_rotation,
              exemplares: updatedExemplares,
            });

            writeLocalRecords(latestRecords);
            anyUpdated = true;

            standardizationListeners.forEach((l) => {
              l.onItemUpdated?.();
            });
          }
        } catch (err) {
          console.warn(
            `[autoStandardizeDatabaseImages] Erro ao padronizar exemplar ${exemplarId}:`,
            err
          );
        }
      }

      return anyUpdated;
    } finally {
      activeStandardizationPromise = null;
      standardizationListeners.delete(listener);
    }
  })();

  return activeStandardizationPromise;
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
      anverso_rotation: r.anverso_rotation,
      reverso_rotation: r.reverso_rotation,
      image_standardized: r.image_standardized,
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
    images?: {
      anverso?: string;
      reverso?: string;
      alreadyStandardized?: boolean;
    }
  ): Promise<{
    record: NumismaticRecord;
    exemplarId: string;
    isNewExemplarOnExistingRef: boolean;
  }> {
    let finalAnverso = images?.anverso;
    let finalReverso = images?.reverso;

    if (!images?.alreadyStandardized) {
      if (finalAnverso && data.anverso_box) {
        try {
          finalAnverso = await cropCenterAndRotateCoin(
            finalAnverso,
            data.anverso_box,
            data.anverso_rotation ?? 0
          );
        } catch (err) {
          console.warn("Falha ao padronizar anverso no create:", err);
        }
      }
      if (finalReverso && data.reverso_box) {
        try {
          finalReverso = await cropCenterAndRotateCoin(
            finalReverso,
            data.reverso_box,
            data.reverso_rotation ?? 0
          );
        } catch (err) {
          console.warn("Falha ao padronizar reverso no create:", err);
        }
      }
    }

    const items = readLocalRecords();
    const now = new Date().toISOString();
    const newExemplar: NumismaticExemplar = {
      id: generateId("ex"),
      created_at: now,
      updated_at: now,
      ...(data.gravura?.trim()
        ? { gravura: data.gravura.trim() }
        : extractLegacyGravuraFromRecord(data)
          ? { gravura: extractLegacyGravuraFromRecord(data) }
          : {}),
      estado_conservacao: data.estado_conservacao,
      valor_mercado_min_brl: data.valor_mercado_min_brl,
      valor_mercado_max_brl: data.valor_mercado_max_brl,
      alertas_conservacao: data.alertas_conservacao || [],
      variantes_confirmadas: [],
      observacoes: data.observacoes || "",
      local_armazenamento: data.local_armazenamento || "",
      anverso_image: finalAnverso,
      reverso_image: finalReverso,
      anverso_rotation: 0,
      reverso_rotation: 0,
      image_standardized: true,
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
        anverso_image: existing.anverso_image || finalAnverso,
        reverso_image: existing.reverso_image || finalReverso,
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
      anverso_image: finalAnverso,
      reverso_image: finalReverso,
      anverso_rotation: 0,
      reverso_rotation: 0,
      image_standardized: true,
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
      ...(exemplarData.gravura?.trim()
        ? { gravura: exemplarData.gravura.trim() }
        : items[index].exemplares?.[0]?.gravura
          ? { gravura: items[index].exemplares[0].gravura }
          : {}),
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
      anverso_rotation: normalizeRotation(exemplarData.anverso_rotation),
      reverso_rotation: normalizeRotation(exemplarData.reverso_rotation),
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

  async updateRecord(
    recordId: string,
    patch
  ): Promise<NumismaticRecord | null> {
    const items = readLocalRecords();
    const index = items.findIndex((item) => item.id === recordId);
    if (index === -1) return null;

    const current = items[index];
    const now = new Date().toISOString();
    const { gravura, exemplarId, ...recordFields } = patch;

    const updatedExemplares = current.exemplares.map((ex, idx) => {
      if (
        typeof gravura === "string" &&
        ((exemplarId && ex.id === exemplarId) || (!exemplarId && idx === 0))
      ) {
        return {
          ...ex,
          gravura: gravura.trim() || undefined,
          updated_at: now,
        };
      }
      return ex;
    });

    const nextValorFace =
      recordFields.valor_face !== undefined
        ? recordFields.valor_face.trim()
        : current.valor_face;
    const nextUM =
      recordFields.unidade_monetaria !== undefined
        ? recordFields.unidade_monetaria.trim()
        : current.unidade_monetaria;

    const updated = syncRecordWithPrimaryExemplar({
      ...current,
      ...recordFields,
      valor_face: nextValorFace,
      unidade_monetaria: nextUM,
      nome: formatStandardCoinTitle({
        ...current,
        ...recordFields,
        valor_face: nextValorFace,
        unidade_monetaria: nextUM,
      }),
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

  async mergeRecords(
    sourceRecordId: string,
    targetRecordId: string,
    onlyExemplarId?: string
  ): Promise<NumismaticRecord | null> {
    if (sourceRecordId === targetRecordId) return null;
    const items = readLocalRecords();
    const sourceIndex = items.findIndex((item) => item.id === sourceRecordId);
    const targetIndex = items.findIndex((item) => item.id === targetRecordId);
    if (sourceIndex === -1 || targetIndex === -1) return null;

    const source = items[sourceIndex];
    const target = items[targetIndex];

    const exemplarsToMove = onlyExemplarId
      ? source.exemplares.filter((ex) => ex.id === onlyExemplarId)
      : source.exemplares;

    if (exemplarsToMove.length === 0) return null;

    const existingTargetExIds = new Set(
      (target.exemplares || []).map((ex) => ex.id)
    );

    const preparedExemplars: NumismaticExemplar[] = exemplarsToMove.map(
      (ex) => {
        const sanitized = sanitizeExemplar(ex, source);
        const finalId = existingTargetExIds.has(sanitized.id)
          ? generateId("ex")
          : sanitized.id;
        existingTargetExIds.add(finalId);
        return { ...sanitized, id: finalId };
      }
    );

    const mergedVariants = Array.from(
      new Set([
        ...(target.alertas_variantes_raras || []),
        ...(source.alertas_variantes_raras || []),
      ])
    );

    const updatedTarget = syncRecordWithPrimaryExemplar({
      ...target,
      updated_at: new Date().toISOString(),
      alertas_variantes_raras: mergedVariants,
      anverso_image: target.anverso_image || source.anverso_image,
      reverso_image: target.reverso_image || source.reverso_image,
      exemplares: [...target.exemplares, ...preparedExemplars],
    });

    items[targetIndex] = updatedTarget;

    const remainingSourceExemplars = onlyExemplarId
      ? source.exemplares.filter((ex) => ex.id !== onlyExemplarId)
      : [];

    if (remainingSourceExemplars.length === 0) {
      const filtered = items.filter((item) => item.id !== sourceRecordId);
      writeLocalRecords(filtered);
    } else {
      items[sourceIndex] = syncRecordWithPrimaryExemplar({
        ...source,
        updated_at: new Date().toISOString(),
        exemplares: remainingSourceExemplars,
      });
      writeLocalRecords(items);
    }

    return updatedTarget;
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
