"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Award,
  Scale,
  Ruler,
  CircleDot,
  Landmark,
  Calendar,
  Globe2,
  Coins,
  AlertTriangle,
  ShieldAlert,
  BookOpen,
  Archive,
  StickyNote,
  Save,
  Check,
  Trash2,
  ArrowLeft,
  Layers,
  Plus,
  CheckSquare,
  Square,
  Tag,
} from "lucide-react";
import { NumismaticExemplar, NumismaticRecord } from "@/types/numismatics";

interface TechnicalSheetProps {
  record: NumismaticRecord;
  initialExemplarId?: string | null;
  onUpdateExemplar: (
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
    > & {
      alertas_variantes_raras?: string[];
    }
  ) => Promise<void>;
  onAddExemplar: (
    recordId: string,
    exemplarData: {
      estado_conservacao: string;
      valor_mercado_min_brl: number;
      valor_mercado_max_brl: number;
      local_armazenamento: string;
      observacoes: string;
      variantes_confirmadas: string[];
    }
  ) => Promise<string | null>;
  onDeleteExemplar: (recordId: string, exemplarId: string) => Promise<void>;
  onDeleteRecord?: (id: string) => Promise<void>;
  onBack?: () => void;
}

export const CONSERVACAO_OPTIONS = [
  "UTG (Um Tanto Gasta) / Good (G)",
  "R (Regular) / Very Good (VG)",
  "BC (Bem Conservada) / Fine (F)",
  "MBC (Muito Bem Conservada) / Very Fine (VF)",
  "Soberba (SOB) / Extremely Fine (XF / AU)",
  "Flor de Cunho (FC) / Uncirculated (UNC)",
  "Flor de Cunho Excepcional (FDC) / Gem BU",
  "Proof / Espelhada (PR / PF)",
  "FE (Flor de Estampa — Cédulas)",
];

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);

