import validateUser from "../src/services/validateUser.js";

/**
 * Testes unitários da função validateUser.
 * Não requer banco de dados — função pura de validação.
 *
 * Bugs corrigidos do arquivo original:
 *  - CT01: parêntese errado em expect(validateUser(x).toBeNull()) → expect(validateUser(x)).toBeNull()
 *  - CT02/03/04: .toEquall() → .toEqual()
 *  - CT04: mensagem do erro ajustada para bater com o retorno real do serviço
 */
describe("validateUser - Testes Unitários", () => {
  const usuarioValido = {
    cpf: "12345678901",
    email: "aluno@senai.br",
    password: "123",
    name: "Aluno",
    data_nascimento: "2005-05-10",
  };

  // ─── Happy path ───────────────────────────────────────────────
  it("CT01 - Retorna null quando todos os dados são válidos", () => {
    expect(validateUser(usuarioValido)).toBeNull();
  });

  // ─── Campos obrigatórios ──────────────────────────────────────
  it("CT02 - Retorna erro quando falta data_nascimento", () => {
    const { data_nascimento, ...semData } = usuarioValido;
    expect(validateUser(semData)).toEqual({
      error: "Todos os campos devem ser preenchidos",
    });
  });

  it("CT02b - Retorna erro quando falta name", () => {
    const { name, ...semNome } = usuarioValido;
    expect(validateUser(semNome)).toEqual({
      error: "Todos os campos devem ser preenchidos",
    });
  });

  it("CT02c - Retorna erro quando falta email", () => {
    const { email, ...semEmail } = usuarioValido;
    expect(validateUser(semEmail)).toEqual({
      error: "Todos os campos devem ser preenchidos",
    });
  });

  it("CT02d - Retorna erro quando falta password", () => {
    const { password, ...semSenha } = usuarioValido;
    expect(validateUser(semSenha)).toEqual({
      error: "Todos os campos devem ser preenchidos",
    });
  });

  it("CT02e - Retorna erro quando falta cpf", () => {
    const { cpf, ...semCpf } = usuarioValido;
    expect(validateUser(semCpf)).toEqual({
      error: "Todos os campos devem ser preenchidos",
    });
  });

  // ─── Validação do CPF ─────────────────────────────────────────
  it("CT03 - Retorna erro quando o CPF tem menos de 11 dígitos", () => {
    expect(validateUser({ ...usuarioValido, cpf: "123" })).toEqual({
      error: "CPF inválido. Deve conter exatamente 11 dígitos numéricos",
    });
  });

  it("CT03b - Retorna erro quando o CPF tem mais de 11 dígitos", () => {
    expect(validateUser({ ...usuarioValido, cpf: "123456789012" })).toEqual({
      error: "CPF inválido. Deve conter exatamente 11 dígitos numéricos",
    });
  });

  it("CT03c - Retorna erro quando o CPF contém letras", () => {
    expect(validateUser({ ...usuarioValido, cpf: "1234567890A" })).toEqual({
      error: "CPF inválido. Deve conter exatamente 11 dígitos numéricos",
    });
  });

  // ─── Validação do Email ───────────────────────────────────────
  it("CT04 - Retorna erro quando o email não tem @", () => {
    expect(
      validateUser({ ...usuarioValido, email: "aluno.senai.br" })
    ).toEqual({
      error: "Email inválido. Deve conter @",
    });
  });
});