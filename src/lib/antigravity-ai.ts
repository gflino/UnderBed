import { GoogleGenAI, Schema, Type } from "@google/genai";
import {
  ClassifyImageInput,
  NumismaticClassification,
  StandardizeImageResponse,
} from "@/types/numismatics";

export const NUMISMATIC_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  description:
    "Laudo técnico numismático estruturado do UnderBed com identificação autônoma de Anverso e Reverso e códigos de catálogo Krause (KM#/P#) e Numista (N#).",
  properties: {
    nome: {
      type: Type.STRING,
      description:
        "Título padronizado estritamente no formato '[Valor Facial] - [Unidade Monetária]' sem efígie ou tema (ex: '50 Centavos - Cruzeiro', '50 Won - Won Sul-Coreano', '400 Réis - Réis', '1 Real - Real').",
    },
    gravura: {
      type: Type.STRING,
      description:
        "Detalhamento artístico, gravura ou efígie temática específica retratada no exemplar (ex: 'Plano Piloto de Brasília', 'Dom Pedro II', 'Cruzeiro do Sul (1ª Família)', 'Dwight D. Eisenhower / Apollo 11').",
    },
    pais: {
      type: Type.STRING,
      description: "País ou autoridade emissora da moeda ou cédula.",
    },
    valor_face: {
      type: Type.STRING,
      description:
        "Valor facial expresso na peça com sua unidade monetária (ex: '1 Real', '1 Dollar', '1000 Cruzados').",
    },
    unidade_monetaria: {
      type: Type.STRING,
      description:
        "Nome padronizado da unidade monetária ou padrão monetário histórico da peça para agrupamento (ex: 'Real', 'Cruzeiro', 'Cruzado Novo', 'Réis', 'Dólar Americano', 'Euro', 'Won Sul-Coreano').",
    },
    ano: {
      type: Type.STRING,
      description:
        "Ano de cunhagem, emissão ou série visível na peça (ou faixa estimada caso ilegível).",
    },
    casa_moeda: {
      type: Type.STRING,
      description:
        "Casa da Moeda responsável e eventual letra monetária / mint mark (ex: 'Casa da Moeda do Brasil - Rio de Janeiro', 'Denver (D)', 'Philadelphia (sem marca)').",
    },
    material: {
      type: Type.STRING,
      description:
        "Composição metálica ou substrato (ex: 'Aço inoxidável', 'Bimetálica (Aço inox e Bronze)', 'Prata .900', 'Papel fiduciário de algodão').",
    },
    peso_gramas: {
      type: Type.NUMBER,
      description:
        "Peso oficial de catálogo em gramas (ex: 7.0, 22.68). Para cédulas, informar peso aproximado (~1.0).",
    },
    diametro_mm: {
      type: Type.NUMBER,
      description:
        "Diâmetro oficial em milímetros (para moedas) ou largura em milímetros (para cédulas).",
    },
    bordo: {
      type: Type.STRING,
      description:
        "Descrição técnica do bordo (ex: 'Serrilhado', 'Serrilhado intermitente', 'Liso com legenda', 'N/A (Cédula)').",
    },
    estado_conservacao: {
      type: Type.STRING,
      description:
        "Classificação estimada na escala numismática brasileira e internacional (ex: 'MBC (Muito Bem Conservada) / Very Fine (VF)', 'Soberba (SOB) / Extremely Fine (XF / AU)', 'Flor de Cunho (FC) / Uncirculated (UNC)', 'BC (Bem Conservada) / Fine (F)').",
    },
    valor_mercado_min_brl: {
      type: Type.NUMBER,
      description:
        "Valor mínimo estimado de mercado no Brasil em Reais (BRL) considerando o estado de conservação observado.",
    },
    valor_mercado_max_brl: {
      type: Type.NUMBER,
      description:
        "Valor máximo estimado de mercado no Brasil em Reais (BRL) considerando o estado de conservação observado (sem considerar variantes raras ainda não confirmadas pelo usuário).",
    },
    alertas_variantes_raras: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "Lista padronizada de variações catalogadas para este ano/modelo no formato 'Nome da Variação: critério objetivo de verificação visual'. NUNCA afirme que a foto possui reverso invertido/horizontal pela rotação da imagem.",
    },
    alertas_conservacao: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "Lista de alertas de conservação visíveis nas fotos ou riscos químicos/físicos comuns para este material (ex: 'Sinais de oxidação/zinabre esverdeado por ataque de PVC', 'Arranhões paralelos sugerindo limpeza abrasiva', 'Desgaste acentuado nos pontos altos do relevo', 'Marca de dobra central ou furo de grampo enferrujado').",
    },
    curiosidades: {
      type: Type.STRING,
      description:
        "Texto rico e detalhado com o contexto histórico da emissão, autor/gravador do projeto, dados conhecidos de tiragem, efígie retratada e fatos marcantes na numismática.",
    },
    observacoes: {
      type: Type.STRING,
      description:
        "Observações técnicas complementares para o colecionador (ex: recomendação de acondicionamento em coin holder livre de PVC ou dicas de conservação).",
    },
    local_armazenamento: {
      type: Type.STRING,
      description:
        "Local de armazenamento informado pelo usuário ou sugestão padrão de acondicionamento.",
    },
    krause_id: {
      type: Type.STRING,
      description:
        "Código de catálogo oficial Krause/Standard Catalog of World Coins para moedas (ex: 'KM# 594', 'Y# 45') ou Standard Catalog of World Paper Money/Pick para cédulas (ex: 'P# 102').",
    },
    numista_id: {
      type: Type.STRING,
      description:
        "Código de referência correspondente no catálogo Numista (ex: 'N# 4512').",
    },
    indice_anverso: {
      type: Type.INTEGER,
      description:
        "Índice baseado em zero (0 para a Imagem #0 ou 1 para a Imagem #1) que corresponde ao ANVERSO (frente/efígie/brasão principal/autoridade emissora) da moeda ou cédula.",
    },
    indice_reverso: {
      type: Type.INTEGER,
      description:
        "Índice baseado em zero (0 para a Imagem #0, 1 para a Imagem #1, ou -1 se apenas 1 imagem foi enviada) que corresponde ao REVERSO (valor facial/reverso/estampa oposta) da moeda ou cédula.",
    },
    anverso_box: {
      type: Type.ARRAY,
      items: { type: Type.NUMBER },
      description:
        "Array de 4 números [ymin, xmin, ymax, xmax] na escala de 0 a 1000 delimitando estritamente a borda física da moeda na foto correspondente ao ANVERSO (ignorando sombras projetadas no fundo branco/papel).",
    },
    anverso_rotation: {
      type: Type.INTEGER,
      description:
        "Ângulo inteiro (0, 90, 180 ou 270) no sentido horário necessário para girar a foto do ANVERSO para deixá-la perfeitamente 'em pé' (alinhado pelo topo da efígie/brasão e leitura horizontal das legendas e datas).",
    },
    reverso_box: {
      type: Type.ARRAY,
      items: { type: Type.NUMBER },
      description:
        "Array de 4 números [ymin, xmin, ymax, xmax] na escala de 0 a 1000 delimitando estritamente a borda física da moeda na foto correspondente ao REVERSO (ignorando sombras projetadas no fundo branco/papel).",
    },
    reverso_rotation: {
      type: Type.INTEGER,
      description:
        "Ângulo inteiro (0, 90, 180 ou 270) no sentido horário necessário para girar a foto do REVERSO para deixá-la perfeitamente 'em pé' (leitura horizontal do valor facial, legendas e datas).",
    },
  },
  required: [
    "nome",
    "gravura",
    "pais",
    "valor_face",
    "unidade_monetaria",
    "ano",
    "casa_moeda",
    "material",
    "peso_gramas",
    "diametro_mm",
    "bordo",
    "estado_conservacao",
    "valor_mercado_min_brl",
    "valor_mercado_max_brl",
    "alertas_variantes_raras",
    "alertas_conservacao",
    "curiosidades",
    "observacoes",
    "local_armazenamento",
    "krause_id",
    "numista_id",
    "indice_anverso",
    "indice_reverso",
    "anverso_box",
    "anverso_rotation",
    "reverso_box",
    "reverso_rotation",
  ],
};

