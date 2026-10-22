import { jest } from "@jest/globals";

/**
 * Testes unitários do serviço validateCpf.
 *
 * Estratégia ESM: jest.unstable_mockModule() registra o mock ANTES do
 * import dinâmico do módulo que depende de connect.js.
 * O mockQuery é criado fora da factory para que os testes possam
 * controlá-lo via mockImplementation / mockImplementationOnce.
 */
const mockQuery = jest.fn();

jest.unstable_mockModule("../src/db/connect.js", () => ({
  default: { query: mockQuery },
}));

// Imports dinâmicos APÓS o mock estar registrado
const { default: validateCpf } = await import(
  "../src/services/validateCpf.js"
);

describe("validateCpf - Testes Unitários", () => {
  beforeEach(() => mockQuery.mockReset());

  // ─── CPF não cadastrado ───────────────────────────────────────
  it("CT01 - Retorna null quando CPF não está cadastrado", async () => {
    mockQuery.mockImplementation((_q, _v, cb) => cb(null, []));

    const result = await validateCpf("12345678901");

    expect(result).toBeNull();
  });

  // ─── CPF já cadastrado (sem userId = criação) ─────────────────
  it("CT02 - Retorna erro quando CPF já cadastrado (sem userId)", async () => {
    mockQuery.mockImplementation((_q, _v, cb) =>
      cb(null, [{ id_usuario: 1 }])
    );

    const result = await validateCpf("12345678901");

    expect(result).toEqual({ error: "CPF já cadastrado" });
  });

  // ─── CPF pertence ao mesmo usuário (update próprio) ───────────
  it("CT03 - Retorna null quando CPF pertence ao mesmo usuário (update)", async () => {
    mockQuery.mockImplementation((_q, _v, cb) =>
      cb(null, [{ id_usuario: 5 }])
    );

    const result = await validateCpf("12345678901", 5);

    expect(result).toBeNull();
  });

  // ─── CPF pertence a outro usuário (update alheio) ─────────────
  it("CT04 - Retorna erro quando CPF pertence a outro usuário (update)", async () => {
    mockQuery.mockImplementation((_q, _v, cb) =>
      cb(null, [{ id_usuario: 9 }])
    );

    const result = await validateCpf("12345678901", 5);

    expect(result).toEqual({ error: "CPF já cadastrado para outro usuário" });
  });

  // ─── Erro de banco ────────────────────────────────────────────
  it("CT05 - Rejeita a promise quando há erro no banco", async () => {
    mockQuery.mockImplementation((_q, _v, cb) =>
      cb(new Error("DB Error"), null)
    );

    await expect(validateCpf("12345678901")).rejects.toEqual(
      "Erro ao verificar CPF"
    );
  });
});
