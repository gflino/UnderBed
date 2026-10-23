"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  X,
  Check,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
  Move,
  RefreshCw,
  Crop,
} from "lucide-react";

interface CoinCropperModalProps {
  isOpen: boolean;
  imageSrc: string;
  sideLabel: string;
  onClose: () => void;
  onSaveCrop: (croppedBase64: string) => Promise<void> | void;
}

const CANVAS_SIZE = 600;
// Raio do círculo de referência com 4% de margem de respiro (300 / 1.08 ≈ 278px)
const GUIDE_CIRCLE_RADIUS = Math.round(CANVAS_SIZE / 2 / 1.08);

function computeAverageBorderFill(img: HTMLImageElement): string {
  try {
    const sample = document.createElement("canvas");
    const sw = Math.min(80, Math.max(8, img.width));
    const sh = Math.min(80, Math.max(8, img.height));
    sample.width = sw;
    sample.height = sh;
    const sCtx = sample.getContext("2d");
    if (!sCtx) return "#f8fafc";
    sCtx.drawImage(img, 0, 0, sw, sh);
    const { data } = sCtx.getImageData(0, 0, sw, sh);

    let r = 0,
      g = 0,
      b = 0,
      count = 0;

    const add = (x: number, y: number) => {
      const i = (y * sw + x) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count++;
    };

    for (let x = 0; x < sw; x++) {
      add(x, 0);
      add(x, sh - 1);
    }
    for (let y = 1; y < sh - 1; y++) {
      add(0, y);
      add(sw - 1, y);
    }

    if (count === 0) return "#f8fafc";
    return `rgb(${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(
      b / count
    )})`;
  } catch {
    return "#f8fafc";
  }
}

