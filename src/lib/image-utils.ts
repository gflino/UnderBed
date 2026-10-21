export interface ProcessedImage {
  dataUrl: string;
  base64: string;
  mimeType: string;
  thumbnailDataUrl: string;
}

export const base64ToBlob = (base64: string): Blob => {
  const parts = base64.split(";base64,");
  const contentType = parts[0]?.split(":")[1] || "image/jpeg";
  const raw = window.atob(parts[1] || "");
  const uInt8Array = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }
  return new Blob([uInt8Array], { type: contentType });
};

export const autoCropAndCompressCoin = async (
  input: File | Blob | string,
  paddingPercent = 0.08,
  quality = 0.82
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const processDataUrl = (dataUrl: string) => {
      const img = new Image();
      img.onload = () => {
        const MAX_SIZE = 800;
        const scale = Math.min(1, MAX_SIZE / Math.max(img.width, img.height));
        const w = Math.max(1, Math.floor(img.width * scale));
        const h = Math.max(1, Math.floor(img.height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject("Falha ao criar contexto 2D");

        ctx.drawImage(img, 0, 0, w, h);
        const { data } = ctx.getImageData(0, 0, w, h);

        // 1. Mapa de gradiente local (detecta o relevo e a borda da moeda, ignorando sombras suaves da mesa)
        const edgeMap = new Float32Array(w * h);
        const step = 2;
        const samples: number[] = [];

        for (let y = step; y < h - step; y++) {
          for (let x = step; x < w - step; x++) {
            const idxL = (y * w + (x - step)) * 4;
            const idxR = (y * w + (x + step)) * 4;
            const idxU = ((y - step) * w + x) * 4;
            const idxD = ((y + step) * w + x) * 4;

            const gx =
              Math.abs(data[idxR] - data[idxL]) +
              Math.abs(data[idxR + 1] - data[idxL + 1]) +
              Math.abs(data[idxR + 2] - data[idxL + 2]);
            const gy =
              Math.abs(data[idxD] - data[idxU]) +
              Math.abs(data[idxD + 1] - data[idxU + 1]) +
              Math.abs(data[idxD + 2] - data[idxU + 2]);

            const mag = gx + gy;
            edgeMap[y * w + x] = mag;
            if (x % 4 === 0 && y % 4 === 0) samples.push(mag);
          }
        }

        // Calcula o ruído natural da mesa (mediana) e define o limiar de borda da moeda
        samples.sort((a, b) => a - b);
        const medianNoise = samples[Math.floor(samples.length * 0.5)] || 8;
        const edgeThreshold = Math.max(38, medianNoise * 3.8);

        // 2. Encontra o centro da moeda (centro de massa do relevo ponderado a partir do centro)
        let sumX = 0,
          sumY = 0,
          totalWeight = 0;
        const marginX = Math.floor(w * 0.04);
        const marginY = Math.floor(h * 0.04);

        for (let y = marginY; y < h - marginY; y++) {
          for (let x = marginX; x < w - marginX; x++) {
            const mag = edgeMap[y * w + x];
            if (mag > edgeThreshold) {
              // Peso maior para evitar que ruídos no extremo da foto puxem o centro
              const dx = (x - w / 2) / (w / 2);
              const dy = (y - h / 2) / (h / 2);
              const centerBias = Math.max(0.25, 1 - 0.5 * (dx * dx + dy * dy));
              const weight = (mag - edgeThreshold) * centerBias;
              sumX += x * weight;
              sumY += y * weight;
              totalWeight += weight;
            }
          }
        }

        if (totalWeight === 0) {
          resolve(canvas.toDataURL("image/webp", quality));
          return;
        }

        let cx = Math.round(sumX / totalWeight);
        let cy = Math.round(sumY / totalWeight);

        // Refina o centro focando na vizinhança da peça encontrada
        let refX = 0,
          refY = 0,
          refW = 0;
        const radiusSearch = Math.floor(Math.min(w, h) * 0.4);
        for (
          let y = Math.max(marginY, cy - radiusSearch);
          y < Math.min(h - marginY, cy + radiusSearch);
          y++
        ) {
          for (
            let x = Math.max(marginX, cx - radiusSearch);
            x < Math.min(w - marginX, cx + radiusSearch);
            x++
          ) {
            const mag = edgeMap[y * w + x];
            if (mag > edgeThreshold) {
              refX += x * mag;
              refY += y * mag;
              refW += mag;
            }
          }
        }
        if (refW > 0) {
          cx = Math.round(refX / refW);
          cy = Math.round(refY / refW);
        }

        // 3. Expansão do centro para fora (Cima, Baixo, Esquerda, Direita) até o fim da borda da moeda
        const initR = Math.max(8, Math.floor(Math.min(w, h) * 0.05));
        let left = Math.max(marginX, cx - initR);
        let right = Math.min(w - 1 - marginX, cx + initR);
        let top = Math.max(marginY, cy - initR);
        let bottom = Math.min(h - 1 - marginY, cy + initR);

        // Tolerância de espaço liso interno antes de decretar que chegou na mesa vazia
        const maxGapX = Math.max(6, Math.floor(w * 0.045));
        const maxGapY = Math.max(6, Math.floor(h * 0.045));
        const minHits = 2;

        const rowHasEdge = (y: number, x1: number, x2: number) => {
          let hits = 0;
          for (let x = x1; x <= x2; x++) {
            if (edgeMap[y * w + x] > edgeThreshold) {
              hits++;
              if (hits >= minHits) return true;
            }
          }
          return false;
        };

        const colHasEdge = (x: number, y1: number, y2: number) => {
          let hits = 0;
          for (let y = y1; y <= y2; y++) {
            if (edgeMap[y * w + x] > edgeThreshold) {
              hits++;
              if (hits >= minHits) return true;
            }
          }
          return false;
        };

        // Faz 2 passadas de expansão cruzada para garantir que a largura e altura abracem toda a circunferência
        for (let pass = 0; pass < 2; pass++) {
          // Expande para a Esquerda
          let gap = 0;
          for (let x = left; x >= marginX; x--) {
            if (colHasEdge(x, top, bottom)) {
              left = x;
              gap = 0;
            } else {
              gap++;
              if (gap > maxGapX) break;
            }
          }
          // Expande para a Direita
          gap = 0;
          for (let x = right; x < w - marginX; x++) {
            if (colHasEdge(x, top, bottom)) {
              right = x;
              gap = 0;
            } else {
              gap++;
              if (gap > maxGapX) break;
            }
          }
          // Expande para Cima
          gap = 0;
          for (let y = top; y >= marginY; y--) {
            if (rowHasEdge(y, left, right)) {
              top = y;
              gap = 0;
            } else {
              gap++;
              if (gap > maxGapY) break;
            }
          }
          // Expande para Baixo
          gap = 0;
          for (let y = bottom; y < h - marginY; y++) {
            if (rowHasEdge(y, left, right)) {
              bottom = y;
              gap = 0;
            } else {
              gap++;
              if (gap > maxGapY) break;
            }
          }
        }

        const detW = right - left;
        const detH = bottom - top;

        if (detW < w * 0.08 || detH < h * 0.08) {
          resolve(canvas.toDataURL("image/webp", quality));
          return;
        }

        // 4. Dá a folga (padding) e corta centralizado no objeto detectado
        const padX = detW * paddingPercent;
        const padY = detH * paddingPercent;
        const cropX = Math.max(0, Math.floor(left - padX));
        const cropY = Math.max(0, Math.floor(top - padY));
        const cropW = Math.min(w - cropX, Math.ceil(detW + padX * 2));
        const cropH = Math.min(h - cropY, Math.ceil(detH + padY * 2));

        const finalCanvas = document.createElement("canvas");
        finalCanvas.width = cropW;
        finalCanvas.height = cropH;
        const finalCtx = finalCanvas.getContext("2d");
        if (!finalCtx) return resolve(canvas.toDataURL("image/webp", quality));

        finalCtx.drawImage(
          canvas,
          cropX,
          cropY,
          cropW,
          cropH,
          0,
          0,
          cropW,
          cropH
        );
        resolve(finalCanvas.toDataURL("image/webp", quality));
      };
      img.onerror = (err) => reject(err);
      img.src = dataUrl;
    };

    if (typeof input === "string") {
      processDataUrl(input);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => processDataUrl(e.target?.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(input);
    }
  });
};

export function createProcessedImageFromWebp(
  webpDataUrl: string
): ProcessedImage {
  const commaIdx = webpDataUrl.indexOf(",");
  const base64 =
    commaIdx !== -1 ? webpDataUrl.slice(commaIdx + 1) : webpDataUrl;
  const mimeMatch = webpDataUrl.match(/^data:([^;]+);base64,/);
  const mimeType = mimeMatch?.[1] || "image/webp";

  return {
    dataUrl: webpDataUrl,
    base64,
    mimeType,
    thumbnailDataUrl: webpDataUrl,
  };
}

export async function processCapturedImage(
  file: File | Blob
): Promise<ProcessedImage> {
  const webpDataUrl = await autoCropAndCompressCoin(file);
  return createProcessedImageFromWebp(webpDataUrl);
}