export const NUMISMATIC_SYSTEM_INSTRUCTION = `Você é o perito sênior em Numismática e Notafilia do aplicativo UnderBed (especialista nos catálogos Krause/Standard Catalog of World Coins, Pick, Numista, Bentes, Amato/Neves e Vieira).
Sua tarefa é analisar as fotografias enviadas (sem ordem pré-definida pelo usuário) de uma moeda ou cédula, determinar autonomamente qual imagem corresponde ao ANVERSO e qual corresponde ao REVERSO, e produzir uma ficha catalográfica rigorosa em português do Brasil.

Diretrizes obrigatórias:
1. IDENTIFICAÇÃO AUTÔNOMA DE ANVERSO E REVERSO:
   - O usuário envia 1 ou 2 imagens (Imagem #0 e, quando presente, Imagem #1) em qualquer ordem.
   - Determine qual índice (0 ou 1) é o ANVERSO (geralmente traz a efígie do monarca/personalidade/República, brasão de armas nacional ou autoridade emissora, ou a frente com chancelas em cédulas) e preencha "indice_anverso".
   - Determine qual índice (0 ou 1, ou -1 se houver apenas uma foto) é o REVERSO (geralmente traz o valor de face em destaque, cena alegórica/fauna/flora ou reverso da cédula) e preencha "indice_reverso".
2. Identifique com precisão a peça, país emissor, valor de face, a unidade monetária padronizada ("unidade_monetaria", ex: 'Cruzeiro', 'Réis', 'Real', 'Cruzado', 'Dólar Americano', 'Won Sul-Coreano'), ano visível e casa da moeda (observe letras monetárias/mint marks quando visíveis).
   - O campo "nome" deve seguir OBRIGATORIAMENTE o padrão "[Valor Facial] - [Unidade Monetária]" sem nomes de efígies ou temas longos (ex: "50 Centavos - Cruzeiro", "50 Won - Won Sul-Coreano", "400 Réis - Réis").
   - O detalhamento artístico/temático ou efígie deve ser preenchido exclusivamente no campo "gravura" (ex: "Plano Piloto de Brasília", "Dom Pedro II", "Cruzeiro do Sul (1ª Família)").
3. CÓDIGOS DE CATÁLOGO OBRIGATÓRIOS (krause_id e numista_id):
   - Identifique e preencha sempre "krause_id" com o código Krause oficial para moedas (formato 'KM# 594') ou Pick para cédulas (formato 'P# 102').
   - Identifique e preencha sempre "numista_id" com o código correspondente no catálogo Numista (formato 'N# 4512').
4. Informe os dados metrológicos de catálogo (material, peso em gramas, diâmetro em mm e tipo de bordo).
5. Avalie o estado de conservação aparente (UTG, R, BC, MBC, SOB, FC ou Flor de Estampa) analisando desgaste dos pontos altos, brilho original, campos, bordas ou dobras.
6. Estime a faixa de valor de mercado praticada no mercado numismático brasileiro em Reais (BRL) para o estado de conservação observado.
7. REGRA CRÍTICA SOBRE VARIANTES E EIXO DE CUNHO: NUNCA tente diagnosticar falha de eixo ou orientação de cunho (como Reverso Invertido ou Reverso Horizontal) comparando a rotação das fotos de anverso e reverso, pois o usuário gira a câmera/moeda manualmente entre as fotos. Em vez disso, preencha "alertas_variantes_raras" como uma lista de sugestões inteligentes baseadas na base numismática oficial daquele ano/modelo para que o usuário teste fisicamente em mãos e marque na ficha interativa.
8. Em "alertas_conservacao", aponte sinais visíveis nas imagens (oxidação, zinabre, contaminação por PVC, limpeza mecânica/polimento, mossas no bordo, rasgos ou manchas de ferrugem de grampo) ou cuidados essenciais para o metal/papel da peça.
9. Em "curiosidades", escreva um texto rico e envolvente com contexto histórico, tiragem aproximada, simbologia do anverso/reverso e curiosidades numismáticas.
10. DETECÇÃO DE CAIXA DELIMITADORA (BOUNDING BOX) E ORIENTAÇÃO EM PÉ:
   - Para a imagem identificada como ANVERSO ("indice_anverso"), retorne "anverso_box": [ymin, xmin, ymax, xmax] na escala de 0 a 1000 delimitando estritamente a borda física externa da moeda (ignorando sombras projetadas na mesa/papel) e "anverso_rotation" (0, 90, 180 ou 270 graus no sentido horário) necessário para girar a foto e deixar o anverso perfeitamente "em pé" (topo da efígie/cabeça/brasão apontando para cima e leitura correta).
   - Para a imagem identificada como REVERSO ("indice_reverso"), retorne "reverso_box": [ymin, xmin, ymax, xmax] na escala de 0 a 1000 delimitando estritamente a borda física da moeda e "reverso_rotation" (0, 90, 180 ou 270 graus no sentido horário) necessário para deixar o reverso perfeitamente "em pé" (leitura horizontal natural do valor facial, data e legendas). Caso apenas 1 imagem tenha sido enviada, repita [0, 0, 1000, 1000] e 0 para o reverso.`;

