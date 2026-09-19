import { describe, it, expect } from "vitest";
import { phone, parseContacts, csvSafe, metrics } from "@/lib/domain";
import { demo } from "@/lib/demo";
describe("contatos", () => {
  it("normaliza número brasileiro e preserva internacional", () => {
    expect(phone("(11) 99999-8888")).toBe("+5511999998888");
    expect(phone("+55 11 99999-8888")).toBe("+5511999998888");
    expect(phone("+351 912345678")).toBe("+351912345678");
    expect(phone("+1 (415) 555-2671")).toBe("+14155552671");
  });
  it("recusa número incompleto", () => expect(() => phone("999")).toThrow());
  it("identifica duplicatas normalizadas e linhas inválidas", () => {
    const r = parseContacts(
      "nome,telefone\nMaria,11999998888\nOutra,+5511999998888\nSem,9",
      [],
    );
    expect(r.rows).toHaveLength(1);
    expect(r.errors).toHaveLength(2);
  });
  it("lê CSV separado por ponto e vírgula e campo com vírgula", () => {
    const r = parseContacts(
      'nome;telefone;origem\n"Maria, Silva";11999998888;Indicação',
      [],
    );
    expect(r.rows[0].name).toBe("Maria, Silva");
    expect(r.errors).toEqual([]);
  });
  it("exige cabeçalhos", () =>
    expect(parseContacts("name,number\nMaria,11", []).rows).toHaveLength(0));
  it("neutraliza fórmulas na exportação", () =>
    expect(csvSafe('=HYPERLINK("https://example.com")')).toMatch(/^'/));
});
describe("resultados", () => {
  it("usa eventos de cada período", () => {
    const s = demo();
    expect(metrics(s)).toEqual({
      entered: 8,
      talked: 3,
      won: 2,
      revenue: 3050,
    });
    s.events[0].created_at = "2020-01-01";
    expect(metrics(s).entered).toBe(7);
  });
  it("subtrai uma conquista desfeita", () => {
    const s = demo();
    s.events.push({
      id: "undo",
      tenant_id: "demo",
      entity: "deals",
      entity_id: s.deals[4].id,
      kind: "unwon",
      payload: { value: 2400 },
      created_at: new Date().toISOString(),
    });
    expect(metrics(s).revenue).toBe(650);
    expect(metrics(s).won).toBe(1);
  });
});
