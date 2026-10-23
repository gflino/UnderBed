function normalizeDataUrl(base64Image: string): string {
  const trimmed = base64Image.trim();
  if (trimmed.startsWith("data:image/")) {
    return trimmed;
  }
  return `data:image/jpeg;base64,${trimmed}`;
}

function computeBorderAverageColor(img: HTMLImageElement): string {
  try {
    const sampleCanvas = document.createElement("canvas");
    const sw = Math.min(120, Math.max(8, img.width));
    const sh = Math.min(120, Math.max(8, img.height));
    sampleCanvas.width = sw;
    sampleCanvas.height = sh;
    const sCtx = sampleCanvas.getContext("2d");
    if (!sCtx) return "#f8fafc";

    sCtx.drawImage(img, 0, 0, sw, sh);
    const { data } = sCtx.getImageData(0, 0, sw, sh);

    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let count = 0;

    const addPixel = (x: number, y: number) => {
      const idx = (y * sw + x) * 4;
      rSum += data[idx];
      gSum += data[idx + 1];
      bSum += data[idx + 2];
      count++;
    };

    for (let x = 0; x < sw; x++) {
      addPixel(x, 0);
      addPixel(x, sh - 1);
    }
    for (let y = 1; y < sh - 1; y++) {
      addPixel(0, y);
      addPixel(sw - 1, y);
    }

    if (count === 0) return "#f8fafc";
    const r = Math.round(rSum / count);
    const g = Math.round(gSum / count);
    const b = Math.round(bSum / count);
    return `rgb(${r}, ${g}, ${b})`;
  } catch {
    return "#f8fafc";
  }
}

/**
 * Recorta rente à moeda em formato quadrado 1:1 (600x600px) centralizado com 4% de margem
 * em cada lado (`cropSize = diameter * 1.08`) e aplica a rotação física no Canvas
 * para deixar a moeda perfeitamente "em pé", exportando em JPEG (qualidade 0.85).
 */
export function cropCenterAndRotateCoin(
  base64Image: string,
  box: [number, number, number, number],
  rotationDeg: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!base64Image || typeof base64Image !== "string") {
      return reject(new Error("Imagem Base64 inválida para padronização."));
    }

    const img = new Image();
    img.onload = () => {
      try {
        const rawBox =
          Array.isArray(box) && box.length === 4 ? box : [40, 40, 960, 960];
        const ymin = Math.max(0, Math.min(1000, Number(rawBox[0]) || 0));
        const xmin = Math.max(0, Math.min(1000, Number(rawBox[1]) || 0));
        const ymax = Math.max(0, Math.min(1000, Number(rawBox[2]) || 1000));
        const xmax = Math.max(0, Math.min(1000, Number(rawBox[3]) || 1000));

        const top = (ymin / 1000) * img.height;
        const left = (xmin / 1000) * img.width;
        const bottom =
          ymax > ymin ? (ymax / 1000) * img.height : img.height * 0.96;
        const right = xmax > xmin ? (xmax / 1000) * img.width : img.width * 0.96;

        const cx = (left + right) / 2;
        const cy = (top + bottom) / 2;
        const diameter = Math.max(right - left, bottom - top, 16);
        const cropSize = diameter * 1.08;

        const canvas = document.createElement("canvas");
        canvas.width = 600;
        canvas.height = 600;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return reject(
            new Error("Não foi possível criar o contexto 2D do Canvas.")
          );
        }

        // Preenche o fundo com a cor média das bordas da imagem original
        ctx.fillStyle = computeBorderAverageColor(img);
        ctx.fillRect(0, 0, 600, 600);

        const cleanRotation = (((Number(rotationDeg) || 0) % 360) + 360) % 360;

        ctx.save();
        ctx.translate(300, 300);
        ctx.rotate((cleanRotation * Math.PI) / 180);
        ctx.translate(-300, -300);

        const sx = cx - cropSize / 2;
        const sy = cy - cropSize / 2;
        const scale = 600 / cropSize;

        // Garante desenho seguro mesmo quando a área de corte com respiro (1.08)
        // ultrapassa ligeiramente os limites da fotografia original
        const clampedSx = Math.max(0, sx);
        const clampedSy = Math.max(0, sy);
        const clampedRight = Math.min(img.width, sx + cropSize);
        const clampedBottom = Math.min(img.height, sy + cropSize);
        const clampedSw = Math.max(1, clampedRight - clampedSx);
        const clampedSh = Math.max(1, clampedBottom - clampedSy);

        const dx = (clampedSx - sx) * scale;
        const dy = (clampedSy - sy) * scale;
        const dw = clampedSw * scale;
        const dh = clampedSh * scale;

        ctx.drawImage(
          img,
          clampedSx,
          clampedSy,
          clampedSw,
          clampedSh,
          dx,
          dy,
          dw,
          dh
        );
        ctx.restore();

        resolve(canvas.toDataURL("image/jpeg", 0.85));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = (err) => reject(err);
    img.src = normalizeDataUrl(base64Image);
  });
}

/**
 * Gira fisicamente uma imagem Base64 em múltiplos de 90° diretamente no Canvas (600x600)
 * e retorna o novo Base64 JPEG comprimido (0.85), evitando qualquer necessidade de rotação CSS.
 */
export function rotateBase64Image(
  base64Image: string,
  deltaDeg: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!base64Image || typeof base64Image !== "string") {
      return reject(new Error("Imagem Base64 inválida para rotação."));
    }

    const img = new Image();
    img.onload = () => {
      try {
        const size = 600;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return reject(
            new Error("Não foi possível criar o contexto 2D do Canvas.")
          );
        }

        ctx.fillStyle = computeBorderAverageColor(img);
        ctx.fillRect(0, 0, size, size);

        const cleanAngle = (((Number(deltaDeg) || 0) % 360) + 360) % 360;
        ctx.save();
        ctx.translate(300, 300);
        ctx.rotate((cleanAngle * Math.PI) / 180);
        ctx.translate(-300, -300);
        ctx.drawImage(img, 0, 0, size, size);
        ctx.restore();

        resolve(canvas.toDataURL("image/jpeg", 0.85));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = (err) => reject(err);
    img.src = normalizeDataUrl(base64Image);
  });
}