const MAX_ATTEMPTS = 5;
const RETRY_DELAY_MS = 2000;
const CANDIDATE_MODELS = ["gemini-3.8-flash", "gemini-2.5-flash"];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRetryableNetworkOrServerError(err: unknown): boolean {
  const errText = err instanceof Error ? err.message : String(err);
  const statusCode = (err as { status?: number })?.status;
  return (
    statusCode === 503 ||
    statusCode === 502 ||
    statusCode === 504 ||
    statusCode === 429 ||
    errText.includes("503") ||
    errText.includes("502") ||
    errText.includes("504") ||
    errText.includes("429") ||
    errText.includes("UNAVAILABLE") ||
    errText.toLowerCase().includes("service unavailable") ||
    errText.toLowerCase().includes("overloaded") ||
    errText.toLowerCase().includes("fetch failed") ||
    errText.toLowerCase().includes("network") ||
    errText.toLowerCase().includes("econnreset") ||
    errText.toLowerCase().includes("etimedout")
  );
}

/**
 * Classifica as imagens unificadas de Anverso e Reverso usando o SDK oficial `@google/genai`,
 * autenticando via `process.env.GEMINI_API_KEY`, com validação por JSON Schema estruturado
 * e 5 tentativas automáticas (intervalo de 2s) para resiliência contra falhas de rede e erro 503.
 */
