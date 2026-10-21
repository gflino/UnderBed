export interface ProcessedImage {
  dataUrl: string;
  base64: string;
  mimeType: string;
  thumbnailDataUrl: string;
}

/**
 * Redimensiona e comprime imagens capturadas pela câmera do celular (frequentemente 8MB–15MB)
 * para um tamanho otimizado para análise visual no Gemini (máx 1400px) e gera uma miniatura
 * compacta para persistência rápida no localStorage.
 */
export async function processCapturedImage(file: File): Promise<ProcessedImage> {
  const bitmap = await createImageBitmap(file);

  const renderResized = (maxDimension: number, quality: number): string => {
    const scale = Math.min(
      1,
      maxDimension / Math.max(bitmap.width, bitmap.height)
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Não foi possível inicializar o contexto 2D do canvas.");
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", quality);
  };

  const dataUrl = renderResized(1400, 0.86);
  const thumbnailDataUrl = renderResized(420, 0.72);
  const base64 = dataUrl.split(",")[1] ?? "";

  return {
    dataUrl,
    base64,
    mimeType: "image/jpeg",
    thumbnailDataUrl,
  };
}

