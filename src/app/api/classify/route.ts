import { NextRequest, NextResponse } from "next/server";
import {
  ClassifyImageInput,
  ClassifyRequestPayload,
} from "@/types/numismatics";
import { classifyNumismaticImages } from "@/lib/antigravity-ai";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ClassifyRequestPayload;

    // Normaliza lista unificada de imagens (suporta envio simultâneo em `imagens` ou campos legados)
    const imagesList: ClassifyImageInput[] = Array.isArray(body.imagens)
      ? body.imagens.filter((img) => Boolean(img?.base64))
      : [];

    if (imagesList.length === 0 && body.anversoBase64) {
      imagesList.push({
        base64: body.anversoBase64,
        mimeType: body.anversoMimeType || "image/jpeg",
      });
      if (body.reversoBase64) {
        imagesList.push({
          base64: body.reversoBase64,
          mimeType: body.reversoMimeType || "image/jpeg",
        });
      }
    }

    if (imagesList.length === 0) {
      return NextResponse.json(
        {
          error:
            "Envie pelo menos uma imagem (idealmente as 2 imagens de anverso e reverso juntas) para a classificação.",
        },
        { status: 400 }
      );
    }

    const parsed = await classifyNumismaticImages({
      imagesList,
      observacoesIniciais: body.observacoesIniciais,
      localArmazenamentoInicial: body.localArmazenamentoInicial,
    });

    // Sanitiza os índices de anverso e reverso determinados pela IA
    if (imagesList.length === 1) {
      parsed.indice_anverso = 0;
      parsed.indice_reverso = -1;
    } else {
      const idxAnverso = parsed.indice_anverso === 1 ? 1 : 0;
      const idxReverso =
        parsed.indice_reverso === 0 || parsed.indice_reverso === 1
          ? parsed.indice_reverso !== idxAnverso
            ? parsed.indice_reverso
            : idxAnverso === 0
              ? 1
              : 0
          : idxAnverso === 0
            ? 1
            : 0;
      parsed.indice_anverso = idxAnverso;
      parsed.indice_reverso = idxReverso;
    }

    if (body.observacoesIniciais && body.observacoesIniciais.trim()) {
      const userNote = body.observacoesIniciais.trim();
      if (!parsed.observacoes?.includes(userNote)) {
        parsed.observacoes = `${userNote} — Nota técnica IA: ${parsed.observacoes}`;
      }
    }
    if (
      body.localArmazenamentoInicial &&
      body.localArmazenamentoInicial.trim()
    ) {
      parsed.local_armazenamento = body.localArmazenamentoInicial.trim();
    }

    return NextResponse.json(parsed, { status: 200 });
  } catch (error) {
    console.error("Erro em /api/classify:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Falha inesperada ao classificar a peça numismática no UnderBed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
