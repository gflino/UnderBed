"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Coins,
  Archive,
  Download,
  Upload,
  ChevronRight,
  AlertTriangle,
  TrendingUp,
  Layers,
  GitMerge,
  RefreshCw,
  X,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { NumismaticRecord } from "@/types/numismatics";
import {
  autoBackfillCatalogIds,
  autoOptimizeDatabaseImages,
  deduplicateLocalCollection,
  importCollectionData,
  parseAndValidateBackupJson,
} from "@/lib/storage";

interface CollectionListProps {
  records: NumismaticRecord[];
  onSelectRecord: (record: NumismaticRecord) => void;
  onExportJson: () => Promise<void>;
  onRecordsOptimized?: () => void;
}

type SortField = "km" | "pais" | "um" | "ano" | "valor_face";
type SortDirection = "asc" | "desc";

const SORT_OPTIONS: Array<{ id: SortField; label: string }> = [
  { id: "km", label: "ID (KM#)" },
  { id: "pais", label: "País" },
  { id: "um", label: "Unidade Monetária (UM)" },
  { id: "ano", label: "Ano" },
  { id: "valor_face", label: "Valor Facial" },
];

const parseFaceValueNumber = (raw?: string): number => {
  if (!raw) return Number.POSITIVE_INFINITY;
  const cleaned = raw.trim();
  const fractionMatch = cleaned.match(/(\d+)\s*\/\s*(\d+)/);
  if (fractionMatch) {
    const den = Number(fractionMatch[2]);
    if (den > 0) return Number(fractionMatch[1]) / den;
  }
  const numMatch = cleaned.match(/[\d.,]+/);
  if (!numMatch) return Number.POSITIVE_INFINITY;
  const token = numMatch[0];
  // Se possui vírgula como separador decimal (ex: "0,50" ou "1.000,00")
  if (token.includes(",")) {
    const normalized = token.replace(/\./g, "").replace(",", ".");
    const val = Number(normalized);
    return Number.isFinite(val) ? val : Number.POSITIVE_INFINITY;
  }
  // Se possui pontos de milhar (ex: "1.000")
  if (/^\d{1,3}(\.\d{3})+$/.test(token)) {
    const val = Number(token.replace(/\./g, ""));
    return Number.isFinite(val) ? val : Number.POSITIVE_INFINITY;
  }
  const val = Number(token);
  return Number.isFinite(val) ? val : Number.POSITIVE_INFINITY;
};

const parseYearNumber = (raw?: string): number => {
  if (!raw) return Number.POSITIVE_INFINITY;
  const match = String(raw).match(/\d{3,4}/);
  if (match) return Number(match[0]);
  const num = Number(String(raw).replace(/\D/g, ""));
  return Number.isFinite(num) && num > 0 ? num : Number.POSITIVE_INFINITY;
};

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);

