"use client";
import { useState } from "react";
import type { FinanceEntry, DreGroup } from "@/lib/types";
import {
  financeCategories,
  categoryGroup,
  dreLabels,
  effectiveDreGroup,
} from "@/lib/finance-categories";
export function FinanceCategory({
  value,
  onChange,
}: {
  value: FinanceEntry;
  onChange: (patch: Partial<FinanceEntry>) => void;
}) {
  const [custom, setCustom] = useState(false);
  const mapped = categoryGroup(value.direction, value.category);
  const options = financeCategories.filter(
    (g) => g.direction === value.direction,
  );
  const group = effectiveDreGroup(value);
  const categorySection = options.find((g) =>
    g.categories.includes(value.category.trim()),
  );
  const isCapex = categorySection?.label.startsWith("CAPEX");
  const manualGroups = [...new Map(options.map((g) => [g.key, g])).values()];
  return (
    <>
      <label>
        Categoria
        <select
          aria-label="Categoria"
          required
          value={custom ? "__custom" : value.category}
          onChange={(e) => {
            if (e.target.value === "__custom") {
              setCustom(true);
              onChange({
                category: "",
                dre_group: value.direction === "income" ? "revenue" : "expense",
              });
            } else {
              setCustom(false);
              onChange({
                category: e.target.value,
                dre_group:
                  categoryGroup(value.direction, e.target.value) || group,
              });
            }
          }}
        >
          <option value="" disabled>
            Selecione a categoria
          </option>
          {!custom && value.category && !mapped && (
            <option value={value.category}>
              Categoria existente: {value.category}
            </option>
          )}
          {options.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.categories.map((c) => (
                <option key={c} value={c}>
                  {g.label.startsWith("CAPEX") ? `CAPEX — ${c}` : c}
                </option>
              ))}
            </optgroup>
          ))}
          <option value="__custom">Outra categoria — definir grupo</option>
        </select>
      </label>
      {custom && (
        <label>
          Nome da categoria
          <input
            required
            maxLength={100}
            value={value.category}
            onChange={(e) =>
              onChange({
                category: e.target.value,
                ...(categoryGroup(value.direction, e.target.value)
                  ? {
                      dre_group: categoryGroup(value.direction, e.target.value),
                    }
                  : {}),
              })
            }
          />
        </label>
      )}
      {mapped ? (
        <p className="management-hint">
          Classificação automática:{" "}
          <strong>
            {isCapex ? categorySection?.label : dreLabels[mapped]}
          </strong>
          .
        </p>
      ) : value.category || custom ? (
        <label>
          Grupo na DRE
          <select
            value={group}
            onChange={(e) =>
              onChange({ dre_group: e.target.value as DreGroup })
            }
          >
            {manualGroups.map((g) => (
              <option key={g.key} value={g.key}>
                {g.label}
              </option>
            ))}
            {group === "tax" && <option value="tax">{dreLabels.tax}</option>}
          </select>
        </label>
      ) : null}
      {(mapped || group) === "non_dre" && (
        <p className="management-hint">
          {isCapex
            ? "Investimento em ativos (CAPEX). O pagamento fica registrado no financeiro, fora do resultado da DRE gerencial por caixa."
            : "Este movimento afeta o caixa, mas não o resultado da DRE. Registre os juros separadamente do principal."}
        </p>
      )}
      {value.category === "Simples Nacional (DAS integral)" && (
        <p className="management-hint">
          Use o DAS integral ou seus componentes separados. Não registre os dois
          para evitar duplicidade.
        </p>
      )}
    </>
  );
}
