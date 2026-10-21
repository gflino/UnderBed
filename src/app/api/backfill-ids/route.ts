import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Schema, Type } from "@google/genai";
import { isRetryableNetworkOrServerError } from "@/lib/antigravity-ai";

export interface BackfillCoinInput {
  id: string;
  nome: string;
  pais: string;
  ano: string | number;
  valor_facial: string;
  material?: string;
}

export interface BackfillCoinOutput {
  id: string;
  krause_id: string;
  numista_id: string;
  unidade_monetaria: string;
}

const backfillResponseSchema: Schema = {
  type: Type.ARRAY,
  description:
    "Lista de códigos de catálogo Krause/Pick (KM# ou P#), Numista (N#) e Unidade Monetária padronizada correspondentes a cada moeda/cédula enviada.",
  items: {
    type: Type.OBJECT,
    properties: {
      id: {
        type: Type.STRING,
        description: "O mesmo ID original do registro enviado na requisição.",
      },
      krause_id: {
        type: Type.STRING,
        description:
          "Código oficial Krause para moedas (ex: 'KM# 594') ou Pick para cédulas (ex: 'P# 102').",
      },
      numista_id: {
        type: Type.STRING,
        description:
          "Código oficial do catálogo Numista correspondente (ex: 'N# 4512').",
      },
      unidade_monetaria: {
        type: Type.STRING,
        description:
          "Nome padronizado da unidade monetária / padrão monetário (ex: 'Real', 'Cruzeiro', 'Cruzado', 'Réis', 'Dólar Americano', 'Won Sul-Coreano', 'Euro').",
      },
    },
    required: ["id", "krause_id", "numista_id", "unidade_monetaria"],
  },
};

const MAX_ATTEMPTS = 5;
const RETRY_DELAY_MS = 2000;
const CANDIDATE_MODELS = ["gemini-3.8-flash", "gemini-2.5-flash"];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY não configurada." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const items: BackfillCoinInput[] = Array.isArray(body)
      ? body
      : Array.isArray(body?.items)
        ? body.items
        : [];

    if (items.length === 0) {
      return NextResponse.json([], { status: 200 });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Você é um especialista nos catálogos Krause (Standard Catalog of World Coins / World Paper Money) e Numista.
Para cada peça numismática listada abaixo em JSON, identifique:
1. O código oficial Krause/Pick ("krause_id", ex: "KM# 594" para moedas ou "P# 102" para cédulas).
2. O código correspondente no Numista ("numista_id", ex: "N# 4512").
3. A unidade monetária / padrão monetário padronizado ("unidade_monetaria", ex: "Real", "Cruzeiro", "Cruzado Novo", "Réis", "Dólar Americano", "Won Sul-Coreano").
Preserve exatamente o mesmo campo "id" de cada item.

Peças para catalogação:
${JSON.stringify(items, null, 2)}`;

    let modelIndex = 0;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const currentModel =
        CANDIDATE_MODELS[Math.min(modelIndex, CANDIDATE_MODELS.length - 1)];

      try {
        const response = await ai.models.generateContent({
          model: currentModel,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: backfillResponseSchema,
            temperature: 0.1,
          },
        });

        const rawText = response?.text;
        if (!rawText) {
          throw new Error("Resposta vazia do Gemini em /api/backfill-ids.");
        }

        const parsed = JSON.parse(rawText) as BackfillCoinOutput[];
        return NextResponse.json(parsed, { status: 200 });
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
      : new Error("Falha ao preencher códigos KM#/Numista/UM.");
  } catch (error) {
    console.error("Erro em /api/backfill-ids:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Erro ao buscar códigos KM#, Numista e Unidade Monetária.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