export function CollectionList({
  records,
  onSelectRecord,
  onExportJson,
  onRecordsOptimized,
}: CollectionListProps) {
  const [query, setQuery] = useState("");
  const [selectedUM, setSelectedUM] = useState<string>("Todas");
  const [sortBy, setSortBy] = useState<SortField>("km");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSortClick = (field: SortField) => {
    if (sortBy === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDirection("asc");
    }
  };

  // Estado do Modal de Importação (Mesclar vs. Sobrescrever)
  const [pendingImport, setPendingImport] = useState<{
    jsonString: string;
    recordsCount: number;
    exemplarsCount: number;
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    deduplicateLocalCollection();
    if (onRecordsOptimized) {
      onRecordsOptimized();
    }

    autoOptimizeDatabaseImages().then(() => {
      console.log("Otimização automática do banco local concluída");
      if (onRecordsOptimized) {
        onRecordsOptimized();
      }
    });

    autoBackfillCatalogIds().then((updated) => {
      if (updated) {
        deduplicateLocalCollection();
        if (onRecordsOptimized) {
          onRecordsOptimized();
        }
      }
    });
  }, []);

  // Extrai dinamicamente todas as Unidades Monetárias (UM) cadastradas no acervo
  const availableUMs = useMemo(() => {
    const set = new Set<string>();
    for (const r of records) {
      const um = r.unidade_monetaria?.trim();
      if (um) {
        set.add(um);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [records]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matching = records.filter((item) => {
      if (
        selectedUM !== "Todas" &&
        (item.unidade_monetaria?.trim() || "") !== selectedUM
      ) {
        return false;
      }
      if (!q) return true;
      return (
        item.nome.toLowerCase().includes(q) ||
        item.pais.toLowerCase().includes(q) ||
        item.ano.toLowerCase().includes(q) ||
        (item.unidade_monetaria || "").toLowerCase().includes(q) ||
        (item.krause_id || "").toLowerCase().includes(q) ||
        item.material.toLowerCase().includes(q) ||
        item.local_armazenamento.toLowerCase().includes(q) ||
        (item.exemplares || []).some(
          (ex) =>
            ex.local_armazenamento?.toLowerCase().includes(q) ||
            ex.observacoes?.toLowerCase().includes(q) ||
            ex.estado_conservacao?.toLowerCase().includes(q)
        )
      );
    });

    const dir = sortDirection === "asc" ? 1 : -1;

    return [...matching].sort((a, b) => {
      if (sortBy === "km") {
        const kmA = (a.krause_id || "").trim();
        const kmB = (b.krause_id || "").trim();
        if (!kmA && kmB) return 1;
        if (kmA && !kmB) return -1;
        const cmp = kmA.localeCompare(kmB, "pt-BR", {
          numeric: true,
          sensitivity: "base",
        });
        if (cmp !== 0) return cmp * dir;
        return (parseYearNumber(a.ano) - parseYearNumber(b.ano)) * dir;
      }

      if (sortBy === "pais") {
        const cmp = (a.pais || "").localeCompare(b.pais || "", "pt-BR", {
          sensitivity: "base",
        });
        if (cmp !== 0) return cmp * dir;
        return parseYearNumber(a.ano) - parseYearNumber(b.ano);
      }

      if (sortBy === "um") {
        const umA = (a.unidade_monetaria || "").trim();
        const umB = (b.unidade_monetaria || "").trim();
        if (!umA && umB) return 1;
        if (umA && !umB) return -1;
        const cmp = umA.localeCompare(umB, "pt-BR", { sensitivity: "base" });
        if (cmp !== 0) return cmp * dir;
        const valDiff =
          parseFaceValueNumber(a.valor_face) -
          parseFaceValueNumber(b.valor_face);
        if (valDiff !== 0 && Number.isFinite(valDiff)) return valDiff;
        return parseYearNumber(a.ano) - parseYearNumber(b.ano);
      }

      if (sortBy === "ano") {
        const yA = parseYearNumber(a.ano);
        const yB = parseYearNumber(b.ano);
        if (yA !== yB) {
          if (!Number.isFinite(yA)) return 1;
          if (!Number.isFinite(yB)) return -1;
          return (yA - yB) * dir;
        }
        return (a.nome || "").localeCompare(b.nome || "", "pt-BR", {
          numeric: true,
        });
      }

      if (sortBy === "valor_face") {
        const vA = parseFaceValueNumber(a.valor_face || a.nome);
        const vB = parseFaceValueNumber(b.valor_face || b.nome);
        if (vA !== vB) {
          if (!Number.isFinite(vA)) return 1;
          if (!Number.isFinite(vB)) return -1;
          return (vA - vB) * dir;
        }
        return (a.valor_face || "").localeCompare(b.valor_face || "", "pt-BR", {
          numeric: true,
        }) * dir;
      }

      return 0;
    });
  }, [records, query, selectedUM, sortBy, sortDirection]);

  const stats = useMemo(() => {
    return records.reduce(
      (acc, r) => {
        const exemplares =
          r.exemplares && r.exemplares.length > 0 ? r.exemplares : [r];
        const sumMin = exemplares.reduce(
          (s, ex) => s + (Number(ex.valor_mercado_min_brl) || 0),
          0
        );
        const sumMax = exemplares.reduce(
          (s, ex) => s + (Number(ex.valor_mercado_max_brl) || 0),
          0
        );
        return {
          min: acc.min + sumMin,
          max: acc.max + sumMax,
          totalExemplares: acc.totalExemplares + exemplares.length,
        };
      },
      { min: 0, max: 0, totalExemplares: 0 }
    );
  }, [records]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setImportFeedback(null);

    try {
      const text = await file.text();
      const validated = parseAndValidateBackupJson(text);
      const exemplarsTotal = validated.reduce(
        (acc, r) => acc + (r.exemplares?.length || 1),
        0
      );

      setPendingImport({
        jsonString: text,
        recordsCount: validated.length,
        exemplarsCount: exemplarsTotal,
      });
    } catch (err) {
      setImportError(
        err instanceof Error
          ? err.message
          : "Não foi possível ler o arquivo de backup JSON."
      );
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleConfirmImport = async (mode: "merge" | "overwrite") => {
    if (!pendingImport) return;
    setIsImporting(true);
    setImportError(null);

    try {
      const result = await importCollectionData(pendingImport.jsonString, mode);
      setPendingImport(null);

      if (onRecordsOptimized) {
        onRecordsOptimized();
      }

      if (mode === "overwrite") {
        setImportFeedback(
          `Acervo substituído com sucesso! ${result.added} ficha(s) carregada(s).`
        );
      } else {
        setImportFeedback(
          `Mesclagem concluída! ${result.added} ficha(s) inédita(s) adicionada(s) e ${result.mergedExemplars} exemplar(es) físico(s) unido(s) aos cards existentes.`
        );
      }
    } catch (err) {
      setImportError(
        err instanceof Error
          ? err.message
          : "Erro durante a importação do backup."
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Resumo Financeiro e Estatístico do Acervo UnderBed */}
      <div className="rounded-3xl border border-amber-500/25 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/20 p-4 shadow-lg">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-400">
              <TrendingUp className="h-3.5 w-3.5" />
              Patrimônio UnderBed Estimado
            </span>
            <p className="mt-1 text-lg font-extrabold text-slate-100 sm:text-xl">
              {formatBRL(stats.min)}{" "}
              <span className="text-xs font-normal text-slate-400">a</span>{" "}
              <span className="text-emerald-400">{formatBRL(stats.max)}</span>
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 text-right">
            <span className="rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-1 text-xs font-bold text-amber-300">
              {records.length} {records.length === 1 ? "ficha" : "fichas"}
            </span>
            <span className="text-[11px] font-medium text-indigo-300">
              {stats.totalExemplares}{" "}
              {stats.totalExemplares === 1 ? "exemplar" : "exemplares"}
            </span>
          </div>
        </div>

        {/* Botões Exportar Backup e Importar Backup */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-3">
          <span className="text-[11px] text-slate-400">
            Backup e Sincronização (.json)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/40 bg-indigo-500/15 px-2.5 py-1.5 text-xs font-semibold text-indigo-200 transition hover:bg-indigo-500/25"
            >
              <Upload className="h-3.5 w-3.5" />
              Importar Backup
            </button>
            <button
              type="button"
              onClick={onExportJson}
              disabled={records.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition hover:border-amber-500/40 hover:text-amber-300 disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" />
              Exportar Backup
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        </div>
      </div>

      {/* Feedback de Importação ou Erro */}
      {importFeedback && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200">
          <span>{importFeedback}</span>
          <button
            type="button"
            onClick={() => setImportFeedback(null)}
            className="ml-3 text-emerald-300 hover:underline"
          >
            Fechar
          </button>
        </div>
      )}

      {importError && (
        <div className="flex items-center justify-between rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
          <span>{importError}</span>
          <button
            type="button"
            onClick={() => setImportError(null)}
            className="ml-3 text-rose-300 hover:underline"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Modal de Confirmação Mesclar vs. Sobrescrever */}
      {pendingImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
                  Importação de Backup UnderBed
                </span>
                <h3 className="mt-2 text-base font-bold text-slate-100">
                  {pendingImport.recordsCount}{" "}
                  {pendingImport.recordsCount === 1
                    ? "ficha encontrada"
                    : "fichas encontradas"}{" "}
                  ({pendingImport.exemplarsCount}{" "}
                  {pendingImport.exemplarsCount === 1
                    ? "exemplar físico"
                    : "exemplares físicos"}
                  )
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPendingImport(null)}
                disabled={isImporting}
                className="rounded-xl p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Escolha como deseja importar os dados selecionados para este
              aparelho:
            </p>

            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => handleConfirmImport("merge")}
                disabled={isImporting}
                className="flex w-full flex-col items-start rounded-2xl border border-amber-500/40 bg-amber-500/15 p-3.5 text-left transition hover:bg-amber-500/25 disabled:opacity-50"
              >
                <span className="flex items-center gap-2 text-xs font-bold text-amber-300">
                  {isImporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <GitMerge className="h-4 w-4" />
                  )}
                  Mesclar com Acervo Atual
                </span>
                <span className="mt-1 text-[11px] leading-relaxed text-slate-300">
                  Une moedas com mesmo KM# + Ano como novos exemplares físicos
                  dentro do mesmo card e adiciona moedas inéditas.
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleConfirmImport("overwrite")}
                disabled={isImporting}
                className="flex w-full flex-col items-start rounded-2xl border border-rose-500/40 bg-rose-500/15 p-3.5 text-left transition hover:bg-rose-500/25 disabled:opacity-50"
              >
                <span className="flex items-center gap-2 text-xs font-bold text-rose-300">
                  {isImporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Sobrescrever Acervo Atual
                </span>
                <span className="mt-1 text-[11px] leading-relaxed text-rose-200/80">
                  Substitui todo o banco deste aparelho pelo arquivo importado.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setPendingImport(null)}
                disabled={isImporting}
                className="mt-1 flex w-full items-center justify-center rounded-xl border border-slate-700 bg-slate-800/80 py-2.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barra de Busca e Filtro por Unidade Monetária (UM) */}
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por moeda, país, ano, KM#, UM, metal ou álbum..."
            className="w-full rounded-2xl border border-slate-800 bg-slate-900/90 py-3 pl-10 pr-4 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
          />
        </div>

        <div className="sm:w-56">
          <select
            value={selectedUM}
            onChange={(e) => setSelectedUM(e.target.value)}
            aria-label="Filtrar por Unidade Monetária"
            className="w-full rounded-2xl border border-slate-800 bg-slate-900/90 px-3.5 py-3 text-xs font-medium text-slate-200 focus:border-amber-500 focus:outline-none"
          >
            <option value="Todas">Unidade Monetária: Todas</option>
            {availableUMs.map((um) => (
              <option key={um} value={um}>
                {um}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Barra de Botões de Classificação e Ordenação */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-800/90 bg-slate-900/70 p-2">
        <span className="mr-1 inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          <ArrowUpDown className="h-3 w-3 text-amber-400" />
          Ordenar:
        </span>
        {SORT_OPTIONS.map((option) => {
          const isActive = sortBy === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => handleSortClick(option.id)}
              className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition ${
                isActive
                  ? "border-amber-500/60 bg-amber-500/20 text-amber-300 shadow-sm"
                  : "border-slate-800 bg-slate-900/90 text-slate-400 hover:border-slate-700 hover:text-slate-200"
              }`}
            >
              <span>{option.label}</span>
              {option.id === "ano" && isActive && (
                <span className="text-[10px] font-medium text-amber-200/90">
                  ({sortDirection === "asc" ? "Crescente" : "Decrescente"})
                </span>
              )}
              {isActive &&
                (sortDirection === "asc" ? (
                  <ArrowUp className="h-3 w-3 text-amber-400" />
                ) : (
                  <ArrowDown className="h-3 w-3 text-amber-400" />
                ))}
            </button>
          );
        })}
      </div>

      {/* Lista de Fichas de Referência e Exemplares */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-800 bg-slate-900/40 px-6 py-12 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
            <Coins className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-slate-200">
            {records.length === 0
              ? "Nenhuma peça catalogada no UnderBed"
              : "Nenhum resultado para o filtro"}
          </p>
          <p className="mt-1 max-w-xs text-xs text-slate-400">
            {records.length === 0
              ? "Utilize a aba Classificar para fotografar sua primeira peça ou clique em Importar Backup."
              : "Tente buscar por outro país, ano, KM# ou local de armazenamento."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const count = item.exemplares?.length || 1;
            const confirmedVariantsCount = (item.exemplares || []).reduce(
              (acc, ex) => acc + (ex.variantes_confirmadas?.length || 0),
              0
            );

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectRecord(item)}
                className="group flex w-full items-center gap-3.5 rounded-2xl border border-slate-800 bg-slate-900/90 p-3.5 text-left transition hover:border-amber-500/40 hover:bg-slate-900"
              >
                {/* Miniatura */}
                <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
                  {item.anverso_image ? (
                    <img
                      src={item.anverso_image}
                      alt={item.nome}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <Coins className="h-7 w-7 text-amber-400/70" />
                  )}
                  {count > 1 && (
                    <span className="absolute bottom-1 right-1 rounded-md bg-indigo-600/95 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
                      ×{count}
                    </span>
                  )}
                </div>

                {/* Informações Principais na ordem: código KM, País, Unidade Monetária, Ano */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {item.krause_id && (
                      <span className="text-xs font-semibold text-amber-400">
                        {item.krause_id} •
                      </span>
                    )}

                    <span className="truncate text-xs font-semibold text-amber-400">
                      {item.pais}
                    </span>

                    {item.unidade_monetaria && (
                      <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                        {item.unidade_monetaria}
                      </span>
                    )}

                    <span className="text-xs font-semibold text-amber-400">
                      {item.ano}
                    </span>

                    <span className="inline-flex items-center gap-0.5 rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300">
                      <Layers className="h-2.5 w-2.5" />
                      {count} {count === 1 ? "exemplar" : "exemplares"}
                    </span>

                    {confirmedVariantsCount > 0 && (
                      <span
                        title="Possui variante rara confirmada pelo colecionador"
                        className="inline-flex items-center gap-0.5 rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300"
                      >
                        ★ Variante Confirmada
                      </span>
                    )}
                  </div>

                  <h3 className="truncate text-sm font-bold text-slate-100">
                    {item.nome}
                  </h3>

                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                    <span>{item.estado_conservacao}</span>
                    <span className="font-semibold text-emerald-400">
                      {formatBRL(item.valor_mercado_min_brl)} –{" "}
                      {formatBRL(item.valor_mercado_max_brl)}
                    </span>
                    {item.local_armazenamento && (
                      <span className="inline-flex items-center gap-1 text-slate-400">
                        <Archive className="h-3 w-3 text-amber-400/80" />
                        {item.local_armazenamento}
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight className="h-5 w-5 shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-amber-400" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
