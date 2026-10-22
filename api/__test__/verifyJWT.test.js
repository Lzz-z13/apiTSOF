import { jest } from "@jest/globals";
import jwt from "jsonwebtoken";
import verifyJWT from "../src/services/verifyJWT.js";

/**
 * Testes unitários do middleware verifyJWT.
 *
 * Não requer mock de banco — testa apenas a lógica do JWT.
 * Usa mocks de req/res/next para simular o ciclo de middleware Express.
 * O SECRET vem do setup.js (process.env.SECRET = "test-secret-key").
 */

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("verifyJWT - Middleware Unitário", () => {
  // ─── Token ausente ────────────────────────────────────────────
  it("CT01 - Retorna 401 quando o token não é fornecido", () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    verifyJWT(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      auth: false,
      message: "Token não foi fornecido",
    });
    expect(next).not.toHaveBeenCalled();
  });

  // ─── Token inválido ───────────────────────────────────────────
  it("CT02 - Retorna 403 quando o token é inválido/malformado", () => {
    const req = { headers: { authorization: "token-invalido-qualquer" } };
    const res = mockRes();
    const next = jest.fn();

    verifyJWT(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      auth: false,
      message: "Falha na autenticação do Token",
    });
    expect(next).not.toHaveBeenCalled();
  });

  // ─── Token expirado ───────────────────────────────────────────
  it("CT03 - Retorna 403 quando o token está expirado", () => {
    const expiredToken = jwt.sign(
      { id: 1 },
      process.env.SECRET,
      { expiresIn: "0s" }
    );

    const req = { headers: { authorization: expiredToken } };
    const res = mockRes();
    const next = jest.fn();

    verifyJWT(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  // ─── Token válido ─────────────────────────────────────────────
  it("CT04 - Chama next() com token válido e injeta userId no req", () => {
    const token = jwt.sign({ id: 42 }, process.env.SECRET, {
      expiresIn: "1h",
    });
    const req = { headers: { authorization: token } };
    const res = mockRes();
    const next = jest.fn();

    verifyJWT(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.userId).toBe(42);
    expect(res.status).not.toHaveBeenCalled();
  });
});
