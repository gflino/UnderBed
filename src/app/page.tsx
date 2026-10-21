"use client";

import React, { useEffect, useState } from "react";
import { Camera, Library, Coins, Sparkles } from "lucide-react";
import {
  NumismaticClassification,
  NumismaticExemplar,
  NumismaticRecord,
} from "@/types/numismatics";
import {
  autoBackfillCatalogIds,
  autoOptimizeDatabaseImages,
  deduplicateLocalCollection,
  numismaticRepository,
} from "@/lib/storage";
import { ProcessedImage } from "@/lib/image-utils";
import {
  CoinCapture,
  PendingClassificationPreview,
} from "@/components/CoinCapture";
import { TechnicalSheet } from "@/components/TechnicalSheet";
import { CollectionList } from "@/components/CollectionList";

type ActiveTab = "scanner" | "acervo" | "ficha";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("scanner");
  const [records, setRecords] = useState<NumismaticRecord[]>([]);
  const [selectedRecord, setSelectedRecord] =
    useState<NumismaticRecord | null>(null);
  const [selectedExemplarId, setSelectedExemplarId] = useState<string | null>(
    null
  );
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const loadRecords = async () => {
    deduplicateLocalCollection();
    const list = await numismaticRepository.list();
    setRecords(list);
    setSelectedRecord((prev) =>
      prev ? list.find((item) => item.id === prev.id) ?? null : null
    );
  };

  useEffect(() => {
    loadRecords();
    autoOptimizeDatabaseImages().then(() => {
      console.log("Otimização automática do banco local concluída");
      loadRecords();
    });
    autoBackfillCatalogIds().then((updated) => {
      if (updated) {
        deduplicateLocalCollection();
        loadRecords();
      }
    });
  }, []);

  // Impede que o botão de voltar físico/navegador saia do PWA para uma página externa,
  // redirecionando sempre para a tela principal do acervo por estado interno.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.history.replaceState({ underbedView: activeTab }, "");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handlePopState = () => {
      setActiveTab("acervo");
      window.history.pushState({ underbedView: "acervo" }, "");
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateToTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      window.history.pushState({ underbedView: tab }, "");
    }
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
    navigateToTab("ficha");
  };

  const handleUpdateExemplar = async (
    recordId: string,
    exemplarId: string,
    patch: Partial<
      Pick<
        NumismaticExemplar,
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
      setActiveTab("acervo");
    }
  };

  const handleDeleteRecord = async (id: string) => {
    await numismaticRepository.remove(id);
    const updatedList = await numismaticRepository.list();
    setRecords(updatedList);
    setSelectedRecord(null);
    setSelectedExemplarId(null);
    setActiveTab("acervo");
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
        `Exemplar(es) transferido(s) e mesclado(s) com sucesso em "${mergedTarget.nome}" (${mergedTarget.friendly_code})!`
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
          onClick={() => navigateToTab("acervo")}
          className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-amber-500/40"
        >
          <Library className="h-3.5 w-3.5 text-amber-400" />
          <span>
            {records.length} • {totalExemplares} ex.
          </span>
        </button>
      </header>

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

        {activeTab === "acervo" && (
          <CollectionList
            records={records}
            onSelectRecord={(rec) => {
              setSelectedRecord(rec);
              setSelectedExemplarId(rec.exemplares?.[0]?.id || null);
              setStatusBanner(null);
              navigateToTab("ficha");
            }}
            onExportJson={handleExportJson}
            onRecordsOptimized={loadRecords}
          />
        )}

        {activeTab === "ficha" && selectedRecord && (
          <TechnicalSheet
            record={selectedRecord}
            otherRecords={records}
            initialExemplarId={selectedExemplarId}
            onUpdateExemplar={handleUpdateExemplar}
            onAddExemplar={handleAddExemplar}
            onDeleteExemplar={handleDeleteExemplar}
            onMergeWithRecord={handleMergeWithRecord}
            onDeleteRecord={handleDeleteRecord}
            onBack={() => navigateToTab("acervo")}
          />
        )}
      </main>

      {/* Barra de Navegação Inferior Mobile-First */}
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
            onClick={() => navigateToTab("acervo")}
            className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-xs font-medium transition ${
              activeTab === "acervo"
                ? "text-amber-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Library className="h-5 w-5" />
            <span>UnderBed ({totalExemplares})</span>
          </button>

          {selectedRecord && (
            <button
              type="button"
              onClick={() => navigateToTab("ficha")}
              className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-xs font-medium transition ${
                activeTab === "ficha"
                  ? "text-amber-400"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sparkles className="h-5 w-5" />
              <span>Ficha Ativa</span>
            </button>
          )}
        </div>
      </nav>
    </div>
  );
}
