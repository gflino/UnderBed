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
  Tag,
  GitMerge,
  Search,
  X,
  Pencil,
  RotateCw,
  RotateCcw,
  Crop,
} from "lucide-react";
import { NumismaticExemplar, NumismaticRecord } from "@/types/numismatics";
import {
  formatStandardCoinTitle,
  generateFriendlyCode,
  getExemplarDisplayLabels,
  rotateBase64Image,
} from "@/lib/storage";
import { CoinCropperModal } from "@/components/CoinCropperModal";

interface TechnicalSheetProps {
  record: NumismaticRecord;
  otherRecords?: NumismaticRecord[];
  initialExemplarId?: string | null;
  onUpdateExemplar: (
    recordId: string,
    exemplarId: string,
    patch: Partial<
      Pick<
        NumismaticExemplar,
        | "gravura"
        | "estado_conservacao"
        | "valor_mercado_min_brl"
        | "valor_mercado_max_brl"
        | "local_armazenamento"
        | "observacoes"
        | "variantes_confirmadas"
        | "anverso_image"
        | "reverso_image"
        | "anverso_rotation"
        | "reverso_rotation"
        | "image_standardized"
        | "manual_crop"
      >
    > & {
      alertas_variantes_raras?: string[];
    }
  ) => Promise<void>;
  onUpdateRecord?: (
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
  ) => Promise<void>;
  onAddExemplar: (
    recordId: string,
    exemplarData: {
      gravura?: string;
      estado_conservacao: string;
      valor_mercado_min_brl: number;
      valor_mercado_max_brl: number;
      local_armazenamento: string;
      observacoes: string;
      variantes_confirmadas: string[];
    }
  ) => Promise<string | null>;
  onDeleteExemplar: (recordId: string, exemplarId: string) => Promise<void>;
  onMergeWithRecord?: (
    sourceRecordId: string,
    targetRecordId: string,
    onlyExemplarId?: string
  ) => Promise<void>;
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
  otherRecords = [],
  initialExemplarId,
  onUpdateExemplar,
  onUpdateRecord,
  onAddExemplar,
  onDeleteExemplar,
  onMergeWithRecord,
  onDeleteRecord,
  onBack,
}: TechnicalSheetProps) {
  const exemplares = record.exemplares || [];
  const cubCode = record.friendly_code || generateFriendlyCode(record);
  const standardTitle = formatStandardCoinTitle(record);
  const exemplarDisplayLabels = useMemo(
    () => getExemplarDisplayLabels(exemplares),
    [exemplares]
  );

  // Sempre inicia a leitura pelo topo ao montar a Ficha Ativa (ou trocar de registro)
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [record.id]);

  // Isola o índice ativo (selectedExemplarIndex) no estado local da ficha técnica,
  // reinicializando apenas quando `record.id` muda.
  const [selectedExemplarIndex, setSelectedExemplarIndex] = useState<number>(
    () => {
      if (initialExemplarId) {
        const foundIdx = exemplares.findIndex(
          (ex) => ex.id === initialExemplarId
        );
        if (foundIdx >= 0) return foundIdx;
      }
      return 0;
    }
  );

  useEffect(() => {
    if (initialExemplarId) {
      const foundIdx = (record.exemplares || []).findIndex(
        (ex) => ex.id === initialExemplarId
      );
      setSelectedExemplarIndex(foundIdx >= 0 ? foundIdx : 0);
    } else {
      setSelectedExemplarIndex(0);
    }
  }, [record.id]);

  // Garante que o índice ativo permaneça dentro dos limites se um exemplar for excluído
  const currentExemplarIndex = Math.max(
    0,
    Math.min(selectedExemplarIndex, Math.max(0, exemplares.length - 1))
  );

  const currentExemplar: NumismaticExemplar = exemplares[
    currentExemplarIndex
  ] || {
    id: "default",
    created_at: record.created_at,
    updated_at: record.updated_at,
    gravura: undefined,
    estado_conservacao: record.estado_conservacao,
    valor_mercado_min_brl: record.valor_mercado_min_brl,
    valor_mercado_max_brl: record.valor_mercado_max_brl,
    alertas_conservacao: record.alertas_conservacao || [],
    variantes_confirmadas: [],
    observacoes: record.observacoes || "",
    local_armazenamento: record.local_armazenamento || "",
    anverso_image: record.anverso_image,
    reverso_image: record.reverso_image,
    anverso_rotation: record.anverso_rotation || 0,
    reverso_rotation: record.reverso_rotation || 0,
  };

  const currentExemplarLabel =
    exemplarDisplayLabels[currentExemplarIndex] ||
    `Exemplar #${currentExemplarIndex + 1}`;

  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeSearch, setMergeSearch] = useState("");
  const [mergeOnlyCurrentExemplar, setMergeOnlyCurrentExemplar] =
    useState(false);
  const [isMerging, setIsMerging] = useState(false);

  // Estado do Modal de Ajuste/Corte Manual (CoinCropperModal)
  const [cropModalSide, setCropModalSide] = useState<
    "anverso" | "reverso" | null
  >(null);

  // Estado do Modal de Edição Manual da Moeda
  const [showEditRecordModal, setShowEditRecordModal] = useState(false);
  const [editGravura, setEditGravura] = useState(currentExemplar.gravura || "");
  const [editPais, setEditPais] = useState(record.pais || "");
  const [editAno, setEditAno] = useState(record.ano || "");
  const [editValorFace, setEditValorFace] = useState(record.valor_face || "");
  const [editUM, setEditUM] = useState(record.unidade_monetaria || "");
  const [editCasaMoeda, setEditCasaMoeda] = useState(record.casa_moeda || "");
  const [editMaterial, setEditMaterial] = useState(record.material || "");
  const [editPeso, setEditPeso] = useState<number>(record.peso_gramas || 0);
  const [editDiametro, setEditDiametro] = useState<number>(
    record.diametro_mm || 0
  );
  const [editBordo, setEditBordo] = useState(record.bordo || "");
  const [editKrauseId, setEditKrauseId] = useState(record.krause_id || "");
  const [editNumistaId, setEditNumistaId] = useState(record.numista_id || "");
  const [editCuriosidades, setEditCuriosidades] = useState(
    record.curiosidades || ""
  );
  const [isSavingRecordEdit, setIsSavingRecordEdit] = useState(false);

  const [gravuraExemplar, setGravuraExemplar] = useState(
    currentExemplar.gravura || ""
  );
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
  const [newGravura, setNewGravura] = useState(currentExemplar.gravura || "");
  const [newEstado, setNewEstado] = useState(
    record.estado_conservacao || CONSERVACAO_OPTIONS[3]
  );
  const [newLocal, setNewLocal] = useState("");
  const [newObs, setNewObs] = useState("");

  // Sincroniza os campos individuais do exemplar selecionado quando o índice/ID ativo muda
  useEffect(() => {
    setGravuraExemplar(currentExemplar.gravura || "");
    setEstadoConservacao(
      currentExemplar.estado_conservacao || CONSERVACAO_OPTIONS[3]
    );
    setValorMinBrl(currentExemplar.valor_mercado_min_brl || 0);
    setValorMaxBrl(currentExemplar.valor_mercado_max_brl || 0);
    setObservacoes(currentExemplar.observacoes || "");
    setLocalArmazenamento(currentExemplar.local_armazenamento || "");
    setVariantesConfirmadas(currentExemplar.variantes_confirmadas || []);
  }, [currentExemplarIndex, currentExemplar.id]);

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
      gravura: gravuraExemplar.trim() || undefined,
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

  const handleRotateImage = async (
    side: "anverso" | "reverso",
    deltaDegrees: 90 | -90
  ) => {
    const sourceImg =
      side === "anverso"
        ? currentExemplar.anverso_image || record.anverso_image
        : currentExemplar.reverso_image || record.reverso_image;

    if (sourceImg) {
      try {
        const currentCssAngle =
          side === "anverso"
            ? currentExemplar.anverso_rotation || 0
            : currentExemplar.reverso_rotation || 0;
        const totalAngle =
          (((currentCssAngle + deltaDegrees) % 360) + 360) % 360;
        const rotatedBase64 = await rotateBase64Image(sourceImg, totalAngle);
        await onUpdateExemplar(
          record.id,
          currentExemplar.id,
          side === "anverso"
            ? { anverso_image: rotatedBase64, anverso_rotation: 0 }
            : { reverso_image: rotatedBase64, reverso_rotation: 0 }
        );
        return;
      } catch (err) {
        console.warn("Falha ao girar imagem no Canvas:", err);
      }
    }

    const currentAngle =
      side === "anverso"
        ? currentExemplar.anverso_rotation || 0
        : currentExemplar.reverso_rotation || 0;
    const nextAngle = (((currentAngle + deltaDegrees) % 360) + 360) % 360;
    await onUpdateExemplar(
      record.id,
      currentExemplar.id,
      side === "anverso"
        ? { anverso_rotation: nextAngle }
        : { reverso_rotation: nextAngle }
    );
  };

  const openEditRecordModal = () => {
    setEditGravura(currentExemplar.gravura || "");
    setEditPais(record.pais || "");
    setEditAno(record.ano || "");
    setEditValorFace(record.valor_face || "");
    setEditUM(record.unidade_monetaria || "");
    setEditCasaMoeda(record.casa_moeda || "");
    setEditMaterial(record.material || "");
    setEditPeso(record.peso_gramas || 0);
    setEditDiametro(record.diametro_mm || 0);
    setEditBordo(record.bordo || "");
    setEditKrauseId(record.krause_id || "");
    setEditNumistaId(record.numista_id || "");
    setEditCuriosidades(record.curiosidades || "");
    setShowEditRecordModal(true);
  };

  const handleSaveRecordEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateRecord) return;
    setIsSavingRecordEdit(true);
    try {
      await onUpdateRecord(record.id, {
        pais: editPais.trim(),
        ano: editAno.trim(),
        valor_face: editValorFace.trim(),
        unidade_monetaria: editUM.trim() || undefined,
        casa_moeda: editCasaMoeda.trim(),
        material: editMaterial.trim(),
        peso_gramas: Number(editPeso) || 0,
        diametro_mm: Number(editDiametro) || 0,
        bordo: editBordo.trim(),
        krause_id: editKrauseId.trim() || undefined,
        numista_id: editNumistaId.trim() || undefined,
        curiosidades: editCuriosidades,
        gravura: editGravura.trim(),
        exemplarId: currentExemplar.id,
      });
      setGravuraExemplar(editGravura.trim());
      setShowEditRecordModal(false);
    } finally {
      setIsSavingRecordEdit(false);
    }
  };

  const handleCreateRepeatedExemplar = async (e: React.FormEvent) => {
    e.preventDefault();
    const newId = await onAddExemplar(record.id, {
      gravura: newGravura.trim() || currentExemplar.gravura,
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
      setSelectedExemplarIndex(exemplares.length);
    }
  };

  const handleBackToCollection = () => {
    if (onBack) {
      onBack();
    }
  };

  const handleSaveManualCrop = async (croppedBase64: string) => {
    if (!cropModalSide) return;
    await onUpdateExemplar(
      record.id,
      currentExemplar.id,
      cropModalSide === "anverso"
        ? {
            anverso_image: croppedBase64,
            anverso_rotation: 0,
            image_standardized: true,
            manual_crop: true,
          }
        : {
            reverso_image: croppedBase64,
            reverso_rotation: 0,
            image_standardized: true,
            manual_crop: true,
          }
    );
  };

  const filteredMergeCandidates = useMemo(() => {
    const candidates = otherRecords.filter((r) => r.id !== record.id);
    const q = mergeSearch.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((item) => {
      const code = (
        item.friendly_code || generateFriendlyCode(item)
      ).toLowerCase();
      return (
        code.includes(q) ||
        item.nome.toLowerCase().includes(q) ||
        item.pais.toLowerCase().includes(q) ||
        item.ano.toLowerCase().includes(q) ||
        (item.unidade_monetaria || "").toLowerCase().includes(q) ||
        (item.krause_id || "").toLowerCase().includes(q)
      );
    });
  }, [otherRecords, record.id, mergeSearch]);

  const handleSelectTargetForMerge = async (targetRecordId: string) => {
    if (!onMergeWithRecord) return;
    setIsMerging(true);
    try {
      await onMergeWithRecord(
        record.id,
        targetRecordId,
        mergeOnlyCurrentExemplar && exemplares.length > 1
          ? currentExemplar.id
          : undefined
      );
      setShowMergeModal(false);
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div className="space-y-5 pb-8">
      {/* Barra superior de navegação (sempre visível e gerenciada internamente sem history.back) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleBackToCollection}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-amber-500/40 hover:text-amber-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Acervo
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {onUpdateRecord && (
            <button
              type="button"
              onClick={openEditRecordModal}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/25"
            >
              <Pencil className="h-3.5 w-3.5 text-amber-400" />
              Editar Informações
            </button>
          )}

          {onMergeWithRecord && otherRecords.some((r) => r.id !== record.id) && (
            <button
              type="button"
              onClick={() => {
                setMergeSearch("");
                setMergeOnlyCurrentExemplar(false);
                setShowMergeModal(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-500/15 px-3 py-2 text-xs font-semibold text-indigo-200 transition hover:bg-indigo-500/25"
            >
              <GitMerge className="h-3.5 w-3.5 text-indigo-400" />
              Mesclar com outro card
            </button>
          )}

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
      </div>

      {/* Modal de Ajuste e Corte Manual 1:1 (600x600) */}
      <CoinCropperModal
        isOpen={cropModalSide !== null}
        imageSrc={
          cropModalSide === "reverso"
            ? currentExemplar.reverso_image || record.reverso_image || ""
            : currentExemplar.anverso_image || record.anverso_image || ""
        }
        sideLabel={
          cropModalSide === "reverso"
            ? `Reverso (${currentExemplarLabel})`
            : `Anverso (${currentExemplarLabel})`
        }
        onClose={() => setCropModalSide(null)}
        onSaveCrop={handleSaveManualCrop}
      />

      {/* Modal de Edição Manual de Informações da Moeda */}
      {showEditRecordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleSaveRecordEdit}
            className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-3xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
                  <Pencil className="h-3 w-3" />
                  Edição Manual de Informações
                </span>
                <h3 className="mt-1.5 text-base font-bold text-slate-100">
                  {formatStandardCoinTitle({
                    valor_face: editValorFace,
                    unidade_monetaria: editUM,
                    nome: record.nome,
                  })}
                </h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  CUB recalculado automaticamente:{" "}
                  <strong className="font-mono text-amber-300">
                    {generateFriendlyCode({
                      ...record,
                      pais: editPais,
                      ano: editAno,
                      valor_face: editValorFace,
                      unidade_monetaria: editUM,
                      material: editMaterial,
                      bordo: editBordo,
                      krause_id: editKrauseId,
                    })}
                  </strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditRecordModal(false)}
                disabled={isSavingRecordEdit}
                className="rounded-xl p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-300">
                    Valor Facial (ex: 50 Centavos, 50 Won)
                  </label>
                  <input
                    type="text"
                    required
                    value={editValorFace}
                    onChange={(e) => setEditValorFace(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-300">
                    Unidade Monetária (UM) (ex: Cruzeiro, Réis)
                  </label>
                  <input
                    type="text"
                    value={editUM}
                    onChange={(e) => setEditUM(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-[11px] font-medium text-slate-300">
                    País
                  </label>
                  <input
                    type="text"
                    required
                    value={editPais}
                    onChange={(e) => setEditPais(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-300">
                    Ano
                  </label>
                  <input
                    type="text"
                    required
                    value={editAno}
                    onChange={(e) => setEditAno(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-300">
                  Gravura / Tema Artístico deste Exemplar ({currentExemplarLabel})
                </label>
                <input
                  type="text"
                  value={editGravura}
                  onChange={(e) => setEditGravura(e.target.value)}
                  placeholder="Ex: Plano Piloto de Brasília, Dom Pedro II..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-300">
                    Casa da Moeda
                  </label>
                  <input
                    type="text"
                    value={editCasaMoeda}
                    onChange={(e) => setEditCasaMoeda(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-300">
                    Material / Composição
                  </label>
                  <input
                    type="text"
                    value={editMaterial}
                    onChange={(e) => setEditMaterial(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-300">
                    Peso Oficial (g)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editPeso}
                    onChange={(e) => setEditPeso(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-300">
                    Diâmetro / Largura (mm)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editDiametro}
                    onChange={(e) => setEditDiametro(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-300">
                    Bordo
                  </label>
                  <input
                    type="text"
                    value={editBordo}
                    onChange={(e) => setEditBordo(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-300">
                    Catálogo Krause / Pick (KM# / P#)
                  </label>
                  <input
                    type="text"
                    value={editKrauseId}
                    onChange={(e) => setEditKrauseId(e.target.value)}
                    placeholder="Ex: KM# 594"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-300">
                    Numista ID (N#)
                  </label>
                  <input
                    type="text"
                    value={editNumistaId}
                    onChange={(e) => setEditNumistaId(e.target.value)}
                    placeholder="Ex: N# 4512"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-300">
                  Curiosidades / Contexto Histórico
                </label>
                <textarea
                  rows={3}
                  value={editCuriosidades}
                  onChange={(e) => setEditCuriosidades(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs leading-relaxed text-slate-100 focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => setShowEditRecordModal(false)}
                disabled={isSavingRecordEdit}
                className="rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSavingRecordEdit}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                Salvar Informações
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal de Fusão Manual de Cards / Mover Exemplar */}
      {showMergeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-3xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-300">
                  <GitMerge className="h-3 w-3" />
                  Fusão Manual de Cards / Mover Exemplar
                </span>
                <h3 className="mt-1.5 text-base font-bold text-slate-100">
                  Transferir de{" "}
                  <span className="font-mono text-amber-300">
                    CUB {cubCode}
                  </span>
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  Selecione abaixo o card correto do seu acervo para unificar os
                  exemplares físicos e apagar o card duplicado:
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMergeModal(false)}
                disabled={isMerging}
                className="rounded-xl p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {exemplares.length > 1 && (
              <div className="mt-3 flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/80 p-2.5 text-xs text-slate-300">
                <input
                  id="mergeOnlyCurrent"
                  type="checkbox"
                  checked={mergeOnlyCurrentExemplar}
                  onChange={(e) =>
                    setMergeOnlyCurrentExemplar(e.target.checked)
                  }
                  className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-amber-500"
                />
                <label htmlFor="mergeOnlyCurrent" className="cursor-pointer">
                  Mover apenas{" "}
                  <strong className="text-amber-300">
                    {currentExemplarLabel}
                  </strong>{" "}
                  (manter os outros {exemplares.length - 1} neste card)
                </label>
              </div>
            )}

            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={mergeSearch}
                onChange={(e) => setMergeSearch(e.target.value)}
                placeholder="Buscar card destino por CUB, nome, país ou ano..."
                className="w-full rounded-2xl border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-4 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
              {filteredMergeCandidates.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">
                  Nenhum outro card encontrado para o filtro informado.
                </p>
              ) : (
                filteredMergeCandidates.map((candidate) => {
                  const candidateCode =
                    candidate.friendly_code || generateFriendlyCode(candidate);
                  const candidateCount = candidate.exemplares?.length || 1;
                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      disabled={isMerging}
                      onClick={() => handleSelectTargetForMerge(candidate.id)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/90 p-3 text-left transition hover:border-amber-500/50 hover:bg-slate-900 disabled:opacity-50"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
                        {candidate.anverso_image ? (
                          <img
                            src={candidate.anverso_image}
                            alt={candidate.nome}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <Coins className="h-5 w-5 text-amber-400/70" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded border border-amber-400/40 bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-200">
                            CUB {candidateCode}
                          </span>
                          <span className="text-[11px] font-semibold text-amber-400">
                            {candidate.pais} • {candidate.ano}
                          </span>
                          <span className="rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300">
                            {candidateCount}{" "}
                            {candidateCount === 1 ? "exemplar" : "exemplares"}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs font-bold text-slate-100">
                          {formatStandardCoinTitle(candidate)}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowMergeModal(false)}
              disabled={isMerging}
              className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-800/80 py-2.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Cabeçalho da Ficha Técnica de Referência */}
      <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30 p-5 shadow-xl">
        {/* Badges Superiores com CUB (Código Universal de Base) em evidência máxima, País, Unidade Monetária, Ano */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            title="CUB — Código Universal de Base"
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/60 bg-amber-500/25 px-3.5 py-1 font-mono text-xs font-extrabold tracking-wide text-amber-100 shadow-sm"
          >
            <Tag className="h-3.5 w-3.5 text-amber-400" />
            CUB: {cubCode}
          </span>
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

        {/* Título Padronizado Estrito: [Valor Facial] - [Unidade Monetária] */}
        <h1 className="mt-3 text-xl font-bold tracking-tight text-slate-50 sm:text-2xl">
          {standardTitle}
        </h1>
        <p className="mt-1 text-xs text-slate-400">
          Gravura do Exemplar:{" "}
          <strong className="text-amber-300">{currentExemplarLabel}</strong> •
          Casa da Moeda:{" "}
          <strong className="text-slate-200">{record.casa_moeda}</strong>
        </p>

        {/* Informações Adicionais Secundárias: KM# e Numista ID (N#) para consulta rápida */}
        {(record.krause_id || record.numista_id) && (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
            {record.krause_id && (
              <span>
                Catálogo Krause/Pick:{" "}
                <strong className="font-mono text-slate-200">
                  {record.krause_id}
                </strong>
              </span>
            )}
            {record.numista_id && (
              <span>
                Numista ID:{" "}
                <strong className="font-mono text-slate-200">
                  {record.numista_id}
                </strong>
              </span>
            )}
          </div>
        )}

        {/* Seletor rápido de Exemplares no topo quando houver mais de 1 exemplar */}
        {exemplares.length > 1 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-indigo-500/30 bg-slate-950/80 p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {exemplares.map((ex, idx) => {
                const isSelected = idx === currentExemplarIndex;
                const label =
                  exemplarDisplayLabels[idx] || `Exemplar #${idx + 1}`;
                return (
                  <button
                    key={ex.id || idx}
                    type="button"
                    onClick={() => setSelectedExemplarIndex(idx)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                      isSelected
                        ? "bg-amber-500 text-slate-950 shadow"
                        : "border border-slate-800 bg-slate-900 text-slate-300 hover:border-amber-500/40"
                    }`}
                  >
                    {label}
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

        {/* Fotografias de Anverso/Reverso do Exemplar Físico Selecionado com Ferramenta de Rotação */}
        {(currentExemplar.anverso_image ||
          currentExemplar.reverso_image ||
          record.anverso_image ||
          record.reverso_image) && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {(currentExemplar.anverso_image || record.anverso_image) && (
              <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-2 text-center">
                {/* Botões de Crop/Ajustar e Rotação Rápida 90° (Anverso) */}
                <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-xl border border-slate-700/80 bg-slate-900/90 p-1 shadow backdrop-blur-sm">
                  <button
                    type="button"
                    onClick={() => setCropModalSide("anverso")}
                    title="Recortar e ajustar Anverso manualmente"
                    className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 px-2 py-1 text-[10px] font-semibold text-amber-300 transition hover:bg-amber-500/30"
                  >
                    <Crop className="h-3 w-3" />
                    <span>Crop/Ajustar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRotateImage("anverso", -90)}
                    title="Girar Anverso 90° no sentido anti-horário"
                    className="rounded-lg p-1 text-slate-300 transition hover:bg-amber-500/20 hover:text-amber-300"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRotateImage("anverso", 90)}
                    title="Girar Anverso 90° no sentido horário"
                    className="rounded-lg p-1 text-slate-300 transition hover:bg-amber-500/20 hover:text-amber-300"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex h-36 items-center justify-center overflow-hidden sm:h-44">
                  <img
                    src={currentExemplar.anverso_image || record.anverso_image}
                    alt="Anverso"
                    style={
                      currentExemplar.anverso_rotation
                        ? {
                            transform: `rotate(${currentExemplar.anverso_rotation}deg)`,
                          }
                        : undefined
                    }
                    className="mx-auto max-h-32 max-w-full object-contain sm:max-h-40"
                  />
                </div>
                <span className="mt-1 block text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  Anverso ({currentExemplarLabel})
                </span>
              </div>
            )}
            {(currentExemplar.reverso_image || record.reverso_image) && (
              <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-2 text-center">
                {/* Botões de Crop/Ajustar e Rotação Rápida 90° (Reverso) */}
                <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-xl border border-slate-700/80 bg-slate-900/90 p-1 shadow backdrop-blur-sm">
                  <button
                    type="button"
                    onClick={() => setCropModalSide("reverso")}
                    title="Recortar e ajustar Reverso manualmente"
                    className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 px-2 py-1 text-[10px] font-semibold text-amber-300 transition hover:bg-amber-500/30"
                  >
                    <Crop className="h-3 w-3" />
                    <span>Crop/Ajustar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRotateImage("reverso", -90)}
                    title="Girar Reverso 90° no sentido anti-horário"
                    className="rounded-lg p-1 text-slate-300 transition hover:bg-amber-500/20 hover:text-amber-300"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRotateImage("reverso", 90)}
                    title="Girar Reverso 90° no sentido horário"
                    className="rounded-lg p-1 text-slate-300 transition hover:bg-amber-500/20 hover:text-amber-300"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex h-36 items-center justify-center overflow-hidden sm:h-44">
                  <img
                    src={currentExemplar.reverso_image || record.reverso_image}
                    alt="Reverso"
                    style={
                      currentExemplar.reverso_rotation
                        ? {
                            transform: `rotate(${currentExemplar.reverso_rotation}deg)`,
                          }
                        : undefined
                    }
                    className="mx-auto max-h-32 max-w-full object-contain sm:max-h-40"
                  />
                </div>
                <span className="mt-1 block text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  Reverso ({currentExemplarLabel})
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
              Alterne entre os exemplares para comparar gravura, fotos, estado
              de conservação e notas:
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onMergeWithRecord && otherRecords.some((r) => r.id !== record.id) && (
              <button
                type="button"
                onClick={() => {
                  setMergeSearch("");
                  setMergeOnlyCurrentExemplar(exemplares.length > 1);
                  setShowMergeModal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-500/15 px-3 py-1.5 text-xs font-semibold text-indigo-200 transition hover:bg-indigo-500/25"
              >
                <GitMerge className="h-3.5 w-3.5 text-indigo-400" />
                Mover Exemplar
              </button>
            )}

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
              onClick={() => {
                setNewGravura(currentExemplar.gravura || "");
                setShowAddModal((prev) => !prev);
              }}
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
            const isSelected = idx === currentExemplarIndex;
            const label =
              exemplarDisplayLabels[idx] || `Exemplar #${idx + 1}`;
            return (
              <button
                key={ex.id || idx}
                type="button"
                onClick={() => setSelectedExemplarIndex(idx)}
                className={`flex flex-col items-start rounded-2xl border px-3.5 py-2 text-left transition ${
                  isSelected
                    ? "border-amber-400 bg-amber-500/15 text-slate-50 shadow"
                    : "border-slate-800 bg-slate-950/70 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-amber-300">
                    {label}
                  </span>
                  {ex.variantes_confirmadas?.length > 0 && (
                    <span className="rounded bg-amber-400/20 px-1.5 py-0.2 text-[10px] font-semibold text-amber-300">
                      ★ Variante
                    </span>
                  )}
                </div>
                <span className="mt-0.5 max-w-[180px] truncate text-[11px]">
                  {ex.estado_conservacao}
                </span>
                {ex.local_armazenamento && (
                  <span className="max-w-[180px] truncate text-[10px] text-slate-400">
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
              Novo Exemplar Físico de {standardTitle} ({record.ano})
            </p>
            <div>
              <label className="mb-1 block text-[11px] text-slate-300">
                Gravura / Tema Artístico do Exemplar
              </label>
              <input
                type="text"
                value={newGravura}
                onChange={(e) => setNewGravura(e.target.value)}
                placeholder="Ex: Plano Piloto de Brasília"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
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
              Marque as variações identificadas em{" "}
              <strong className="text-slate-200">
                {currentExemplarLabel}
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
              Dados Individuais — {currentExemplarLabel}
            </h3>
            <p className="text-[11px] text-slate-400">
              Edite a gravura, graduação de conservação, faixa de valor, local de
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

        <div>
          <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-300">
            Gravura / Tema Artístico deste Exemplar
          </label>
          <input
            type="text"
            value={gravuraExemplar}
            onChange={(e) => setGravuraExemplar(e.target.value)}
            placeholder="Ex: Plano Piloto de Brasília, Efígie da República, Caravela..."
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
          />
          <p className="mt-1 text-[10px] text-slate-400">
            Se houver múltiplos exemplares com a mesma gravura, eles serão numerados automaticamente (ex: Gravura #1, Gravura #2).
          </p>
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
