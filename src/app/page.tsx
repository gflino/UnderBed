"use client";

import React, { useEffect, useRef, useState } from "react";
import { Camera, Library, Coins, Loader2 } from "lucide-react";
import {
  NumismaticClassification,
  NumismaticExemplar,
  NumismaticRecord,
} from "@/types/numismatics";
import {
  autoBackfillCatalogIds,
  autoOptimizeDatabaseImages,
  autoStandardizeDatabaseImages,
  deduplicateLocalCollection,
  getUnstandardizedExemplarsCount,
  numismaticRepository,
} from "@/lib/storage";
import { ProcessedImage } from "@/lib/image-utils";
import {
  CoinCapture,
  PendingClassificationPreview,
} from "@/components/CoinCapture";
import { TechnicalSheet } from "@/components/TechnicalSheet";
import { CollectionList } from "@/components/CollectionList";

type ActiveTab = "scanner" | "underbed";
const SCROLL_STORAGE_KEY = "underbed:scroll_position";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("scanner");
  const [records, setRecords] = useState<NumismaticRecord[]>([]);
  const [selectedRecord, setSelectedRecord] =
    useState<NumismaticRecord | null>(null);
  const [selectedExemplarId, setSelectedExemplarId] = useState<string | null>(
    null
  );
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [standardizeProgress, setStandardizeProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const savedScrollYRef = useRef<number>(0);
  const initialStandardizationTriggeredRef = useRef<boolean>(false);

  const loadRecords = async (): Promise<NumismaticRecord[]> => {
    deduplicateLocalCollection();
    const list = await numismaticRepository.list();
    setRecords(list);
    setSelectedRecord((prev) =>
      prev ? list.find((item) => item.id === prev.id) ?? null : null
    );
    return list;
  };

  const triggerRetroactiveStandardization = (
    recordsToCheck?: NumismaticRecord[]
  ) => {
    // Trava a execução para rodar apenas se o array filtrado por !image_standardized for maior que zero
    const pendingCount = getUnstandardizedExemplarsCount(recordsToCheck);
    if (pendingCount <= 0) {
      setStandardizeProgress(null);
      return;
    }

    autoStandardizeDatabaseImages(
      (current, total) => {
        setStandardizeProgress({ current, total });
      },
      () => {
        loadRecords();
      }
    )
      .then((updated) => {
        if (updated) {
          loadRecords();
        }
      })
      .finally(() => {
        setStandardizeProgress(null);
      });
  };

  useEffect(() => {
    let isMounted = true;
    (async () => {
      await autoOptimizeDatabaseImages();
      const currentList = await loadRecords();

      if (isMounted && !initialStandardizationTriggeredRef.current) {
        initialStandardizationTriggeredRef.current = true;
        const unstandardizedItems = currentList
          .flatMap((r) => r.exemplares || [])
          .filter(
            (ex) =>
              !ex.image_standardized &&
              Boolean(ex.anverso_image || ex.reverso_image)
          );

        if (unstandardizedItems.length > 0) {
          triggerRetroactiveStandardization(currentList);
        }
      }

      const updatedCatalog = await autoBackfillCatalogIds();
      if (updatedCatalog && isMounted) {
        deduplicateLocalCollection();
        await loadRecords();
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // Impede que o botão de voltar físico/navegador saia do PWA para uma página externa,
  // redirecionando sempre para a tela principal do acervo (underbed) por estado interno.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.history.replaceState({ underbedView: activeTab }, "");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handlePopState = () => {
      setSelectedRecord(null);
      setSelectedExemplarId(null);
      setActiveTab("underbed");
      window.history.pushState({ underbedView: "underbed" }, "");
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Preserva e restaura a rolagem ao retornar para a lista de registros na aba underbed
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (activeTab === "underbed" && !selectedRecord) {
      const stored = window.sessionStorage.getItem(SCROLL_STORAGE_KEY);
      const savedPosition =
        stored !== null ? Number(stored) : savedScrollYRef.current;
      if (Number.isFinite(savedPosition) && savedPosition >= 0) {
        requestAnimationFrame(() => {
          window.scrollTo(0, savedPosition);
        });
      }
    }
  }, [activeTab, selectedRecord]);

  const navigateToTab = (tab: ActiveTab) => {
    if (
      typeof window !== "undefined" &&
      activeTab === "underbed" &&
      !selectedRecord &&
      tab !== "underbed"
    ) {
      savedScrollYRef.current = window.scrollY;
      window.sessionStorage.setItem(SCROLL_STORAGE_KEY, String(window.scrollY));
    }
    if (tab === "underbed") {
      setSelectedRecord(null);
      setSelectedExemplarId(null);
    }
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      window.history.pushState({ underbedView: tab }, "");
    }
  };

  const handleCloseTechnicalSheet = () => {
    setSelectedRecord(null);
    setSelectedExemplarId(null);
    setActiveTab("underbed");
  };

  const totalExemplares = records.reduce(
    (acc, r) => acc + (r.exemplares?.length || 1),
    0
  );

  const handleAnalyzeImages = async ({
    images,
    observacoesIniciais,
    localArmazenamentoInicial,
  }: {
    images: ProcessedImage[];
    observacoesIniciais: string;
    localArmazenamentoInicial: string;
  }): Promise<NumismaticClassification> => {
    setIsLoading(true);
    setApiError(null);
    setStatusBanner(null);
    try {
      const response = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imagens: images.map((img) => ({
            base64: img.base64,
            mimeType: img.mimeType,
          })),
          observacoesIniciais,
          localArmazenamentoInicial,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error || "Falha ao classificar a peça numismática."
        );
      }

      return data as NumismaticClassification;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Erro inesperado durante a comunicação com a API.";
      setApiError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmSave = async (preview: PendingClassificationPreview) => {
    const { record, exemplarId, isNewExemplarOnExistingRef } =
      await numismaticRepository.create(preview.classification, {
        anverso: preview.anversoImage?.thumbnailDataUrl,
        reverso: preview.reversoImage?.thumbnailDataUrl,
        alreadyStandardized: preview.alreadyStandardized,
      });

    const updatedList = await numismaticRepository.list();
    setRecords(updatedList);
    setSelectedRecord(record);
    setSelectedExemplarId(exemplarId);
    if (isNewExemplarOnExistingRef) {
      setStatusBanner(
        `Moeda já existente no catálogo UnderBed! Um novo exemplar físico foi adicionado à ficha de "${record.nome}".`
      );
    }
    setActiveTab("underbed");
    if (typeof window !== "undefined") {
      window.history.pushState({ underbedView: "underbed", ficha: true }, "");
    }
  };

  const handleUpdateExemplar = async (
    recordId: string,
    exemplarId: string,
    patch: Partial<
      Pick<
        NumismaticExemplar,
        | "gravura"
        | "anverso_image"
        | "reverso_image"
        | "anverso_rotation"
        | "reverso_rotation"
        | "image_standardized"
        | "manual_crop"
        | "estado_conservacao"
        | "valor_mercado_min_brl"
        | "valor_mercado_max_brl"
        | "local_armazenamento"
        | "observacoes"
        | "variantes_confirmadas"
      >
    > & { alertas_variantes_raras?: string[] }
  ) => {
    const updated = await numismaticRepository.updateExemplar(
      recordId,
      exemplarId,
      patch
    );
    const updatedList = await numismaticRepository.list();
    setRecords(updatedList);
    if (updated) {
      setSelectedRecord(updated);
    }
  };

  const handleUpdateRecord = async (
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
  ) => {
    const updated = await numismaticRepository.updateRecord(recordId, patch);
    const updatedList = await numismaticRepository.list();
    setRecords(updatedList);
    if (updated) {
      setSelectedRecord(updated);
    }
  };

  const handleAddExemplar = async (
    recordId: string,
    exemplarData: {
      estado_conservacao: string;
      valor_mercado_min_brl: number;
      valor_mercado_max_brl: number;
      local_armazenamento: string;
      observacoes: string;
      variantes_confirmadas: string[];
    }
  ): Promise<string | null> => {
    const res = await numismaticRepository.addExemplar(recordId, exemplarData);
    const updatedList = await numismaticRepository.list();
    setRecords(updatedList);
    if (res) {
      setSelectedRecord(res.record);
      setSelectedExemplarId(res.exemplarId);
      return res.exemplarId;
    }
    return null;
  };

  const handleDeleteExemplar = async (recordId: string, exemplarId: string) => {
    const updated = await numismaticRepository.removeExemplar(
      recordId,
      exemplarId
    );
    const updatedList = await numismaticRepository.list();
    setRecords(updatedList);
    if (updated) {
      setSelectedRecord(updated);
      setSelectedExemplarId(updated.exemplares[0]?.id || null);
    } else {
      setSelectedRecord(null);
      setSelectedExemplarId(null);
      setActiveTab("underbed");
    }
  };

  const handleDeleteRecord = async (id: string) => {
    await numismaticRepository.remove(id);
    const updatedList = await numismaticRepository.list();
    setRecords(updatedList);
    setSelectedRecord(null);
    setSelectedExemplarId(null);
    setActiveTab("underbed");
  };

  const handleMergeWithRecord = async (
    sourceRecordId: string,
    targetRecordId: string,
    onlyExemplarId?: string
  ) => {
    const mergedTarget = await numismaticRepository.mergeRecords(
      sourceRecordId,
      targetRecordId,
      onlyExemplarId
    );
    const updatedList = await numismaticRepository.list();
    setRecords(updatedList);
    if (mergedTarget) {
      setSelectedRecord(mergedTarget);
      const lastExemplar =
        mergedTarget.exemplares[mergedTarget.exemplares.length - 1];
      setSelectedExemplarId(lastExemplar?.id || null);
      setStatusBanner(
        `Exemplar(es) transferido(s) e mesclado(s) com sucesso em "${mergedTarget.nome}" (CUB: ${mergedTarget.friendly_code})!`
      );
    }
  };

  const handleExportJson = async () => {
    const json = await numismaticRepository.exportJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `underbed-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 pt-4 pb-24">
      {/* Cabeçalho Principal UnderBed */}
      <header className="mb-5 flex items-center justify-between border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/20 to-slate-900 text-amber-400 shadow">
            <Coins className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold tracking-tight text-slate-50">
                UnderBed
              </span>
              <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                PWA
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Acervo & Perícia Numismática com IA
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigateToTab("underbed")}
          className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-amber-500/40"
        >
          <Library className="h-3.5 w-3.5 text-amber-400" />
          <span>
            {records.length} • {totalExemplares} ex.
          </span>
        </button>
      </header>

      {/* Banner Discreto da Fila Retroativa de Padronização Visual de Moedas */}
      {standardizeProgress && (
        <div className="mb-3 flex items-center gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs font-medium text-amber-200 shadow-sm">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-amber-400" />
          <span>
            Alinhando e padronizando fotos do acervo (
            {standardizeProgress.current}/{standardizeProgress.total})...
          </span>
        </div>
      )}

      {/* Banner de Status (ex: Novo exemplar vinculado a ficha existente) */}
      {statusBanner && (
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-indigo-500/40 bg-indigo-500/10 px-4 py-3 text-xs text-indigo-200">
          <span>{statusBanner}</span>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="ml-3 text-indigo-300 underline"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Banner de Erro da API */}
      {apiError && (
        <div className="mb-4 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-200">
          <p className="font-semibold text-rose-300">
            Não foi possível concluir a análise:
          </p>
          <p className="mt-1">{apiError}</p>
        </div>
      )}

      {/* Conteúdo Principal */}
      <main className="flex-1">
        {activeTab === "scanner" && (
          <CoinCapture
            onAnalyzeImages={handleAnalyzeImages}
            onConfirmSave={handleConfirmSave}
            isLoading={isLoading}
          />
        )}

        {activeTab === "underbed" &&
          (selectedRecord ? (
            <TechnicalSheet
              record={selectedRecord}
              otherRecords={records}
              initialExemplarId={selectedExemplarId}
              onUpdateExemplar={handleUpdateExemplar}
              onUpdateRecord={handleUpdateRecord}
              onAddExemplar={handleAddExemplar}
              onDeleteExemplar={handleDeleteExemplar}
              onMergeWithRecord={handleMergeWithRecord}
              onDeleteRecord={handleDeleteRecord}
              onBack={handleCloseTechnicalSheet}
            />
          ) : (
            <CollectionList
              records={records}
              onSelectRecord={(rec) => {
                if (typeof window !== "undefined") {
                  savedScrollYRef.current = window.scrollY;
                  window.sessionStorage.setItem(
                    SCROLL_STORAGE_KEY,
                    String(window.scrollY)
                  );
                  window.history.pushState(
                    { underbedView: "underbed", ficha: true },
                    ""
                  );
                }
                setSelectedRecord(rec);
                setSelectedExemplarId(rec.exemplares?.[0]?.id || null);
                setStatusBanner(null);
              }}
              onExportJson={handleExportJson}
              onRecordsOptimized={async () => {
                const updatedList = await loadRecords();
                if (getUnstandardizedExemplarsCount(updatedList) > 0) {
                  triggerRetroactiveStandardization(updatedList);
                }
              }}
            />
          ))}
      </main>

      {/* Barra de Navegação Inferior Mobile-First (apenas Classificar e Acervo) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-800/90 bg-slate-950/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-2xl items-center justify-around px-4 py-2">
          <button
            type="button"
            onClick={() => navigateToTab("scanner")}
            className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-xs font-medium transition ${
              activeTab === "scanner"
                ? "text-amber-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Camera className="h-5 w-5" />
            <span>Classificar</span>
          </button>

          <button
            type="button"
            onClick={() => navigateToTab("underbed")}
            className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-xs font-medium transition ${
              activeTab === "underbed"
                ? "text-amber-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Library className="h-5 w-5" />
            <span>Acervo</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