export async function classifyNumismaticImages(params: {
  imagesList: ClassifyImageInput[];
  observacoesIniciais?: string;
  localArmazenamentoInicial?: string;
}): Promise<NumismaticClassification> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "A variável de ambiente GEMINI_API_KEY não está configurada. Defina-a no arquivo .env.local."
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  const contents: Array<
    | { text: string }
    | { inlineData: { data: string; mimeType: string } }
  > = [
    {
      text: `Analise esta peça numismática para o catálogo UnderBed a partir de ${params.imagesList.length} imagem(ns) enviada(s) sem ordem pré-definida.
Identifique autonomamente qual imagem (Imagem #0${params.imagesList.length > 1 ? " ou Imagem #1" : ""}) corresponde ao ANVERSO e qual corresponde ao REVERSO, retornando os respectivos índices em "indice_anverso" e "indice_reverso".
Identifique também obrigatoriamente a "unidade_monetaria" (ex: 'Real', 'Cruzeiro', 'Réis', 'Won Sul-Coreano'), o código "krause_id" (ex: 'KM# 594' ou 'P# 102') e o "numista_id" (ex: 'N# 4512') desta peça.
Lembrete: Não avalie alinhamento/rotação de eixo entre as fotos; forneça em alertas_variantes_raras as variantes conhecidas na literatura numismática para este ano/modelo como sugestões verificáveis pelo colecionador.
${params.observacoesIniciais ? `Notas prévias informadas pelo colecionador: "${params.observacoesIniciais}".` : ""}
${params.localArmazenamentoInicial ? `Local de armazenamento informado pelo colecionador: "${params.localArmazenamentoInicial}".` : "Caso nenhum local físico tenha sido informado, preencha local_armazenamento com 'Não definido (Aguardando catalogação física)'."}`,
    },
  ];

  params.imagesList.slice(0, 2).forEach((img, index) => {
    contents.push({ text: `Imagem #${index}:` });
    contents.push({
      inlineData: {
        data: img.base64,
        mimeType: img.mimeType || "image/jpeg",
      },
    });
  });

  let modelIndex = 0;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const currentModel =
      CANDIDATE_MODELS[Math.min(modelIndex, CANDIDATE_MODELS.length - 1)];

    try {
      const response = await ai.models.generateContent({
        model: currentModel,
        contents,
        config: {
          systemInstruction: NUMISMATIC_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: NUMISMATIC_RESPONSE_SCHEMA,
          temperature: 0.2,
        },
      });

      const rawText = response?.text;
      if (!rawText) {
        throw new Error("O modelo Gemini retornou uma resposta vazia.");
      }

      const parsed = JSON.parse(rawText) as NumismaticClassification;
      parsed.anverso_box = sanitizeBoundingBox(parsed.anverso_box);
      parsed.anverso_rotation = sanitizeRotationAngle(parsed.anverso_rotation);
      parsed.reverso_box = sanitizeBoundingBox(parsed.reverso_box);
      parsed.reverso_rotation = sanitizeRotationAngle(parsed.reverso_rotation);
      return parsed;
    } catch (err) {
      lastError = err;
      const errText = err instanceof Error ? err.message : String(err);
      const isModelNotFound =
        errText.includes("404") ||
        errText.includes("NOT_FOUND") ||
        errText.toLowerCase().includes("no longer available");

      if (isModelNotFound && modelIndex < CANDIDATE_MODELS.length - 1) {
        modelIndex++;
        console.warn(
          `[UnderBed /api/classify] Modelo ${currentModel} indisponível (404). Alternando automaticamente para ${CANDIDATE_MODELS[modelIndex]} (tentativa ${attempt}/${MAX_ATTEMPTS})...`
        );
        continue;
      }

      if (isRetryableNetworkOrServerError(err) && attempt < MAX_ATTEMPTS) {
        console.warn(
          `[UnderBed /api/classify] Falha temporária (503/rede) na tentativa ${attempt}/${MAX_ATTEMPTS} (${currentModel}). Aguardando ${RETRY_DELAY_MS}ms para tentar novamente...`
        );
        await sleep(RETRY_DELAY_MS);
        continue;
      }

      throw err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Falha ao classificar a peça numismática após 5 tentativas.");
}

