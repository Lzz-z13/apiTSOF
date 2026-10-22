import { jest } from "@jest/globals";

/**
 * Testes de integração do organizadorController via Supertest.
 *
 * Mocks: dotenv-safe, connect, testConnect.
 * Cobre: CRUD completo + validações de email/telefone + erros de banco.
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

// ─── POST /api/v1/organizador ─────────────────────────────────────────────────

describe("POST /api/v1/organizador - createOrganizador", () => {
  const organizadorValido = {
    nome: "Empresa XYZ",
    email: "contato@xyz.com",
    senha: "senha123",
    telefone: "11987654321",
  };

  beforeEach(() => mockQuery.mockReset());

  it("CT01 - 400 quando faltam campos obrigatórios", async () => {
    const res = await request
      .post("/api/v1/organizador")
      .send({ nome: "Só o nome" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty(
      "error",
      "Todos os campos devem ser preenchidos"
    );
  });

  it("CT02 - 400 quando email não contém @", async () => {
    const res = await request
      .post("/api/v1/organizador")
      .send({ ...organizadorValido, email: "email-invalido.com" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Email inválido. Deve conter @");
  });

  it("CT03 - 400 quando telefone tem menos de 11 dígitos", async () => {
    const res = await request
      .post("/api/v1/organizador")
      .send({ ...organizadorValido, telefone: "1198765" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty(
      "error",
      "Telefone inválido. Deve conter exatamente 11 dígitos numéricos"
    );
  });

  it("CT03b - 400 quando telefone contém letras", async () => {
    const res = await request
      .post("/api/v1/organizador")
      .send({ ...organizadorValido, telefone: "1198765432A" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty(
      "error",
      "Telefone inválido. Deve conter exatamente 11 dígitos numéricos"
    );
  });

  it("CT04 - 201 quando organizador é criado com sucesso", async () => {
    mockQuery.mockImplementation((_q, _v, cb) =>
      cb(null, { insertId: 1 })
    );

    const res = await request
      .post("/api/v1/organizador")
      .send(organizadorValido);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty(
      "message",
      "Organizador criado com sucesso"
    );
  });

  it("CT05 - 400 quando email já está cadastrado (ER_DUP_ENTRY)", async () => {
    const dupError = Object.assign(new Error("Duplicate"), {
      code: "ER_DUP_ENTRY",
    });
    mockQuery.mockImplementation((_q, _v, cb) => cb(dupError, null));

    const res = await request
      .post("/api/v1/organizador")
      .send(organizadorValido);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Email já cadastrado");
  });
});

// ─── GET /api/v1/organizador ──────────────────────────────────────────────────

describe("GET /api/v1/organizador - getAllOrganizadores", () => {
  beforeEach(() => mockQuery.mockReset());

  it("CT06 - 200 retorna lista de organizadores", async () => {
    const fakeOrganizadores = [
      { id_organizador: 1, nome: "Org A", email: "a@org.com" },
      { id_organizador: 2, nome: "Org B", email: "b@org.com" },
    ];
    mockQuery.mockImplementation((_q, cb) => cb(null, fakeOrganizadores));

    const res = await request.get("/api/v1/organizador");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("organizadores");
    expect(res.body.organizadores).toHaveLength(2);
  });

  it("CT06b - 500 quando ocorre erro no banco", async () => {
    mockQuery.mockImplementation((_q, cb) =>
      cb(new Error("DB Error"), null)
    );

    const res = await request.get("/api/v1/organizador");

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("error", "Erro interno do servidor");
  });
});

// ─── PUT /api/v1/organizador ──────────────────────────────────────────────────

describe("PUT /api/v1/organizador - updateOrganizador", () => {
  beforeEach(() => mockQuery.mockReset());

  it("CT07 - 400 quando faltam campos obrigatórios", async () => {
    const res = await request
      .put("/api/v1/organizador")
      .send({ nome: "Só o nome" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty(
      "error",
      "Todos os campos devem ser preenchidos"
    );
  });

  it("CT08 - 404 quando organizador não é encontrado", async () => {
    mockQuery.mockImplementation((_q, _v, cb) =>
      cb(null, { affectedRows: 0 })
    );

    const res = await request.put("/api/v1/organizador").send({
      id: 999,
      nome: "Novo Nome",
      email: "novo@org.com",
      senha: "novaSenha",
      telefone: "11987654321",
    });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error", "Organizador não encontrado");
  });

  it("CT09 - 200 quando organizador é atualizado com sucesso", async () => {
    mockQuery.mockImplementation((_q, _v, cb) =>
      cb(null, { affectedRows: 1 })
    );

    const res = await request.put("/api/v1/organizador").send({
      id: 1,
      nome: "Nome Atualizado",
      email: "atualizado@org.com",
      senha: "novaSenha",
      telefone: "11987654321",
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty(
      "message",
      "Organizador atualizado com sucesso"
    );
  });

  it("CT09b - 400 quando email já cadastrado por outro usuário (ER_DUP_ENTRY)", async () => {
    const dupError = Object.assign(new Error("Duplicate email"), {
      code: "ER_DUP_ENTRY",
    });
    mockQuery.mockImplementation((_q, _v, cb) => cb(dupError, null));

    const res = await request.put("/api/v1/organizador").send({
      id: 1,
      nome: "Nome",
      email: "duplicado@org.com",
      senha: "senha",
      telefone: "11987654321",
    });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty(
      "error",
      "Email já cadastrado por outro usuário"
    );
  });

  it("CT09c - 500 quando ocorre erro no banco ao atualizar", async () => {
    mockQuery.mockImplementation((_q, _v, cb) =>
      cb(new Error("DB Error"), null)
    );

    const res = await request.put("/api/v1/organizador").send({
      id: 1,
      nome: "Nome",
      email: "novo@org.com",
      senha: "senha",
      telefone: "11987654321",
    });

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("error", "Erro interno do servidor");
  });
});

// ─── DELETE /api/v1/organizador/:id ──────────────────────────────────────────

describe("DELETE /api/v1/organizador/:id - deleteOrganizador", () => {
  beforeEach(() => mockQuery.mockReset());

  it("CT10 - 404 quando organizador não é encontrado", async () => {
    mockQuery.mockImplementation((_q, _v, cb) =>
      cb(null, { affectedRows: 0 })
    );

    const res = await request.delete("/api/v1/organizador/999");

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error", "Organizador não encontrado");
  });

  it("CT11 - 200 quando organizador é excluído com sucesso", async () => {
    mockQuery.mockImplementation((_q, _v, cb) =>
      cb(null, { affectedRows: 1 })
    );

    const res = await request.delete("/api/v1/organizador/1");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty(
      "message",
      "Organizador excluído com sucesso"
    );
  });
});
