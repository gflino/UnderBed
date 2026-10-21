"use client";

import React, { useRef, useState } from "react";
import {
  Camera,
  Upload,
  Sparkles,
  RotateCcw,
  Archive,
  FileText,
  Loader2,
  ArrowLeftRight,
  Check,
  ArrowLeft,
  X,
  Images,
} from "lucide-react";
import {
  ProcessedImage,
  autoCropAndCompressCoin,
  createProcessedImageFromWebp,
} from "@/lib/image-utils";
import { NumismaticClassification } from "@/types/numismatics";

export interface PendingClassificationPreview {
  classification: NumismaticClassification;
  anversoImage?: ProcessedImage;
  reversoImage?: ProcessedImage;
}

interface CoinCaptureProps {
  onAnalyzeImages: (payload: {
    images: ProcessedImage[];
    observacoesIniciais: string;
    localArmazenamentoInicial: string;
  }) => Promise<NumismaticClassification>;
  onConfirmSave: (preview: PendingClassificationPreview) => Promise<void>;
  onLoadDemo: () => void;
  isLoading: boolean;
}

export function CoinCapture({
  onAnalyzeImages,
  onConfirmSave,
  onLoadDemo,
  isLoading,
}: CoinCaptureProps) {
  const [selectedImages, setSelectedImages] = useState<ProcessedImage[]>([]);
  const [localArmazenamento, setLocalArmazenamento] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [previewState, setPreviewState] =
    useState<PendingClassificationPreview | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const unifiedMultiInputRef = useRef<HTMLInputElement>(null);
  const cameraQuickInputRef = useRef<HTMLInputElement>(null);

  /**
   * Processa obrigatoriamente qualquer imagem (seja do gerenciador de arquivos do PC,
   * drag-and-drop ou câmera mobile) passando por `autoCropAndCompressCoin` antes de salvar no estado.
   */
  const handleImageCapture = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    setErrorMsg(null);
    setPreviewState(null);
    setIsProcessingFiles(true);

    try {
      const incomingFiles = Array.from(files).filter((file) =>
        file.type.startsWith("image/") || /\.(jpe?g|png|webp|bmp|heic)$/i.test(file.name)
      );
      if (incomingFiles.length === 0) {
        throw new Error("Selecione apenas arquivos de imagem válidos.");
      }

      const remainingSlots = Math.max(0, 2 - selectedImages.length);
      const filesToProcess =
        incomingFiles.length >= 2
          ? incomingFiles.slice(0, 2)
          : incomingFiles.slice(0, Math.max(1, remainingSlots));

      const processedBatch: ProcessedImage[] = [];
      for (const file of filesToProcess) {
        const webpBase64DataUrl = await autoCropAndCompressCoin(file);
        processedBatch.push(createProcessedImageFromWebp(webpBase64DataUrl));
      }

      setSelectedImages((prev) => {
        if (incomingFiles.length >= 2 || prev.length >= 2) {
          return processedBatch.slice(0, 2);
        }
        return [...prev, ...processedBatch].slice(0, 2);
      });
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Erro ao recortar e comprimir as fotografias selecionadas."
      );
    } finally {
      setIsProcessingFiles(false);
      if (unifiedMultiInputRef.current) unifiedMultiInputRef.current.value = "";
      if (cameraQuickInputRef.current) cameraQuickInputRef.current.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      await handleImageCapture(e.dataTransfer.files);
    }
  };

  const handleRemoveImage = (index: number) => {
    setPreviewState(null);
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleReset = () => {
    setSelectedImages([]);
    setPreviewState(null);
    setErrorMsg(null);
  };

  const handleAnalyzeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedImages.length === 0) {
      setErrorMsg(
        "Selecione ou capture as imagens da peça (1 ou 2 fotos) para continuar."
      );
      return;
    }

    setErrorMsg(null);
    try {
      const result = await onAnalyzeImages({
        images: selectedImages,
        observacoesIniciais: observacoes,
        localArmazenamentoInicial: localArmazenamento,
      });

      const idxAnverso =
        typeof result.indice_anverso === "number" &&
        selectedImages[result.indice_anverso]
          ? result.indice_anverso
          : 0;

      const idxReverso =
        selectedImages.length > 1
          ? typeof result.indice_reverso === "number" &&
            result.indice_reverso >= 0 &&
            result.indice_reverso !== idxAnverso &&
            selectedImages[result.indice_reverso]
            ? result.indice_reverso
            : idxAnverso === 0
              ? 1
              : 0
          : -1;

      setPreviewState({
        classification: result,
        anversoImage: selectedImages[idxAnverso],
        reversoImage: idxReverso >= 0 ? selectedImages[idxReverso] : undefined,
      });
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Falha ao analisar as imagens com a IA."
      );
    }
  };

  const handleSwapSides = () => {
    if (!previewState) return;
    setPreviewState({
      ...previewState,
      anversoImage: previewState.reversoImage,
      reversoImage: previewState.anversoImage,
    });
  };

  const handleConfirmAndSave = async () => {
    if (!previewState) return;
    setIsSaving(true);
    try {
      await onConfirmSave(previewState);
      setPreviewState(null);
      setSelectedImages([]);
      setLocalArmazenamento("");
      setObservacoes("");
    } finally {
      setIsSaving(false);
    }
  };

  // Etapa 2: Tela de Pré-visualização de Lados enxuta e minimalista
  if (previewState) {
    const { anversoImage, reversoImage } = previewState;

    return (
      <div className="space-y-4 pb-6">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setPreviewState(null)}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-amber-500/40 hover:text-amber-300"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </button>

            {anversoImage && reversoImage && (
              <button
                type="button"
                onClick={handleSwapSides}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/25"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
                Inverter Lados
              </button>
            )}
          </div>

          {/* Imagens do Anverso (Cara) e Reverso (Coroa) */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-amber-500/40 bg-slate-950 p-3 text-center">
              <span className="mb-2 inline-block rounded-lg bg-amber-500 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-950">
                Anverso (Cara)
              </span>
              {anversoImage ? (
                <img
                  src={anversoImage.dataUrl}
                  alt="Anverso (Cara)"
                  className="mx-auto h-40 w-full rounded-xl object-contain sm:h-48"
                />
              ) : (
                <div className="flex h-40 items-center justify-center text-xs text-slate-500 sm:h-48">
                  Sem imagem
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-indigo-500/40 bg-slate-950 p-3 text-center">
              <span className="mb-2 inline-block rounded-lg bg-indigo-500 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
                Reverso (Coroa)
              </span>
              {reversoImage ? (
                <img
                  src={reversoImage.dataUrl}
                  alt="Reverso (Coroa)"
                  className="mx-auto h-40 w-full rounded-xl object-contain sm:h-48"
                />
              ) : (
                <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-800 text-xs text-slate-500 sm:h-48">
                  Sem imagem
                </div>
              )}
            </div>
          </div>

          {/* Botão de Validação Padronizado */}
          <div className="mt-5">
            <button
              type="button"
              onClick={handleConfirmAndSave}
              disabled={isSaving}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 px-5 py-3.5 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/20 transition hover:from-amber-400 hover:to-yellow-400 disabled:opacity-50"
            >
              <Check className="h-5 w-5" />
              Confirmar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Etapa 1: Tela Principal Minimalista
  return (
    <form onSubmit={handleAnalyzeSubmit} className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`rounded-3xl border p-5 shadow-lg transition ${
          isDraggingOver
            ? "border-amber-400 bg-amber-500/10"
            : "border-slate-800 bg-slate-900/90"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
            Fotos da Peça ({selectedImages.length}/2)
          </span>
          {selectedImages.length > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-700/80 bg-slate-800/80 px-2.5 py-1 text-xs text-slate-300 transition hover:border-amber-500/40 hover:text-amber-300"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Limpar
            </button>
          )}
        </div>

        {/* Botão Único de Seleção Múltipla */}
        <div className="mt-3 flex flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={() => unifiedMultiInputRef.current?.click()}
            disabled={isProcessingFiles || isLoading}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-xs font-bold text-slate-950 shadow-md transition active:scale-[0.99] hover:bg-amber-400 disabled:opacity-50"
          >
            {isProcessingFiles ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Images className="h-4 w-4" />
            )}
            <span>
              {selectedImages.length === 0
                ? "Selecionar Fotos (Anverso e Reverso)"
                : selectedImages.length === 1
                  ? "Adicionar 2ª Foto"
                  : "Trocar Fotos"}
            </span>
          </button>

          {selectedImages.length < 2 && (
            <button
              type="button"
              onClick={() => cameraQuickInputRef.current?.click()}
              disabled={isProcessingFiles || isLoading}
              className="flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-800/90 px-4 py-3 text-xs font-semibold text-slate-200 transition hover:border-amber-500/40 hover:text-amber-300"
            >
              <Camera className="h-4 w-4 text-amber-400" />
              <span>Câmera ({selectedImages.length + 1}/2)</span>
            </button>
          )}
        </div>

        <input
          ref={unifiedMultiInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleImageCapture(e.target.files)}
        />
        <input
          ref={cameraQuickInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleImageCapture(e.target.files)}
        />

        {/* Dica de UX para recorte automático por contraste */}
        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
          Para uma melhor identificação, fotografe a moeda sobre uma superfície
          lisa e com cor que contraste com a peça (ex: folha branca ou mesa
          escura).
        </p>

        {/* Miniaturas Selecionadas (Recortadas em WebP mantendo proporção do objeto) */}
        {selectedImages.length > 0 ? (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {selectedImages.map((img, idx) => (
              <div
                key={idx}
                className="group relative overflow-hidden rounded-2xl border border-amber-500/30 bg-slate-950 p-2"
              >
                <div className="mb-1 flex items-center justify-between px-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                    Foto #{idx + 1} (WebP)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(idx)}
                    className="rounded-lg p-1 text-slate-400 transition hover:bg-rose-500/20 hover:text-rose-300"
                    title="Remover foto"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <img
                  src={img.dataUrl}
                  alt={`Foto ${idx + 1}`}
                  className="mx-auto h-36 w-full rounded-xl object-contain sm:h-44"
                />
              </div>
            ))}

            {selectedImages.length === 1 && (
              <button
                type="button"
                onClick={() => unifiedMultiInputRef.current?.click()}
                className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-700/80 bg-slate-950/50 p-4 text-center text-xs text-slate-400 transition hover:border-amber-500/40 hover:text-amber-300"
              >
                <Upload className="mb-1.5 h-5 w-5 text-amber-400" />
                <span className="font-semibold">Adicionar 2ª face</span>
              </button>
            )}
          </div>
        ) : (
          <div
            onClick={() => unifiedMultiInputRef.current?.click()}
            className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-800 bg-slate-950/50 px-4 py-8 text-center transition hover:border-amber-500/40"
          >
            <Images className="mb-2 h-7 w-7 text-amber-400" />
            <p className="text-xs font-medium text-slate-300">
              Toque ou arraste as fotos do Anverso e Reverso para cá
            </p>
          </div>
        )}
      </div>

      {/* Dados Físicos Opcionais */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs text-slate-300">
              <Archive className="h-3.5 w-3.5 text-amber-400" />
              Local de Armazenamento
            </label>
            <input
              type="text"
              value={localArmazenamento}
              onChange={(e) => setLocalArmazenamento(e.target.value)}
              placeholder="Ex: Álbum 01 - Folha 02 - Slot B4"
              className="w-full rounded-xl border border-slate-700/80 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs text-slate-300">
              <FileText className="h-3.5 w-3.5 text-amber-400" />
              Observações do Exemplar
            </label>
            <input
              type="text"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Notas opcionais sobre a peça"
              className="w-full rounded-xl border border-slate-700/80 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
          {errorMsg}
        </div>
      )}

      {/* Botão Principal Padronizado: 'Identificar Lados' */}
      <div className="flex flex-col gap-2.5">
        <button
          type="submit"
          disabled={selectedImages.length === 0 || isLoading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 px-5 py-3.5 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/20 transition hover:from-amber-400 hover:to-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Identificando Lados...
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5" />
              Identificar Lados
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onLoadDemo}
          disabled={isLoading}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2 text-xs font-medium text-slate-400 transition hover:border-amber-500/30 hover:text-amber-300"
        >
          Carregar Exemplar de Demonstração (Eisenhower Dollar 1972)
        </button>
      </div>
    </form>
  );
}
