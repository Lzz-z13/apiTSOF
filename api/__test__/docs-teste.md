# 🧪 Plano de Implementação de Testes — API TSOF

## Contexto

API REST Express com ES Modules (`"type": "module"` no `package.json`). Usa **Jest 30** + **Supertest 7**. O banco é MySQL (Docker). A API já possui dois testes incompletos/incorretos na pasta `__test__`.

---

## Problemas Identificados nos Testes Atuais

### `validateUser.test.js` — 4 bugs críticos

| Linha | Bug | Tipo |
|-------|-----|------|
| 13 | `expect(validateUser(usuarioValido).toBeNull())` → parêntese errado, deveria ser `expect(validateUser(usuarioValido)).toBeNull()` | Sintaxe |
| 19 | `.toEquall()` → typo, deveria ser `.toEqual()` | Typo |
| 25 | `.toEquall()` → typo, deveria ser `.toEqual()` | Typo |
| 31 | `.toEquall()` → typo, deveria ser `.toEqual()` | Typo |
| 32 | Mensagem de erro do teste diz `"Email inválio"` mas o serviço retorna `"Email inválido. Deve conter @"` | Mensagem incorreta |

### `userController.test.js` — Stub vazio

Apenas importa a classe mas não tem nenhum teste. Precisa ser totalmente implementado.

---

## Estratégia de Testes

```
Unitários (sem banco, sem HTTP)
├── validateUser.test.js     ← CORRIGIR + COMPLETAR
├── validateCpf.test.js      ← NOVO (mock do DB)
└── verifyJWT.test.js        ← NOVO (mock do JWT)

Integração (com Supertest, mock do banco)
├── userController.test.js   ← IMPLEMENTAR (mock connect)
├── organizadorController.test.js ← NOVO
├── eventoController.test.js      ← NOVO
└── ingressoController.test.js    ← NOVO
```

### Por que mock do banco em vez do Docker?

Os testes unitários/integração de controllers **não devem depender de banco real**. Usaremos `jest.mock()` para mockar `../src/db/connect.js`, simulando `connect.query()`. Isso garante:
- Testes rápidos e determinísticos
- Sem dependência de Docker rodando
- Isolamento real das unidades

> A API em si continua rodando via Docker para uso em produção/desenvolvimento — apenas os **testes Jest** usam mock.

---

## Configuração do Jest para ES Modules

### Problema atual

O `jest.config.js` atual é mínimo e não declara `extensionsToTreatAsEsm`, `testMatch`, nem `moduleFileExtensions`.

### Ajuste no `jest.config.js`

```diff
- export default{
-     testEnvironment: "node",
-     transform: {},
- }
+ export default {
+   testEnvironment: "node",
+   transform: {},
+   extensionsToTreatAsEsm: [],
+   testMatch: ["**/__test__/**/*.test.js"],
+   moduleFileExtensions: ["js", "json"],
+   setupFiles: ["./src/__test__/setup.js"],
+ };
```

> **Atenção**: como `"type": "module"` já está no `package.json`, o Jest usa `--experimental-vm-modules` (já configurado no script `test`). O `transform: {}` desativa o Babel — correto para ESM nativo.

### Arquivo `__test__/setup.js` (NOVO)

Carrega variáveis de ambiente de teste antes dos testes rodarem:

```js
// __test__/setup.js
process.env.SECRET = 'test-secret-key';
process.env.DB_HOST = 'localhost';
process.env.DB_USER = 'root';
process.env.DB_PASSWORD = 'test';
process.env.DB_NAME = 'test_db';
process.env.DB_PORT = '3306';
```

> Necessário porque `index.js` usa `dotenv-safe` que exige o arquivo `.env.example`. Nos testes, setamos as vars manualmente via `setupFiles`.

---

## Arquivos Propostos

---

### Testes Unitários

#### [MODIFY] `__test__/validateUser.test.js`

Corrige os 4 bugs + adiciona casos adicionais:

```js
import validateUser from "../src/services/validateUser.js";

describe("validateUser - Testes Unitários", () => {
  const usuarioValido = {
    cpf: "12345678901",
    email: "aluno@senai.br",
    password: "123",
    name: "Aluno",
    data_nascimento: "2005-05-10",
  };

  // Happy path
  it("CT01 - Retorna null quando todos os dados são válidos", () => {
    expect(validateUser(usuarioValido)).toBeNull(); // FIX: parêntese
  });

  // Campos obrigatórios
  it("CT02 - Retorna erro quando falta data_nascimento", () => {
    const { data_nascimento, ...semData } = usuarioValido;
    expect(validateUser(semData)).toEqual({          // FIX: toEqual
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

  // CPF
  it("CT03 - Retorna erro quando o CPF tem menos de 11 dígitos", () => {
    expect(validateUser({ ...usuarioValido, cpf: "123" })).toEqual({ // FIX: toEqual
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

  // Email
  it("CT04 - Retorna erro quando o email não tem @", () => {   // FIX: typos + mensagem
    expect(validateUser({ ...usuarioValido, email: "aluno.senai.br" })).toEqual({
      error: "Email inválido. Deve conter @",               // FIX: mensagem correta
    });
  });
});
```

