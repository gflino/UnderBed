"use client";

import React, { useEffect, useMemo, useState } from "react";
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
    >
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

  // Garante que o valor retornado pela IA (caso tenha texto customizado) também apareça na lista do <select>
  const availableGrades = useMemo(() => {
    const current = estadoConservacao?.trim();
    if (current && !CONSERVACAO_OPTIONS.includes(current)) {
      return [current, ...CONSERVACAO_OPTIONS];
    }
    return CONSERVACAO_OPTIONS;
  }, [estadoConservacao]);

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

  return (
    <div className="space-y-5 pb-8">
      {/* Barra superior de navegação */}
      {onBack && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
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
      )}

      {/* Cabeçalho da Ficha Técnica de Referência (Dados Compartilhados) */}
      <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30 p-5 shadow-xl">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300">
            <Globe2 className="h-3.5 w-3.5" />
            {record.pais}
          </span>
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

        {/* Fotografias do Exemplar Selecionado (ou da Referência) */}
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
              ★ Este exemplar possui {variantesConfirmadas.length} variante(s)
              rara(s) confirmada(s) manualmente pelo colecionador.
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
              A ficha técnica base é compartilhada. Selecione um exemplar ou
              cadastre uma moeda repetida com estado e local próprios:
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddModal((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/25"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar Exemplar Repetido
          </button>
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
                  Estado de Conservação do Novo Exemplar
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
                  Local de Armazenamento Individual
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
                Observações Específicas deste Exemplar
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

      {/* Especificações Metrológicas e Numismáticas (Ficha de Referência Compartilhada) */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-5">
        <h2 className="mb-3.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
          <Coins className="h-4 w-4" />
          Ficha Metrológica de Referência (Compartilhada)
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

      {/* Módulo de Variantes Interativo & Alertas de Conservação */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Módulo Interativo de Variantes Raras */}
        <div className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-5">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            Verificador Interativo de Variantes ({record.ano})
          </h3>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            Sugestões inteligentes da base numismática para este ano/modelo.
            Inspecione o{" "}
            <strong className="text-slate-200">
              Exemplar #{currentExemplarIndex + 1}
            </strong>{" "}
            em mãos e toque para confirmar ou desmarcar:
          </p>

          <div className="mt-3 space-y-2.5">
            {record.alertas_variantes_raras.length > 0 ? (
              record.alertas_variantes_raras.map((variante, idx) => {
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
                          {isConfirmed
                            ? "Confirmada neste Exemplar"
                            : "Sugestão do Catálogo"}
                        </span>
                      </div>
                      <span>{variante}</span>
                    </div>
                  </button>
                );
              })
            ) : (
              <p className="text-xs text-slate-400">
                Nenhuma variante rara específica registrada para esta emissão.
              </p>
            )}
          </div>
        </div>

        {/* Conservação e Integridade Física */}
        <div className="rounded-3xl border border-rose-500/30 bg-rose-500/5 p-5">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-300">
            <ShieldAlert className="h-4 w-4 text-rose-400" />
            Alertas de Conservação (`alertas_conservacao`)
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
                Remover Exemplar #{currentExemplarIndex + 1}
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
              Estado de Conservação (`estado_conservacao`)
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
              Valor Mín. (`valor_mercado_min_brl`)
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
              Valor Máx. (`valor_mercado_max_brl`)
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
              Local de Armazenamento (`local_armazenamento`)
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
              Observações e Notas Livres (`observacoes`)
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
