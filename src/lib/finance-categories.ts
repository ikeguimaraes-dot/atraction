import catalog from "@/data/finance-categories.json";
import type { DreGroup, FinanceEntry } from "./types";
export const financeCategories = catalog as {
  key: DreGroup;
  label: string;
  direction: "income" | "expense";
  categories: string[];
}[];
export const dreLabels: Record<DreGroup, string> = {
  revenue: "Receita operacional bruta",
  sales_deduction: "Deduções da receita",
  cost: "Custos dos produtos e serviços",
  personnel: "Despesas com pessoal administrativo",
  sales: "Despesas comerciais e marketing",
  expense: "Despesas administrativas",
  financial_revenue: "Receitas financeiras",
  financial_expense: "Despesas financeiras",
  other_revenue: "Outras receitas operacionais",
  other_expense: "Outras despesas operacionais",
  income_tax: "Tributos sobre o lucro",
  non_dre: "Fora da DRE — movimento patrimonial",
  tax: "Tributos sem detalhamento (legado)",
};
export function categoryGroup(
  direction: FinanceEntry["direction"],
  category: string,
) {
  return financeCategories.find(
    (g) => g.direction === direction && g.categories.includes(category.trim()),
  )?.key;
}
export function effectiveDreGroup(
  f: Pick<FinanceEntry, "direction" | "dre_group">,
): DreGroup {
  if (f.direction === "income")
    return [
      "revenue",
      "financial_revenue",
      "other_revenue",
      "non_dre",
    ].includes(f.dre_group || "")
      ? f.dre_group!
      : "revenue";
  return f.dre_group &&
    !["revenue", "financial_revenue", "other_revenue"].includes(f.dre_group)
    ? f.dre_group
    : "expense";
}