export const STANDARDIZE_IMAGE_SCHEMA: Schema = {
  type: Type.OBJECT,
  description:
    "Detecção de caixa delimitadora (bounding box 0-1000) da borda física da moeda e ângulo de rotação horário (0, 90, 180, 270) para deixar Anverso e Reverso perfeitamente em pé.",
  properties: {
    anverso_box: {
      type: Type.ARRAY,
      items: { type: Type.NUMBER },
      description:
        "Array de 4 números [ymin, xmin, ymax, xmax] na escala de 0 a 1000 delimitando estritamente a borda física da moeda no anverso (ignorando sombras projetadas no fundo branco/papel).",
    },
    anverso_rotation: {
      type: Type.INTEGER,
      description:
        "Ângulo inteiro (0, 90, 180 ou 270) no sentido horário necessário para deixar o anverso perfeitamente 'em pé' (alinhado pelo topo da efígie/brasão e leitura horizontal das legendas e datas).",
    },
    reverso_box: {
      type: Type.ARRAY,
      items: { type: Type.NUMBER },
      description:
        "Array de 4 números [ymin, xmin, ymax, xmax] (0 a 1000) delimitando estritamente a borda da moeda no reverso.",
    },
    reverso_rotation: {
      type: Type.INTEGER,
      description:
        "Ângulo inteiro (0, 90, 180 ou 270) no sentido horário necessário para deixar o reverso perfeitamente 'em pé'.",
    },
  },
  required: [
    "anverso_box",
    "anverso_rotation",
    "reverso_box",
    "reverso_rotation",
  ],
};

function parseBase64Input(raw?: string): {
  base64: string;
  mimeType: string;
} | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    return {
      mimeType: match[1] || "image/jpeg",
      base64: match[2],
    };
  }
  return {
    mimeType: "image/jpeg",
    base64: trimmed,
  };
}

export function sanitizeBoundingBox(
  box?: unknown
): [number, number, number, number] {
  if (!Array.isArray(box) || box.length < 4) {
    return [40, 40, 960, 960];
  }
  const nums = box.slice(0, 4).map((n) => {
    const v = Number(n);
    return Number.isFinite(v) ? Math.max(0, Math.min(1000, v)) : 0;
  });
  let [ymin, xmin, ymax, xmax] = nums;
  if (ymax <= ymin) {
    ymin = 40;
    ymax = 960;
  }
  if (xmax <= xmin) {
    xmin = 40;
    xmax = 960;
  }
  if (ymax - ymin < 80 || xmax - xmin < 80) {
    return [40, 40, 960, 960];
  }
  return [ymin, xmin, ymax, xmax];
}

export function sanitizeRotationAngle(angle?: unknown): number {
  const n = Math.round(Number(angle) || 0);
  const mod = ((n % 360) + 360) % 360;
  if (mod === 90 || mod === 180 || mod === 270) return mod;
  return 0;
}