---

#### [NEW] `__test__/validateCpf.test.js`

Mock do `connect` para testar os 3 cenários de CPF:

```js
import { jest } from "@jest/globals";

// Mock ANTES do import do módulo que usa connect
jest.mock("../src/db/connect.js", () => ({
  default: { query: jest.fn() },
}));

import validateCpf from "../src/services/validateCpf.js";
import connect from "../src/db/connect.js";

describe("validateCpf - Testes Unitários", () => {
  beforeEach(() => jest.clearAllMocks());

  it("CT01 - Retorna null quando CPF não está cadastrado", async () => {
    connect.query.mockImplementation((q, v, cb) => cb(null, []));
    const result = await validateCpf("12345678901");
    expect(result).toBeNull();
  });

  it("CT02 - Retorna erro quando CPF já cadastrado (sem userId)", async () => {
    connect.query.mockImplementation((q, v, cb) =>
      cb(null, [{ id_usuario: 1 }])
    );
    const result = await validateCpf("12345678901");
    expect(result).toEqual({ error: "CPF já cadastrado" });
  });

  it("CT03 - Retorna null quando CPF pertence ao mesmo usuário (update)", async () => {
    connect.query.mockImplementation((q, v, cb) =>
      cb(null, [{ id_usuario: 5 }])
    );
    const result = await validateCpf("12345678901", 5);
    expect(result).toBeNull();
  });

  it("CT04 - Retorna erro quando CPF pertence a outro usuário (update)", async () => {
    connect.query.mockImplementation((q, v, cb) =>
      cb(null, [{ id_usuario: 9 }])
    );
    const result = await validateCpf("12345678901", 5);
    expect(result).toEqual({ error: "CPF já cadastrado para outro usuário" });
  });

  it("CT05 - Rejeita a promise quando há erro no banco", async () => {
    connect.query.mockImplementation((q, v, cb) =>
      cb(new Error("DB Error"), null)
    );
    await expect(validateCpf("12345678901")).rejects.toEqual(
      "Erro ao verificar CPF"
    );
  });
});
```

---

#### [NEW] `__test__/verifyJWT.test.js`

Testa o middleware sem chamada HTTP (req/res mock):

```js
import { jest } from "@jest/globals";
import verifyJWT from "../src/services/verifyJWT.js";

describe("verifyJWT - Middleware Unitário", () => {
  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  it("CT01 - Retorna 401 quando token não é fornecido", () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();
    verifyJWT(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("CT02 - Retorna 403 quando token é inválido", () => {
    const req = { headers: { authorization: "token-invalido" } };
    const res = mockRes();
    const next = jest.fn();
    verifyJWT(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("CT03 - Chama next() com token válido e injeta userId", () => {
    // Gera token real com a SECRET de teste
    import jwt from "jsonwebtoken";
    const token = jwt.sign({ id: 42 }, process.env.SECRET, { expiresIn: "1h" });
    const req = { headers: { authorization: token } };
    const res = mockRes();
    const next = jest.fn();
    verifyJWT(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.userId).toBe(42);
  });
});
```

> **Nota**: o import do jwt dentro do test será feito no topo do arquivo (sintaxe ESM correta).

---

### Testes de Integração (Supertest + Mock do banco)

#### [MODIFY] `__test__/userController.test.js`

```js
// Mock do connect e bcrypt ANTES dos imports da app
jest.mock("../src/db/connect.js", ...) 
jest.mock("bcrypt", ...)

import request from "supertest";
import app from "../src/index.js";

describe("POST /api/v1/user - createUser", () => {
  // Validação: campos obrigatórios
  it("CT01 - 400 quando faltam campos obrigatórios");
  it("CT02 - 400 CPF inválido");
  it("CT03 - 400 Email sem @");
  it("CT04 - 400 CPF já cadastrado (mock validateCpf)");
  it("CT05 - 201 Usuário criado com sucesso");
  it("CT06 - 400 Email duplicado (ER_DUP_ENTRY)");
});

describe("GET /api/v1/user - getAllUsers (requer JWT)", () => {
  it("CT07 - 401 sem token");
  it("CT08 - 200 com token válido");
});

describe("POST /api/v1/login - loginUser", () => {
  it("CT09 - 400 sem email/senha");
  it("CT10 - 401 usuário não encontrado");
  it("CT11 - 401 senha incorreta");
  it("CT12 - 200 login bem-sucedido, retorna token");
});

describe("PUT /api/v1/user - updateUser", () => {
  it("CT13 - 400 validação");
  it("CT14 - 404 usuário não encontrado");
  it("CT15 - 200 atualizado com sucesso");
});

describe("DELETE /api/v1/user/:id - deleteUser", () => {
  it("CT16 - 404 não encontrado");
  it("CT17 - 200 excluído com sucesso");
});
```

---

#### [NEW] `__test__/organizadorController.test.js`

