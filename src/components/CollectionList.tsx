"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  Coins,
  Archive,
  Download,
  ChevronRight,
  AlertTriangle,
  TrendingUp,
  Layers,
} from "lucide-react";
import { NumismaticRecord } from "@/types/numismatics";
import { autoOptimizeDatabaseImages } from "@/lib/storage";

interface CollectionListProps {
  records: NumismaticRecord[];
  onSelectRecord: (record: NumismaticRecord) => void;
  onExportJson: () => Promise<void>;
  onRecordsOptimized?: () => void;
}

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

  useEffect(() => {
    autoOptimizeDatabaseImages().then((modified) => {
      console.log("Otimização automática do banco local concluída");
      if (onRecordsOptimized) {
        onRecordsOptimized();
      } else if (modified) {
        // garantido recarregamento via callback do componente pai
      }
    });
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter(
      (item) =>
        item.nome.toLowerCase().includes(q) ||
        item.pais.toLowerCase().includes(q) ||
        item.ano.toLowerCase().includes(q) ||
        item.material.toLowerCase().includes(q) ||
        item.local_armazenamento.toLowerCase().includes(q) ||
        (item.exemplares || []).some(
          (ex) =>
            ex.local_armazenamento?.toLowerCase().includes(q) ||
            ex.observacoes?.toLowerCase().includes(q) ||
            ex.estado_conservacao?.toLowerCase().includes(q)
        )
    );
  }, [records, query]);

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

        {records.length > 0 && (
          <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-3">
            <span className="text-[11px] text-slate-400">
              Acervo UnderBed local (pronto para migração Supabase)
            </span>
            <button
              type="button"
              onClick={onExportJson}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-medium text-slate-200 transition hover:border-amber-500/40 hover:text-amber-300"
            >
              <Download className="h-3.5 w-3.5" />
              Exportar JSON
            </button>
          </div>
        )}
      </div>

      {/* Busca por nome, país, ano, material ou local */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar no UnderBed por moeda, país, ano, metal ou álbum..."
          className="w-full rounded-2xl border border-slate-800 bg-slate-900/90 py-3 pl-10 pr-4 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
        />
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
              ? "Utilize a aba Classificar para fotografar o anverso e reverso da sua primeira moeda ou cédula."
              : "Tente buscar por outro país, ano ou local de armazenamento."}
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

                {/* Informações Principais */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-xs font-semibold text-amber-400">
                      {item.pais} • {item.ano}
                    </span>

                    <span className="inline-flex items-center gap-0.5 rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300">
                      <Layers className="h-2.5 w-2.5" />
                      {count} {count === 1 ? "exemplar" : "exemplares"}
                    </span>

                    {confirmedVariantsCount > 0 ? (
                      <span
                        title="Possui variante rara confirmada pelo colecionador"
                        className="inline-flex items-center gap-0.5 rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300"
                      >
                        ★ Variante Confirmada
                      </span>
                    ) : (
                      item.alertas_variantes_raras.length > 0 && (
                        <span
                          title="Possui sugestões de variantes na base numismática"
                          className="inline-flex items-center gap-0.5 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-300"
                        >
                          <AlertTriangle className="h-2.5 w-2.5 text-amber-400" />
                          {item.alertas_variantes_raras.length} var. sugeridas
                        </span>
                      )
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
