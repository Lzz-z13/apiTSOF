import { jest } from "@jest/globals";
import jwt from "jsonwebtoken";

/**
 * Testes de integração do userController via Supertest.
 *
 * Estratégia de mock (ESM):
 *  - dotenv-safe/config.js → mock vazio para não sobrescrever vars do setup.js
 *  - connect.js → mock com mockQuery controlável por teste
 *  - bcrypt → mock com hash e compareSync controláveis
 *  - testConnect.js → mock vazio (evita chamada ao banco na inicialização do app)
 *
 * O app (index.js) é importado dinamicamente APÓS todos os mocks estarem registrados.
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

const mockHash = jest.fn().mockResolvedValue("hashed_password_123");
const mockCompareSync = jest.fn();
jest.unstable_mockModule("bcrypt", () => ({
  default: { hash: mockHash, compareSync: mockCompareSync },
}));

// ─── Imports dinâmicos (APÓS mocks) ──────────────────────────────────────────

const { default: supertest } = await import("supertest");
const { default: app } = await import("../src/index.js");
const request = supertest(app);

// ─── Helper ───────────────────────────────────────────────────────────────────

const generateToken = (id = 1) =>
  jwt.sign({ id }, process.env.SECRET, { expiresIn: "1h" });

// ─── POST /api/v1/user ────────────────────────────────────────────────────────

describe("POST /api/v1/user - createUser", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockHash.mockResolvedValue("hashed_password_123");
  });

  it("CT01 - 400 quando faltam campos obrigatórios", async () => {
    const res = await request
      .post("/api/v1/user")
      .send({ email: "teste@teste.com" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Todos os campos devem ser preenchidos");
  });

  it("CT02 - 400 quando CPF é inválido (menos de 11 dígitos)", async () => {
    const res = await request.post("/api/v1/user").send({
      cpf: "123",
      email: "teste@teste.com",
      password: "senha123",
      name: "Teste",
      data_nascimento: "2000-01-01",
    });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty(
      "error",
      "CPF inválido. Deve conter exatamente 11 dígitos numéricos"
    );
  });

  it("CT03 - 400 quando email não contém @", async () => {
    const res = await request.post("/api/v1/user").send({
      cpf: "12345678901",
      email: "email-sem-arroba.com",
      password: "senha123",
      name: "Teste",
      data_nascimento: "2000-01-01",
    });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Email inválido. Deve conter @");
  });

  it("CT04 - 400 quando CPF já está cadastrado", async () => {
    // validateCpf → encontra CPF existente
    mockQuery.mockImplementationOnce((_q, _v, cb) =>
      cb(null, [{ id_usuario: 99 }])
    );

    const res = await request.post("/api/v1/user").send({
      cpf: "12345678901",
      email: "novo@teste.com",
      password: "senha123",
      name: "Teste",
      data_nascimento: "2000-01-01",
    });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "CPF já cadastrado");
  });

  it("CT05 - 201 quando usuário é criado com sucesso", async () => {
    // validateCpf → CPF livre
    mockQuery.mockImplementationOnce((_q, _v, cb) => cb(null, []));
    // INSERT usuario → sucesso
    mockQuery.mockImplementationOnce((_q, _v, cb) => cb(null, { insertId: 1 }));

    const res = await request.post("/api/v1/user").send({
      cpf: "12345678901",
      email: "novo@teste.com",
      password: "senha123",
      name: "Teste",
      data_nascimento: "2000-01-01",
    });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("message", "Usuário criado com sucesso");
  });

  it("CT06 - 400 quando email já está cadastrado (ER_DUP_ENTRY)", async () => {
    // validateCpf → CPF livre
    mockQuery.mockImplementationOnce((_q, _v, cb) => cb(null, []));
    // INSERT → erro de email duplicado
    const dupError = Object.assign(new Error("Duplicate entry for email"), {
      code: "ER_DUP_ENTRY",
      message: "Duplicate entry for email",
    });
    mockQuery.mockImplementationOnce((_q, _v, cb) => cb(dupError, null));

    const res = await request.post("/api/v1/user").send({
      cpf: "12345678901",
      email: "existente@teste.com",
      password: "senha123",
      name: "Teste",
      data_nascimento: "2000-01-01",
    });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Email já cadastrado");
  });
});

// ─── GET /api/v1/user ─────────────────────────────────────────────────────────

describe("GET /api/v1/user - getAllUsers (requer JWT)", () => {
  beforeEach(() => mockQuery.mockReset());

  it("CT07 - 401 quando o token não é fornecido", async () => {
    const res = await request.get("/api/v1/user");

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("auth", false);
  });

  it("CT08 - 200 com token válido retorna lista de usuários", async () => {
    const fakeUsers = [
      { id_usuario: 1, name: "Ana", email: "ana@test.com" },
      { id_usuario: 2, name: "Bruno", email: "bruno@test.com" },
    ];
    mockQuery.mockImplementation((_q, cb) => cb(null, fakeUsers));

    const res = await request
      .get("/api/v1/user")
      .set("authorization", generateToken(1));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("users");
    expect(res.body.users).toHaveLength(2);
  });

  it("CT08b - 500 quando ocorre erro no banco", async () => {
    mockQuery.mockImplementation((_q, cb) =>
      cb(new Error("DB Error"), null)
    );

    const res = await request
      .get("/api/v1/user")
      .set("authorization", generateToken(1));

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("error", "Erro interno do servidor");
  });
});

// ─── POST /api/v1/login ───────────────────────────────────────────────────────

describe("POST /api/v1/login - loginUser", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockCompareSync.mockReset();
  });

  it("CT09 - 400 quando email ou senha não são fornecidos", async () => {
    const res = await request
      .post("/api/v1/login")
      .send({ email: "teste@teste.com" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty(
      "error",
      "Email e senha são obrigatórios"
    );
  });

  it("CT10 - 401 quando usuário não é encontrado", async () => {
    mockQuery.mockImplementation((_q, _v, cb) => cb(null, []));

    const res = await request
      .post("/api/v1/login")
      .send({ email: "nao@existe.com", password: "123" });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error", "Usuário não encontrado");
  });

  it("CT11 - 401 quando senha está incorreta", async () => {
    const fakeUser = {
      id_usuario: 1,
      email: "teste@teste.com",
      password: "hashed_senha",
    };
    mockQuery.mockImplementation((_q, _v, cb) => cb(null, [fakeUser]));
    mockCompareSync.mockReturnValue(false);

    const res = await request
      .post("/api/v1/login")
      .send({ email: "teste@teste.com", password: "senha_errada" });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error", "Senha incorreta");
  });

  it("CT12 - 200 retorna token JWT em login bem-sucedido", async () => {
    const fakeUser = {
      id_usuario: 5,
      email: "teste@teste.com",
      password: "hashed_senha",
      name: "Usuário Teste",
    };
    mockQuery.mockImplementation((_q, _v, cb) => cb(null, [fakeUser]));
    mockCompareSync.mockReturnValue(true);

    const res = await request
      .post("/api/v1/login")
      .send({ email: "teste@teste.com", password: "senha_certa" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body).toHaveProperty("message", "Login bem-sucedido");
    expect(res.body.user).not.toHaveProperty("password");
  });
});

// ─── PUT /api/v1/user ─────────────────────────────────────────────────────────

describe("PUT /api/v1/user - updateUser", () => {
  beforeEach(() => mockQuery.mockReset());

  it("CT13 - 400 quando faltam campos obrigatórios", async () => {
    const res = await request
      .put("/api/v1/user")
      .send({ name: "Só o nome" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty(
      "error",
      "Todos os campos devem ser preenchidos"
    );
  });

  it("CT14 - 404 quando usuário não é encontrado", async () => {
    // validateCpf → sem conflito
    mockQuery.mockImplementationOnce((_q, _v, cb) => cb(null, []));
    // UPDATE → 0 linhas afetadas
    mockQuery.mockImplementationOnce((_q, _v, cb) =>
      cb(null, { affectedRows: 0 })
    );

    const res = await request.put("/api/v1/user").send({
      id: 999,
      cpf: "12345678901",
      email: "teste@teste.com",
      password: "senha123",
      name: "Teste",
      data_nascimento: "2000-01-01",
    });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error", "Usuário não encontrado");
  });

  it("CT13b - 400 quando CPF já está cadastrado para outro usuário", async () => {
    // validateCpf encontra outro usuário com esse CPF
    mockQuery.mockImplementationOnce((_q, _v, cb) =>
      cb(null, [{ id_usuario: 88 }])
    );

    const res = await request.put("/api/v1/user").send({
      id: 1,
      cpf: "12345678901",
      email: "novo@teste.com",
      password: "senha",
      name: "Teste",
      data_nascimento: "2000-01-01",
    });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty(
      "error",
      "CPF já cadastrado para outro usuário"
    );
  });

  it("CT13c - 400 quando email já está em uso na atualização (ER_DUP_ENTRY)", async () => {
    // validateCpf → sem conflito
    mockQuery.mockImplementationOnce((_q, _v, cb) => cb(null, []));
    // UPDATE → erro de email duplicado
    const dupError = Object.assign(new Error("Duplicate entry 'email' for key"), {
      code: "ER_DUP_ENTRY",
      message: "Duplicate entry for email",
    });
    mockQuery.mockImplementationOnce((_q, _v, cb) => cb(dupError, null));

    const res = await request.put("/api/v1/user").send({
      id: 1,
      cpf: "12345678901",
      email: "outro@teste.com",
      password: "senha",
      name: "Teste",
      data_nascimento: "2000-01-01",
    });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Email já cadastrado");
  });

  it("CT15 - 200 quando usuário é atualizado com sucesso", async () => {
    // validateCpf → sem conflito
    mockQuery.mockImplementationOnce((_q, _v, cb) => cb(null, []));
    // UPDATE → 1 linha afetada
    mockQuery.mockImplementationOnce((_q, _v, cb) =>
      cb(null, { affectedRows: 1 })
    );

    const res = await request.put("/api/v1/user").send({
      id: 1,
      cpf: "12345678901",
      email: "atualizado@teste.com",
      password: "nova_senha",
      name: "Nome Atualizado",
      data_nascimento: "2000-01-01",
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message", "Usuário atualizado com sucesso");
  });
});

// ─── DELETE /api/v1/user/:id ──────────────────────────────────────────────────

describe("DELETE /api/v1/user/:id - deleteUser", () => {
  beforeEach(() => mockQuery.mockReset());

  it("CT16 - 404 quando usuário não é encontrado", async () => {
    mockQuery.mockImplementation((_q, _v, cb) =>
      cb(null, { affectedRows: 0 })
    );

    const res = await request.delete("/api/v1/user/999");

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error", "Usuário não encontrado");
  });

  it("CT17 - 200 quando usuário é excluído com sucesso", async () => {
    mockQuery.mockImplementation((_q, _v, cb) =>
      cb(null, { affectedRows: 1 })
    );

    const res = await request.delete("/api/v1/user/1");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
    expect(res.body.message).toContain("1");
  });
});