/**
 * Analisa `anverso_image` e `reverso_image` via Gemini Vision e retorna a caixa delimitadora
 * `[ymin, xmin, ymax, xmax]` (0–1000) e o ângulo horário (`0`, `90`, `180`, `270`) para deixar cada face em pé.
 */
export async function standardizeCoinImages(params: {
  anverso_image?: string;
  reverso_image?: string;
}): Promise<StandardizeImageResponse> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "A variável de ambiente GEMINI_API_KEY não está configurada. Defina-a no arquivo .env.local."
    );
  }

  const anversoParsed = parseBase64Input(params.anverso_image);
  const reversoParsed = parseBase64Input(params.reverso_image);

  if (!anversoParsed && !reversoParsed) {
    throw new Error(
      "Envie pelo menos anverso_image ou reverso_image em Base64 para padronização."
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  const contents: Array<
    | { text: string }
    | { inlineData: { data: string; mimeType: string } }
  > = [
    {
      text: `Você é um sistema de visão computacional de precisão para numismática.
Analise cada face da moeda enviada (ANVERSO e REVERSO) e retorne:
1. "anverso_box": array de 4 números [ymin, xmin, ymax, xmax] na escala de 0 a 1000 delimitando estritamente a borda metálica externa física da moeda no ANVERSO, ignorando sombras projetadas na superfície/papel ao redor.
2. "anverso_rotation": ângulo inteiro (0, 90, 180 ou 270) no sentido HORÁRIO necessário para girar a imagem do ANVERSO para que a moeda fique perfeitamente 'em pé' (topo da efígie, busto, brasão ou símbolo principal apontando para o topo 12h e leitura horizontal correta das legendas/datas).
3. "reverso_box": array de 4 números [ymin, xmin, ymax, xmax] na escala de 0 a 1000 delimitando estritamente a borda metálica externa física da moeda no REVERSO, ignorando sombras projetadas no fundo.
4. "reverso_rotation": ângulo inteiro (0, 90, 180 ou 270) no sentido HORÁRIO necessário para girar a imagem do REVERSO para que fique perfeitamente 'em pé' (algarismos do valor facial, data e legendas alinhados na horizontal para leitura normal).
Se uma das faces não tiver sido enviada, retorne [0, 0, 1000, 1000] para sua box e 0 para sua rotação.`,
    },
  ];

  if (anversoParsed) {
    contents.push({ text: "Imagem do ANVERSO:" });
    contents.push({
      inlineData: {
        data: anversoParsed.base64,
        mimeType: anversoParsed.mimeType,
      },
    });
  } else {
    contents.push({ text: "Imagem do ANVERSO: Não enviada." });
  }

  if (reversoParsed) {
    contents.push({ text: "Imagem do REVERSO:" });
    contents.push({
      inlineData: {
        data: reversoParsed.base64,
        mimeType: reversoParsed.mimeType,
      },
    });
  } else {
    contents.push({ text: "Imagem do REVERSO: Não enviada." });
  }

  let modelIndex = 0;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const currentModel =
      CANDIDATE_MODELS[Math.min(modelIndex, CANDIDATE_MODELS.length - 1)];

    try {
      const response = await ai.models.generateContent({
        model: currentModel,
        contents,
        config: {
          responseMimeType: "application/json",
          responseSchema: STANDARDIZE_IMAGE_SCHEMA,
          temperature: 0.1,
        },
      });

      const rawText = response?.text;
      if (!rawText) {
        throw new Error("O modelo Gemini retornou uma resposta vazia.");
      }

      const parsed = JSON.parse(rawText) as Partial<StandardizeImageResponse>;
      return {
        anverso_box: sanitizeBoundingBox(parsed.anverso_box),
        anverso_rotation: sanitizeRotationAngle(parsed.anverso_rotation),
        reverso_box: sanitizeBoundingBox(parsed.reverso_box),
        reverso_rotation: sanitizeRotationAngle(parsed.reverso_rotation),
      };
    } catch (err) {
      lastError = err;
      const errText = err instanceof Error ? err.message : String(err);
      const isModelNotFound =
        errText.includes("404") ||
        errText.includes("NOT_FOUND") ||
        errText.toLowerCase().includes("no longer available");

      if (isModelNotFound && modelIndex < CANDIDATE_MODELS.length - 1) {
        modelIndex++;
        continue;
      }

      if (isRetryableNetworkOrServerError(err) && attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }

      throw err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Falha ao padronizar as imagens da moeda.");
}