export function TechnicalSheet({
  record,
  initialExemplarId,
  onUpdateExemplar,
  onAddExemplar,
  onDeleteExemplar,
  onDeleteRecord,
  onBack,
}: TechnicalSheetProps) {
  const router = useRouter();
  const exemplares = record.exemplares || [];
  const [selectedExemplarId, setSelectedExemplarId] = useState<string>(
    initialExemplarId || exemplares[0]?.id || ""
  );

  const currentExemplar: NumismaticExemplar =
    exemplares.find((ex) => ex.id === selectedExemplarId) ||
    exemplares[0] || {
      id: "default",
      created_at: record.created_at,
      updated_at: record.updated_at,
      estado_conservacao: record.estado_conservacao,
      valor_mercado_min_brl: record.valor_mercado_min_brl,
      valor_mercado_max_brl: record.valor_mercado_max_brl,
      alertas_conservacao: record.alertas_conservacao || [],
      variantes_confirmadas: [],
      observacoes: record.observacoes || "",
      local_armazenamento: record.local_armazenamento || "",
      anverso_image: record.anverso_image,
      reverso_image: record.reverso_image,
    };

  const [estadoConservacao, setEstadoConservacao] = useState(
    currentExemplar.estado_conservacao || CONSERVACAO_OPTIONS[3]
  );
  const [valorMinBrl, setValorMinBrl] = useState<number>(
    currentExemplar.valor_mercado_min_brl || 0
  );
  const [valorMaxBrl, setValorMaxBrl] = useState<number>(
    currentExemplar.valor_mercado_max_brl || 0
  );
  const [observacoes, setObservacoes] = useState(
    currentExemplar.observacoes || ""
  );
  const [localArmazenamento, setLocalArmazenamento] = useState(
    currentExemplar.local_armazenamento || ""
  );
  const [variantesConfirmadas, setVariantesConfirmadas] = useState<string[]>(
    currentExemplar.variantes_confirmadas || []
  );
  const [customVariantText, setCustomVariantText] = useState("");
  const [savedFeedback, setSavedFeedback] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newEstado, setNewEstado] = useState(
    record.estado_conservacao || CONSERVACAO_OPTIONS[3]
  );
  const [newLocal, setNewLocal] = useState("");
  const [newObs, setNewObs] = useState("");

  useEffect(() => {
    if (
      initialExemplarId &&
      exemplares.some((ex) => ex.id === initialExemplarId)
    ) {
      setSelectedExemplarId(initialExemplarId);
    } else if (!exemplares.some((ex) => ex.id === selectedExemplarId)) {
      setSelectedExemplarId(exemplares[0]?.id || "");
    }
  }, [initialExemplarId, exemplares, selectedExemplarId]);

  useEffect(() => {
    setEstadoConservacao(
      currentExemplar.estado_conservacao || CONSERVACAO_OPTIONS[3]
    );
    setValorMinBrl(currentExemplar.valor_mercado_min_brl || 0);
    setValorMaxBrl(currentExemplar.valor_mercado_max_brl || 0);
    setObservacoes(currentExemplar.observacoes || "");
    setLocalArmazenamento(currentExemplar.local_armazenamento || "");
    setVariantesConfirmadas(currentExemplar.variantes_confirmadas || []);
  }, [currentExemplar.id]);

  const availableGrades = useMemo(() => {
    const current = estadoConservacao?.trim();
    if (current && !CONSERVACAO_OPTIONS.includes(current)) {
      return [current, ...CONSERVACAO_OPTIONS];
    }
    return CONSERVACAO_OPTIONS;
  }, [estadoConservacao]);

  // Une variações sugeridas no catálogo com quaisquer variações customizadas já confirmadas neste exemplar
  const allDisplayedVariants = useMemo(() => {
    const set = new Set<string>(record.alertas_variantes_raras || []);
    for (const v of variantesConfirmadas) {
      if (v?.trim()) set.add(v.trim());
    }
    return Array.from(set);
  }, [record.alertas_variantes_raras, variantesConfirmadas]);

  const handleGradeChange = async (newGrade: string) => {
    setEstadoConservacao(newGrade);
    await onUpdateExemplar(record.id, currentExemplar.id, {
      estado_conservacao: newGrade,
    });
  };

  const handleToggleVariant = async (variantText: string) => {
    const exists = variantesConfirmadas.includes(variantText);
    const updatedList = exists
      ? variantesConfirmadas.filter((v) => v !== variantText)
      : [...variantesConfirmadas, variantText];

    setVariantesConfirmadas(updatedList);
    await onUpdateExemplar(record.id, currentExemplar.id, {
      variantes_confirmadas: updatedList,
    });
  };

  const handleAddCustomVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customVariantText.trim();
    if (!trimmed) return;

    const updatedCatalogVariants = Array.from(
      new Set([...(record.alertas_variantes_raras || []), trimmed])
    );
    const updatedConfirmed = Array.from(
      new Set([...variantesConfirmadas, trimmed])
    );

    setVariantesConfirmadas(updatedConfirmed);
    setCustomVariantText("");

    await onUpdateExemplar(record.id, currentExemplar.id, {
      alertas_variantes_raras: updatedCatalogVariants,
      variantes_confirmadas: updatedConfirmed,
    });
  };

  const handleSaveExemplar = async () => {
    await onUpdateExemplar(record.id, currentExemplar.id, {
      estado_conservacao: estadoConservacao,
      valor_mercado_min_brl: Number(valorMinBrl) || 0,
      valor_mercado_max_brl: Number(valorMaxBrl) || 0,
      observacoes,
      local_armazenamento: localArmazenamento,
      variantes_confirmadas: variantesConfirmadas,
    });
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2200);
  };

  const handleCreateRepeatedExemplar = async (e: React.FormEvent) => {
    e.preventDefault();
    const newId = await onAddExemplar(record.id, {
      estado_conservacao: newEstado,
      valor_mercado_min_brl: record.valor_mercado_min_brl,
      valor_mercado_max_brl: record.valor_mercado_max_brl,
      local_armazenamento:
        newLocal.trim() || "Não definido (Aguardando catalogação física)",
      observacoes: newObs.trim(),
      variantes_confirmadas: [],
    });
    setShowAddModal(false);
    setNewLocal("");
    setNewObs("");
    if (newId) {
      setSelectedExemplarId(newId);
    }
  };

  const currentExemplarIndex = Math.max(
    0,
    exemplares.findIndex((ex) => ex.id === currentExemplar.id)
  );

  const handleBackToCollection = () => {
    if (onBack) {
      onBack();
    } else {
      router.push("/");
    }
  };

  return (
    <div className="space-y-5 pb-8">
      {/* Barra superior de navegação (sempre visível e gerenciada internamente sem history.back) */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleBackToCollection}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-amber-500/40 hover:text-amber-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Acervo
        </button>

        {onDeleteRecord && (
          <button
            type="button"
            onClick={() => onDeleteRecord(record.id)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Excluir Ficha Completa
          </button>
        )}
      </div>

      {/* Cabeçalho da Ficha Técnica de Referência */}
      <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30 p-5 shadow-xl">
        {/* Badges Superiores na ordem solicitada: Código KM, País, Unidade Monetária, Ano */}
        <div className="flex flex-wrap items-center gap-2">
          {record.krause_id && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-200">
              <Tag className="h-3.5 w-3.5 text-amber-400" />
              🏷️ {record.krause_id}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300">
            <Globe2 className="h-3.5 w-3.5" />
            {record.pais}
          </span>
          {record.unidade_monetaria && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
              <Coins className="h-3.5 w-3.5 text-emerald-400" />
              {record.unidade_monetaria}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800/90 px-3 py-1 text-xs font-medium text-slate-200">
            <Calendar className="h-3.5 w-3.5 text-amber-400" />
            Ano: {record.ano}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-indigo-400/30 bg-indigo-500/15 px-3 py-1 text-xs font-semibold text-indigo-300">
            <Layers className="h-3.5 w-3.5" />
            {exemplares.length}{" "}
            {exemplares.length === 1 ? "Exemplar Físico" : "Exemplares Físicos"}
          </span>
        </div>

        <h1 className="mt-3 text-xl font-bold tracking-tight text-slate-50 sm:text-2xl">
          {record.nome}
        </h1>
        <p className="mt-1 text-xs text-slate-400">
          Valor de Face:{" "}
          <strong className="text-slate-200">{record.valor_face}</strong> • Casa
          da Moeda:{" "}
          <strong className="text-slate-200">{record.casa_moeda}</strong>
        </p>

        {/* Seletor rápido de Exemplares no topo quando houver mais de 1 exemplar */}
        {exemplares.length > 1 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-indigo-500/30 bg-slate-950/80 p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {exemplares.map((ex, idx) => {
                const isSelected = ex.id === currentExemplar.id;
                return (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => setSelectedExemplarId(ex.id)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                      isSelected
                        ? "bg-amber-500 text-slate-950 shadow"
                        : "border border-slate-800 bg-slate-900 text-slate-300 hover:border-amber-500/40"
                    }`}
                  >
                    Exemplar #{idx + 1}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => onDeleteExemplar(record.id, currentExemplar.id)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/25"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remover este Exemplar
            </button>
          </div>
        )}

        {/* Fotografias de Anverso/Reverso do Exemplar Físico Selecionado */}
        {(currentExemplar.anverso_image ||
          currentExemplar.reverso_image ||
          record.anverso_image ||
          record.reverso_image) && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {(currentExemplar.anverso_image || record.anverso_image) && (
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-2 text-center">
                <img
                  src={currentExemplar.anverso_image || record.anverso_image}
                  alt="Anverso"
                  className="mx-auto h-32 w-full object-contain sm:h-40"
                />
                <span className="mt-1 block text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  Anverso (Exemplar #{currentExemplarIndex + 1})
                </span>
              </div>
            )}
            {(currentExemplar.reverso_image || record.reverso_image) && (
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-2 text-center">
                <img
                  src={currentExemplar.reverso_image || record.reverso_image}
                  alt="Reverso"
                  className="mx-auto h-32 w-full object-contain sm:h-40"
                />
                <span className="mt-1 block text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  Reverso (Exemplar #{currentExemplarIndex + 1})
                </span>
              </div>
            )}
          </div>
        )}

        {/* Faixa de Avaliação de Mercado em Reais (BRL) do Exemplar Ativo */}
        <div className="mt-5 rounded-2xl border border-amber-500/25 bg-slate-950/80 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-amber-400">
              Estimativa de Mercado (Brasil • BRL)
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
              <Award className="h-3 w-3" />
              {estadoConservacao}
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-xl font-extrabold text-amber-300 sm:text-2xl">
              {formatBRL(valorMinBrl)}
            </span>
            <span className="text-xs text-slate-400">até</span>
            <span className="text-xl font-extrabold text-emerald-400 sm:text-2xl">
              {formatBRL(valorMaxBrl)}
            </span>
          </div>
          {variantesConfirmadas.length > 0 && (
            <p className="mt-2 text-[11px] font-medium text-amber-300">
              ★ Este exemplar possui {variantesConfirmadas.length} variação(ões)
              confirmada(s).
            </p>
          )}
        </div>
      </div>

      {/* Painel de Múltiplos Exemplares Físicos (Moedas Repetidas) */}
      <div className="rounded-3xl border border-indigo-500/30 bg-slate-900/95 p-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-300">
              <Layers className="h-4 w-4 text-indigo-400" />
              Exemplares Físicos desta Moeda ({exemplares.length})
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Alterne entre os exemplares para comparar fotos, estado de
              conservação e notas:
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {exemplares.length > 1 && (
              <button
                type="button"
                onClick={() => onDeleteExemplar(record.id, currentExemplar.id)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/25"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remover este Exemplar
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowAddModal((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/25"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar Exemplar Repetido
            </button>
          </div>
        </div>

        {/* Abas de seleção dos exemplares */}
        <div className="mt-3.5 flex flex-wrap gap-2">
          {exemplares.map((ex, idx) => {
            const isSelected = ex.id === currentExemplar.id;
            return (
              <button
                key={ex.id}
                type="button"
                onClick={() => setSelectedExemplarId(ex.id)}
                className={`flex flex-col items-start rounded-2xl border px-3.5 py-2 text-left transition ${
                  isSelected
                    ? "border-amber-400 bg-amber-500/15 text-slate-50 shadow"
                    : "border-slate-800 bg-slate-950/70 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-amber-300">
                    Exemplar #{idx + 1}
                  </span>
                  {ex.variantes_confirmadas?.length > 0 && (
                    <span className="rounded bg-amber-400/20 px-1.5 py-0.2 text-[10px] font-semibold text-amber-300">
                      ★ Variante
                    </span>
                  )}
                </div>
                <span className="mt-0.5 max-w-[160px] truncate text-[11px]">
                  {ex.estado_conservacao}
                </span>
                {ex.local_armazenamento && (
                  <span className="max-w-[160px] truncate text-[10px] text-slate-400">
                    {ex.local_armazenamento}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Modal inline para adicionar um novo exemplar repetido */}
        {showAddModal && (
          <form
            onSubmit={handleCreateRepeatedExemplar}
            className="mt-4 space-y-3 rounded-2xl border border-amber-500/30 bg-slate-950 p-4"
          >
            <p className="text-xs font-semibold text-amber-300">
              Novo Exemplar Físico de {record.nome} ({record.ano})
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] text-slate-300">
                  Estado de Conservação
                </label>
                <select
                  value={newEstado}
                  onChange={(e) => setNewEstado(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                >
                  {availableGrades.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-300">
                  Local de Armazenamento
                </label>
                <input
                  type="text"
                  value={newLocal}
                  onChange={(e) => setNewLocal(e.target.value)}
                  placeholder="Ex: Bandeja de Repetidas / Álbum 2 - Slot C1"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-300">
                Observações e Notas Livres
              </label>
              <input
                type="text"
                value={newObs}
                onChange={(e) => setNewObs(e.target.value)}
                placeholder="Ex: Segundo exemplar adquirido em lote, leve pátina dourada"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-xl border border-slate-700 px-3 py-1.5 text-xs text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400"
              >
                Confirmar Novo Exemplar
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Ficha Metrológica de Referência */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-5">
        <h2 className="mb-3.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
          <Coins className="h-4 w-4" />
          Ficha Metrológica de Referência
        </h2>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-800/90 bg-slate-950/60 p-3">
            <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Coins className="h-3.5 w-3.5 text-amber-400" /> Material
            </span>
            <p className="mt-1 text-xs font-semibold text-slate-100">
              {record.material}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800/90 bg-slate-950/60 p-3">
            <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Scale className="h-3.5 w-3.5 text-amber-400" /> Peso Oficial
            </span>
            <p className="mt-1 text-xs font-semibold text-slate-100">
              {record.peso_gramas} g
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800/90 bg-slate-950/60 p-3">
            <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Ruler className="h-3.5 w-3.5 text-amber-400" /> Diâmetro / Largura
            </span>
            <p className="mt-1 text-xs font-semibold text-slate-100">
              {record.diametro_mm} mm
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800/90 bg-slate-950/60 p-3">
            <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <CircleDot className="h-3.5 w-3.5 text-amber-400" /> Bordo
            </span>
            <p className="mt-1 text-xs font-semibold text-slate-100">
              {record.bordo}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800/90 bg-slate-950/60 p-3 sm:col-span-2">
            <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Landmark className="h-3.5 w-3.5 text-amber-400" /> Casa da Moeda
            </span>
            <p className="mt-1 text-xs font-semibold text-slate-100">
              {record.casa_moeda}
            </p>
          </div>
        </div>
      </div>

      {/* Verificador de Variantes & Alertas de Conservação */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Verificador de Variantes */}
        <div className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-5 flex flex-col justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Verificador de Variantes
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              Marque as variações identificadas no{" "}
              <strong className="text-slate-200">
                Exemplar #{currentExemplarIndex + 1}
              </strong>{" "}
              ou adicione uma variação personalizada:
            </p>

            <div className="mt-3 space-y-2.5">
              {allDisplayedVariants.length > 0 ? (
                allDisplayedVariants.map((variante, idx) => {
                  const isConfirmed = variantesConfirmadas.includes(variante);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleToggleVariant(variante)}
                      className={`flex w-full items-start gap-2.5 rounded-2xl border p-3 text-left text-xs leading-relaxed transition ${
                        isConfirmed
                          ? "border-amber-400 bg-amber-500/20 text-amber-50 shadow-sm"
                          : "border-amber-500/20 bg-slate-950/70 text-slate-300 hover:border-amber-500/40"
                      }`}
                    >
                      {isConfirmed ? (
                        <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                      ) : (
                        <Square className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                      )}
                      <div className="flex-1">
                        <div className="mb-1 flex items-center gap-1.5">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              isConfirmed
                                ? "bg-amber-400 text-slate-950"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {isConfirmed ? "Confirmada" : "Variação Sugerida"}
                          </span>
                        </div>
                        <span>{variante}</span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <p className="text-xs text-slate-400">
                  Nenhuma variação registrada para esta emissão.
                </p>
              )}
            </div>
          </div>

          {/* Opção para inserir variações que não estejam listadas */}
          <form
            onSubmit={handleAddCustomVariant}
            className="mt-4 flex items-center gap-2 border-t border-amber-500/20 pt-3.5"
          >
            <input
              type="text"
              value={customVariantText}
              onChange={(e) => setCustomVariantText(e.target.value)}
              placeholder="Inserir variação não listada (ex: Reverso Invertido, Cunho Quebrado)..."
              className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!customVariantText.trim()}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-amber-400 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar
            </button>
          </form>
        </div>

        {/* Alertas de Conservação */}
        <div className="rounded-3xl border border-rose-500/30 bg-rose-500/5 p-5">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-300">
            <ShieldAlert className="h-4 w-4 text-rose-400" />
            Alertas de Conservação
          </h3>
          <p className="mt-1 text-[11px] text-slate-400">
            Diagnóstico de superfície, pátina, PVC e cuidados de preservação:
          </p>
          <ul className="mt-3 space-y-2">
            {(currentExemplar.alertas_conservacao?.length
              ? currentExemplar.alertas_conservacao
              : record.alertas_conservacao
            ).length > 0 ? (
              (currentExemplar.alertas_conservacao?.length
                ? currentExemplar.alertas_conservacao
                : record.alertas_conservacao
              ).map((alerta, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-slate-950/70 p-2.5 text-xs leading-relaxed text-rose-100"
                >
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                  <span>{alerta}</span>
                </li>
              ))
            ) : (
              <li className="text-xs text-slate-400">
                Nenhum dano severo aparente detectado.
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* Seção de Curiosidades e Contexto Histórico */}
      <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/25 p-5">
        <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
          <BookOpen className="h-4 w-4" />
          Curiosidades, Tiragem & Contexto Histórico
        </h3>
        <div className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-200">
          {record.curiosidades}
        </div>
      </div>

      {/* Gestão Individual do Exemplar Selecionado */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
              <Archive className="h-4 w-4" />
              Dados Individuais — Exemplar #{currentExemplarIndex + 1}
            </h3>
            <p className="text-[11px] text-slate-400">
              Selecione a graduação de conservação, faixa de valor, local de
              guarda e notas deste exemplar:
            </p>
          </div>

          <div className="flex items-center gap-2">
            {exemplares.length > 1 && (
              <button
                type="button"
                onClick={() => onDeleteExemplar(record.id, currentExemplar.id)}
                className="inline-flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remover este Exemplar
              </button>
            )}

            <button
              type="button"
              onClick={handleSaveExemplar}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-amber-400"
            >
              {savedFeedback ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Exemplar Salvo!
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  Salvar Exemplar
                </>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-300">
              <Award className="h-3.5 w-3.5 text-amber-400" />
              Estado de Conservação
            </label>
            <select
              value={estadoConservacao}
              onChange={(e) => handleGradeChange(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs font-medium text-slate-100 focus:border-amber-500 focus:outline-none"
            >
              {availableGrades.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">
              Valor Mín.
            </label>
            <input
              type="number"
              step="0.01"
              value={valorMinBrl}
              onChange={(e) => setValorMinBrl(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">
              Valor Máx.
            </label>
            <input
              type="number"
              step="0.01"
              value={valorMaxBrl}
              onChange={(e) => setValorMaxBrl(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-300">
              <Archive className="h-3.5 w-3.5 text-amber-400" />
              Local de Armazenamento
            </label>
            <input
              type="text"
              value={localArmazenamento}
              onChange={(e) => setLocalArmazenamento(e.target.value)}
              placeholder="Ex: Gaveta 2 • Bandeja de Veludo Azul • Posição C4"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-300">
              <StickyNote className="h-3.5 w-3.5 text-amber-400" />
              Observações e Notas Livres
            </label>
            <textarea
              rows={3}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Anote procedência, valor pago, detalhes de variante ou lembretes deste exemplar..."
              className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3.5 text-xs leading-relaxed text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
