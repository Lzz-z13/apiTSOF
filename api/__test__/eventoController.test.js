import { jest } from "@jest/globals";
import jwt from "jsonwebtoken";

/**
 * Testes de integração do eventoController via Supertest.
 *
 * Nota: a rota POST /evento usa multer (upload.single("imagem")).
 * Suporta multipart/form-data com ou sem arquivo.
 *
 * Mocks: dotenv-safe, connect, testConnect.
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

const generateToken = (id = 1) =>
  jwt.sign({ id }, process.env.SECRET, { expiresIn: "1h" });

// ─── POST /api/v1/evento ─────────────────────────────────────────────────────

describe("POST /api/v1/evento - createEvento", () => {
  beforeEach(() => mockQuery.mockReset());

  it("CT01 - 400 quando faltam campos obrigatórios", async () => {
    const res = await request
      .post("/api/v1/evento")
      .field("nome", "Evento Teste");
    // falta descricao, data_hora, local, fk_id_organizador

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty(
      "error",
      "Todos os campos devem ser preenchidos"
    );
  });

  it("CT02 - 201 quando evento é criado com sucesso (sem imagem)", async () => {
    mockQuery.mockImplementation((_q, _v, cb) =>
      cb(null, { insertId: 1 })
    );

    const res = await request
      .post("/api/v1/evento")
      .field("nome", "Show de Rock")
      .field("descricao", "Incrível show ao vivo")
      .field("data_hora", "2026-12-01 20:00:00")
      .field("local", "Arena São Paulo")
      .field("fk_id_organizador", "1");

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("message", "Evento criado com sucesso");
  });

  it("CT02b - 500 quando ocorre erro ao criar o evento", async () => {
    mockQuery.mockImplementation((_q, _v, cb) =>
      cb(new Error("DB Error"), null)
    );

    const res = await request
      .post("/api/v1/evento")
      .field("nome", "Show de Rock")
      .field("descricao", "Incrível show ao vivo")
      .field("data_hora", "2026-12-01 20:00:00")
      .field("local", "Arena São Paulo")
      .field("fk_id_organizador", "1");

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("error", "Erro ao criar o evento");
  });

  it("CT02c - 201 quando evento é criado com upload de imagem", async () => {
    mockQuery.mockImplementation((_q, _v, cb) =>
      cb(null, { insertId: 10 })
    );

    const fakeImageBuffer = Buffer.from("fake-png-data");

    const res = await request
      .post("/api/v1/evento")
      .field("nome", "Festival de Cinema")
      .field("descricao", "Mostra internacional")
      .field("data_hora", "2026-12-10 19:00:00")
      .field("local", "Cineclube")
      .field("fk_id_organizador", "2")
      .attach("imagem", fakeImageBuffer, {
        filename: "poster.png",
        contentType: "image/png",
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("message", "Evento criado com sucesso");
  });
});

// ─── GET /api/v1/evento ───────────────────────────────────────────────────────

describe("GET /api/v1/evento - getAllEventos", () => {
  beforeEach(() => mockQuery.mockReset());

  it("CT03 - 200 retorna lista de eventos", async () => {
    const fakeEventos = [
      { id_evento: 1, nome: "Rock Festival", local: "Arena SP" },
      { id_evento: 2, nome: "Jazz Night", local: "Teatro Municipal" },
    ];
    mockQuery.mockImplementation((_q, cb) => cb(null, fakeEventos));

    const res = await request.get("/api/v1/evento");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("events");
    expect(res.body.events).toHaveLength(2);
  });

  it("CT03b - 500 quando ocorre erro no banco", async () => {
    mockQuery.mockImplementation((_q, cb) =>
      cb(new Error("DB Error"), null)
    );

    const res = await request.get("/api/v1/evento");

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("error", "Erro ao buscar eventos");
  });
});

// ─── PUT /api/v1/evento ───────────────────────────────────────────────────────

describe("PUT /api/v1/evento - updateEvento", () => {
  const eventoValido = {
    id_evento: 1,
    nome: "Show Atualizado",
    descricao: "Descrição nova",
    data_hora: "2026-12-15 20:00:00",
    local: "Novo Local",
    fk_id_organizador: 1,
  };

  beforeEach(() => mockQuery.mockReset());

  it("CT04 - 400 quando faltam campos obrigatórios", async () => {
    const res = await request
      .put("/api/v1/evento")
      .send({ nome: "Só o nome" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty(
      "error",
      "Todos os campos devem ser preenchidos"
    );
  });

  it("CT05 - 404 quando evento não é encontrado", async () => {
    mockQuery.mockImplementation((_q, _v, cb) =>
      cb(null, { affectedRows: 0 })
    );

    const res = await request
      .put("/api/v1/evento")
      .send(eventoValido);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error", "Evento não encontrado");
  });

  it("CT06 - 200 quando evento é atualizado com sucesso", async () => {
    mockQuery.mockImplementation((_q, _v, cb) =>
      cb(null, { affectedRows: 1 })
    );

    const res = await request
      .put("/api/v1/evento")
      .send(eventoValido);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty(
      "message",
      "Evento atualizado com sucesso"
    );
  });
});

// ─── DELETE /api/v1/evento/:id ────────────────────────────────────────────────

describe("DELETE /api/v1/evento/:id - deleteEvento", () => {
  beforeEach(() => mockQuery.mockReset());

  it("CT07 - 404 quando evento não é encontrado", async () => {
    mockQuery.mockImplementation((_q, _v, cb) =>
      cb(null, { affectedRows: 0 })
    );

    const res = await request.delete("/api/v1/evento/999");

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error", "Evento não encontrado");
  });

  it("CT08 - 200 quando evento é excluído com sucesso", async () => {
    mockQuery.mockImplementation((_q, _v, cb) =>
      cb(null, { affectedRows: 1 })
    );

    const res = await request.delete("/api/v1/evento/1");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message", "Evento excluído com sucesso");
  });
});

// ─── GET /api/v1/evento/imagem/:id ───────────────────────────────────────────

describe("GET /api/v1/evento/imagem/:id - getImagemEvento", () => {
  beforeEach(() => mockQuery.mockReset());

  it("CT09 - 404 quando imagem não é encontrada ou evento não tem imagem", async () => {
    mockQuery.mockImplementation((_q, _v, cb) => cb(null, []));

    const res = await request.get("/api/v1/evento/imagem/999");

    expect(res.status).toBe(404);
    expect(res.text).toBe("Imagem não encontrada");
  });

  it("CT10 - 200 retorna o binário da imagem com Content-Type correto", async () => {
    const fakeBuffer = Buffer.from("image-content");
    mockQuery.mockImplementation((_q, _v, cb) =>
      cb(null, [{ imagem: fakeBuffer, imagem_tipo: "image/png" }])
    );

    const res = await request.get("/api/v1/evento/imagem/1");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("image/png");
    expect(res.body).toEqual(fakeBuffer);
  });
});

// ─── GET /api/v1/evento/sete/:data ───────────────────────────────────────────

describe("GET /api/v1/evento/sete/:data - getEventosDias", () => {
  beforeEach(() => mockQuery.mockReset());

  it("CT11 - 401 quando chamado sem token JWT", async () => {
    const res = await request.get("/api/v1/evento/sete/2026-10-22");

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("auth", false);
  });

  it("CT12 - 500 quando ocorre erro no banco ou busca", async () => {
    mockQuery.mockImplementation((_q, _v, cb) =>
      cb(new Error("DB Error"), null)
    );

    const res = await request
      .get("/api/v1/evento/sete/2026-10-22")
      .set("authorization", generateToken(1));

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("error", "Erro ao buscar eventos");
  });
});
