import { jest } from "@jest/globals";

/**
 * Testes de integração do ingressoController via Supertest.
 *
 * Mocks: dotenv-safe, connect, testConnect.
 * Cobre: CRUD completo + busca por evento + erros de banco.
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.unstable_mockModule("dotenv-safe/config.js", () => ({}));

const mockQuery = jest.fn();
jest.unstable_mockModule("../src/db/connect.js", () => ({
  default: { query: mockQuery },
}));

jest.unstable_mockModule("../src/db/testConnect.js", () => ({
  default: jest.fn(),
}));

// ─── Imports dinâmicos (APÓS mocks) ──────────────────────────────────────────

const { default: supertest } = await import("supertest");
const { default: app } = await import("../src/index.js");
const request = supertest(app);

// ─── POST /api/v1/ingresso ────────────────────────────────────────────────────

describe("POST /api/v1/ingresso - createIngresso", () => {
  beforeEach(() => mockQuery.mockReset());

  it("CT01 - 400 quando faltam campos obrigatórios", async () => {
    const res = await request
      .post("/api/v1/ingresso")
      .send({ preco: 50 });
    // falta tipo e fk_id_evento

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty(
      "error",
      "Todos os campos devem ser preenchidos"
    );
  });

  it("CT02 - 200 quando ingresso é criado com sucesso", async () => {
    mockQuery.mockImplementation((_q, _v, cb) =>
      cb(null, { insertId: 1 })
    );

    const res = await request.post("/api/v1/ingresso").send({
      preco: 150.0,
      tipo: "VIP",
      fk_id_evento: 1,
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message", "Ingresso criado com sucesso");
  });

  it("CT02b - 500 quando ocorre erro ao criar ingresso", async () => {
    mockQuery.mockImplementation((_q, _v, cb) =>
      cb(new Error("DB Error"), null)
    );

    const res = await request.post("/api/v1/ingresso").send({
      preco: 150.0,
      tipo: "VIP",
      fk_id_evento: 1,
    });

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("error", "Erro ao criar o ingresso");
  });
});

// ─── GET /api/v1/ingresso ─────────────────────────────────────────────────────

describe("GET /api/v1/ingresso - getAllIngressos", () => {
  beforeEach(() => mockQuery.mockReset());

  it("CT03 - 200 retorna lista de ingressos com nome do evento", async () => {
    const fakeIngressos = [
      { id_ingresso: 1, preco: 100, tipo: "Inteira", nome_evento: "Rock Fest" },
      { id_ingresso: 2, preco: 50, tipo: "Meia", nome_evento: "Rock Fest" },
    ];
    mockQuery.mockImplementation((_q, cb) => cb(null, fakeIngressos));

    const res = await request.get("/api/v1/ingresso");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("ingressos");
    expect(res.body.ingressos).toHaveLength(2);
    expect(res.body.ingressos[0]).toHaveProperty("nome_evento");
  });

  it("CT03b - 500 quando ocorre erro no banco", async () => {
    mockQuery.mockImplementation((_q, cb) =>
      cb(new Error("DB Error"), null)
    );

    const res = await request.get("/api/v1/ingresso");

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("error", "Erro ao buscar ingressos");
  });
});

// ─── GET /api/v1/ingresso/evento/:id ─────────────────────────────────────────

describe("GET /api/v1/ingresso/evento/:id - getByIdEvento", () => {
  beforeEach(() => mockQuery.mockReset());

  it("CT04 - 200 retorna ingressos de um evento específico", async () => {
    const fakeIngressos = [
      {
        id_ingresso: 1,
        preco: 200,
        tipo: "VIP",
        fk_id_evento: 3,
        nome_evento: "Jazz Night",
      },
    ];
    mockQuery.mockImplementation((_q, _v, cb) =>
      cb(null, fakeIngressos)
    );

    const res = await request.get("/api/v1/ingresso/evento/3");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("ingressos");
    expect(res.body.ingressos).toHaveLength(1);
    expect(res.body.ingressos[0]).toHaveProperty("nome_evento", "Jazz Night");
  });

  it("CT04b - 200 retorna lista vazia quando evento não possui ingressos", async () => {
    mockQuery.mockImplementation((_q, _v, cb) => cb(null, []));

    const res = await request.get("/api/v1/ingresso/evento/999");

    expect(res.status).toBe(200);
    expect(res.body.ingressos).toHaveLength(0);
  });
});

// ─── PUT /api/v1/ingresso ─────────────────────────────────────────────────────

describe("PUT /api/v1/ingresso - updateIngresso", () => {
  beforeEach(() => mockQuery.mockReset());

  it("CT05 - 400 quando faltam campos obrigatórios", async () => {
    const res = await request
      .put("/api/v1/ingresso")
      .send({ preco: 100 });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty(
      "error",
      "Todos os campos devem ser preenchidos"
    );
  });

  it("CT06 - 404 quando ingresso não é encontrado", async () => {
    mockQuery.mockImplementation((_q, _v, cb) =>
      cb(null, { affectedRows: 0 })
    );

    const res = await request.put("/api/v1/ingresso").send({
      id_ingresso: 999,
      preco: 200,
      tipo: "VIP",
      fk_id_evento: 1,
    });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error", "Ingresso não encontrado");
  });

  it("CT07 - 200 quando ingresso é atualizado com sucesso", async () => {
    mockQuery.mockImplementation((_q, _v, cb) =>
      cb(null, { affectedRows: 1 })
    );

    const res = await request.put("/api/v1/ingresso").send({
      id_ingresso: 1,
      preco: 250,
      tipo: "Premium",
      fk_id_evento: 2,
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty(
      "message",
      "Ingresso atualizado com sucesso"
    );
  });
});

// ─── DELETE /api/v1/ingresso/:id ─────────────────────────────────────────────

describe("DELETE /api/v1/ingresso/:id - deleteIngresso", () => {
  beforeEach(() => mockQuery.mockReset());

  it("CT08 - 404 quando ingresso não é encontrado", async () => {
    mockQuery.mockImplementation((_q, _v, cb) =>
      cb(null, { affectedRows: 0 })
    );

    const res = await request.delete("/api/v1/ingresso/999");

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error", "Ingresso não encontrado");
  });

  it("CT09 - 200 quando ingresso é excluído com sucesso", async () => {
    mockQuery.mockImplementation((_q, _v, cb) =>
      cb(null, { affectedRows: 1 })
    );

    const res = await request.delete("/api/v1/ingresso/1");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty(
      "message",
      "Ingresso excluído com sucesso"
    );
  });
});