export function CoinCropperModal({
  isOpen,
  imageSrc,
  sideLabel,
  onClose,
  onSaveCrop,
}: CoinCropperModalProps) {
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);
  const bgColorRef = useRef<string>("#f8fafc");

  const [isImageReady, setIsImageReady] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    panX: number;
    panY: number;
  } | null>(null);

  // Carrega a imagem no elemento HTMLImageElement ao abrir o modal
  useEffect(() => {
    if (!isOpen || !imageSrc) return;
    setIsImageReady(false);

    const img = new Image();
    img.onload = () => {
      loadedImageRef.current = img;
      bgColorRef.current = computeAverageBorderFill(img);
      setZoom(1);
      setRotation(0);
      setPan({ x: 0, y: 0 });
      setIsImageReady(true);
    };
    img.src = imageSrc.startsWith("data:image/")
      ? imageSrc
      : `data:image/jpeg;base64,${imageSrc}`;
  }, [isOpen, imageSrc]);

  // Renderiza a imagem transformada no contexto 2D especificado
  const renderTransformedCoin = (
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement
  ) => {
    ctx.fillStyle = bgColorRef.current;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const baseScale = Math.max(
      CANVAS_SIZE / Math.max(1, img.width),
      CANVAS_SIZE / Math.max(1, img.height)
    );
    const drawW = img.width * baseScale;
    const drawH = img.height * baseScale;

    ctx.save();
    ctx.translate(CANVAS_SIZE / 2 + pan.x, CANVAS_SIZE / 2 + pan.y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  };

  // Atualiza o canvas de pré-visualização com a máscara circular sobreposta
  useEffect(() => {
    if (!isOpen || !isImageReady) return;
    const canvas = previewCanvasRef.current;
    const img = loadedImageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    renderTransformedCoin(ctx, img);

    // Desenha a máscara visual circular escura ao redor da moeda para referência
    ctx.save();
    ctx.fillStyle = "rgba(2, 6, 23, 0.58)";
    ctx.beginPath();
    ctx.rect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.arc(
      CANVAS_SIZE / 2,
      CANVAS_SIZE / 2,
      GUIDE_CIRCLE_RADIUS,
      0,
      Math.PI * 2,
      true
    );
    ctx.fill();

    // Linha de eixo vertical e horizontal sutil para alinhar efígie/legendas em pé
    ctx.strokeStyle = "rgba(251, 191, 36, 0.25)";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(CANVAS_SIZE / 2, CANVAS_SIZE / 2 - GUIDE_CIRCLE_RADIUS);
    ctx.lineTo(CANVAS_SIZE / 2, CANVAS_SIZE / 2 + GUIDE_CIRCLE_RADIUS);
    ctx.moveTo(CANVAS_SIZE / 2 - GUIDE_CIRCLE_RADIUS, CANVAS_SIZE / 2);
    ctx.lineTo(CANVAS_SIZE / 2 + GUIDE_CIRCLE_RADIUS, CANVAS_SIZE / 2);
    ctx.stroke();

    // Círculo tracejado dourado de encaixe da borda da moeda
    ctx.strokeStyle = "rgba(251, 191, 36, 0.92)";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([10, 6]);
    ctx.beginPath();
    ctx.arc(
      CANVAS_SIZE / 2,
      CANVAS_SIZE / 2,
      GUIDE_CIRCLE_RADIUS,
      0,
      Math.PI * 2
    );
    ctx.stroke();
    ctx.restore();
  }, [isOpen, isImageReady, zoom, rotation, pan]);

  if (!isOpen) return null;

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging || !dragStartRef.current || !previewCanvasRef.current) {
      return;
    }
    const rect = previewCanvasRef.current.getBoundingClientRect();
    const scaleFactor = CANVAS_SIZE / Math.max(1, rect.width);
    const dx = (e.clientX - dragStartRef.current.clientX) * scaleFactor;
    const dy = (e.clientY - dragStartRef.current.clientY) * scaleFactor;
    setPan({
      x: Math.round(dragStartRef.current.panX + dx),
      y: Math.round(dragStartRef.current.panY + dy),
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsDragging(false);
    dragStartRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    setZoom((prev) =>
      Math.max(0.4, Math.min(4, Number((prev + delta).toFixed(2))))
    );
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  };

  const handleConfirmCrop = async () => {
    const img = loadedImageRef.current;
    if (!img) return;
    setIsSaving(true);
    try {
      const outputCanvas = document.createElement("canvas");
      outputCanvas.width = CANVAS_SIZE;
      outputCanvas.height = CANVAS_SIZE;
      const outCtx = outputCanvas.getContext("2d");
      if (!outCtx) return;

      // Renderiza a imagem final limpa 600x600 (sem as linhas guias da máscara)
      renderTransformedCoin(outCtx, img);

      const finalBase64 = outputCanvas.toDataURL("image/jpeg", 0.88);
      await onSaveCrop(finalBase64);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
        {/* Cabeçalho do Modal */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
              <Crop className="h-3 w-3" />
              Ajuste e Corte Manual 1:1 (600×600)
            </span>
            <h3 className="mt-1 text-base font-bold text-slate-100">
              Ajustar {sideLabel}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Arraste a imagem e ajuste o zoom e a rotação para encaixar a borda
              da moeda no círculo tracejado:
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Área do Canvas Interativo com Máscara Circular */}
        <div className="mt-4 flex flex-col items-center">
          <div className="relative aspect-square w-full max-w-[320px] overflow-hidden rounded-2xl border border-amber-500/40 bg-slate-950 shadow-inner">
            <canvas
              ref={previewCanvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onWheel={handleWheel}
              className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
            />
            <div className="pointer-events-none absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-lg bg-slate-950/80 px-2 py-1 text-[10px] font-medium text-slate-300">
              <Move className="h-3 w-3 text-amber-400" />
              Arraste para centralizar
            </div>
          </div>
        </div>

        {/* Controles de Zoom e Rotação */}
        <div className="mt-4 space-y-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-3.5">
          {/* Controle de Zoom */}
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-slate-300">
                <ZoomIn className="h-3.5 w-3.5 text-amber-400" />
                Zoom
              </span>
              <span className="font-mono text-[11px] text-amber-300">
                {Math.round(zoom * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setZoom((z) => Math.max(0.4, Number((z - 0.1).toFixed(2))))
                }
                className="rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-300 hover:border-amber-500/40 hover:text-amber-300"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <input
                type="range"
                min={0.4}
                max={4}
                step={0.02}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="h-1.5 flex-1 cursor-pointer accent-amber-500"
              />
              <button
                type="button"
                onClick={() =>
                  setZoom((z) => Math.min(4, Number((z + 0.1).toFixed(2))))
                }
                className="rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-300 hover:border-amber-500/40 hover:text-amber-300"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Controle de Rotação */}
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-slate-300">
                <RotateCw className="h-3.5 w-3.5 text-amber-400" />
                Rotação Fina
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setRotation((r) => {
                      const next = r - 90;
                      return next < -180 ? next + 360 : next;
                    })
                  }
                  className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-slate-300 hover:border-amber-500/40 hover:text-amber-300"
                >
                  -90°
                </button>
                <button
                  type="button"
                  onClick={() => setRotation(0)}
                  className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-slate-300 hover:border-amber-500/40 hover:text-amber-300"
                >
                  0°
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setRotation((r) => {
                      const next = r + 90;
                      return next > 180 ? next - 360 : next;
                    })
                  }
                  className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-slate-300 hover:border-amber-500/40 hover:text-amber-300"
                >
                  +90°
                </button>
                <span className="ml-1 font-mono text-[11px] text-amber-300">
                  {rotation}°
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRotation((r) => Math.max(-180, r - 1))}
                className="rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-300 hover:border-amber-500/40 hover:text-amber-300"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <input
                type="range"
                min={-180}
                max={180}
                step={1}
                value={rotation}
                onChange={(e) => setRotation(Number(e.target.value))}
                className="h-1.5 flex-1 cursor-pointer accent-amber-500"
              />
              <button
                type="button"
                onClick={() => setRotation((r) => Math.min(180, r + 1))}
                className="rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-300 hover:border-amber-500/40 hover:text-amber-300"
              >
                <RotateCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Rodapé de Ações */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-3">
          <button
            type="button"
            onClick={handleReset}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Resetar
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmCrop}
              disabled={isSaving || !isImageReady}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              Salvar Ajuste
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