```
describe("POST /api/v1/organizador")
  CT01 - 400 campos faltando
  CT02 - 400 email sem @
  CT03 - 400 telefone inválido (< 11 dígitos)
  CT04 - 201 criado com sucesso
  CT05 - 400 email duplicado

describe("GET /api/v1/organizador")
  CT06 - 200 lista de organizadores

describe("PUT /api/v1/organizador")
  CT07 - 400 validação
  CT08 - 404 não encontrado
  CT09 - 200 atualizado

describe("DELETE /api/v1/organizador/:id")
  CT10 - 404 não encontrado
  CT11 - 200 excluído
```

---

#### [NEW] `__test__/eventoController.test.js`

```
describe("POST /api/v1/evento")
  CT01 - 400 campos faltando
  CT02 - 201 evento criado

describe("GET /api/v1/evento")
  CT03 - 200 lista eventos

describe("PUT /api/v1/evento")
  CT04 - 400 validação
  CT05 - 404 não encontrado
  CT06 - 200 atualizado

describe("DELETE /api/v1/evento/:id")
  CT07 - 404 não encontrado
  CT08 - 200 excluído
```

---

#### [NEW] `__test__/ingressoController.test.js`

```
describe("POST /api/v1/ingresso")
  CT01 - 400 campos faltando
  CT02 - 200 criado

describe("GET /api/v1/ingresso")
  CT03 - 200 lista

describe("GET /api/v1/ingresso/evento/:id")
  CT04 - 200 ingressos do evento

describe("PUT /api/v1/ingresso")
  CT05 - 400 validação
  CT06 - 404 não encontrado
  CT07 - 200 atualizado

describe("DELETE /api/v1/ingresso/:id")
  CT08 - 404 não encontrado
  CT09 - 200 excluído
```

---

## Ajustes de Configuração

### [MODIFY] `jest.config.js`

Adicionar `setupFiles` e `testMatch` explícito:

```diff
 export default {
   testEnvironment: "node",
   transform: {},
+  testMatch: ["**/__test__/**/*.test.js"],
+  moduleFileExtensions: ["js", "json"],
+  setupFiles: ["./__test__/setup.js"],
 };
```

### [NEW] `__test__/setup.js`

Define variáveis de ambiente para os testes (evita o erro do `dotenv-safe`):

```js
process.env.SECRET = 'test-secret-key';
process.env.DB_HOST = 'localhost';
process.env.DB_USER = 'root';
process.env.DB_PASSWORD = 'test';
process.env.DB_NAME = 'test_db';
process.env.DB_PORT = '3306';
```

---

## Problemas de ES Modules com Jest (e soluções)

| Problema | Causa | Solução |
|----------|-------|---------|
| `jest.mock()` não funciona com ESM | Jest ESM não faz hoisting automático | Usar `jest.unstable_mockModule()` antes do import dinâmico **ou** top-level mock com `--experimental-vm-modules` |
| Import de módulo antes do mock | ESM é estático | Usar `import()` dinâmico dentro de `beforeAll` após o mock |
| `import { jest }` não disponível | ESM não injeta globals | Importar `jest` de `@jest/globals` |

> **Decisão de implementação**: usaremos `jest.mock()` com `--experimental-vm-modules` (já configurado), que é suficiente para o Jest 30 com ESM. Onde necessário, `jest.unstable_mockModule()` + import dinâmico.

---

## Resumo de Arquivos

| Arquivo | Ação | Testes |
|---------|------|--------|
| `__test__/setup.js` | NEW | - |
| `__test__/validateUser.test.js` | MODIFY (corrigir bugs) | 8 |
| `__test__/validateCpf.test.js` | NEW | 5 |
| `__test__/verifyJWT.test.js` | NEW | 3 |
| `__test__/userController.test.js` | MODIFY (implementar) | 17 |
| `__test__/organizadorController.test.js` | NEW | 11 |
| `__test__/eventoController.test.js` | NEW | 8 |
| `__test__/ingressoController.test.js` | NEW | 9 |
| `jest.config.js` | MODIFY | - |
| **Total** | | **~61 testes** |

---

## Verificação
d
```bash
# Dentro do projeto api/
npm test

# Rodar só unitários
npm test -- --testPathPattern="validate|verifyJWT"

# Rodar só integração
npm test -- --testPathPattern="Controller"
```

---

## Revisão Necessária

> [!IMPORTANT]
> **Estratégia de Mock para Testes de Integração com ESM**: Com `"type": "module"`, o `jest.mock()` de ESM precisa de cuidado especial. Vou usar `jest.unstable_mockModule()` + imports dinâmicos (`await import()`) nos arquivos de controller, o que é o padrão correto do Jest 30 para ESM puro.

> [!WARNING]
> **`dotenv-safe` no `index.js`**: O módulo `index.js` importa `dotenv-safe/config.js` no topo. Isso causaria erro nos testes porque `.env` teria `DB_HOST=db` (Docker). O `setup.js` configura as vars de ambiente ANTES do import, mas o `dotenv-safe` pode sobrescrever. Avaliarei se é necessário mockar `dotenv-safe` também.

> [!NOTE]
> **`compraController`**: Não está registrado em nenhuma rota (`apiRoutes.js`), portanto não foi incluído nos testes de integração. Apenas citado como observação.