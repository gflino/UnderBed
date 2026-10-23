import { NextRequest, NextResponse } from "next/server";
import { StandardizeImageRequest } from "@/types/numismatics";
import { standardizeCoinImages } from "@/lib/antigravity-ai";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as StandardizeImageRequest;

    if (!body?.anverso_image && !body?.reverso_image) {
      return NextResponse.json(
        {
          error:
            "Envie pelo menos anverso_image ou reverso_image em Base64 para padronização.",
        },
        { status: 400 }
      );
    }

    const result = await standardizeCoinImages({
      anverso_image: body.anverso_image,
      reverso_image: body.reverso_image,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Erro em /api/standardize-image:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Falha inesperada ao detectar caixa delimitadora e orientação da moeda.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
