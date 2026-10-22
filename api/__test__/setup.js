/**
 * Setup de variáveis de ambiente para os testes.
 * Executado antes de cada arquivo de teste via jest.config.js → setupFiles.
 * Evita erros do dotenv-safe que exige todas as vars do .env.example presentes.
 */
process.env.SECRET = "test-secret-key";
process.env.DB_HOST = "localhost";
process.env.DB_USER = "root";
process.env.DB_PASSWORD = "test_password";
process.env.DB_NAME = "test_db";
process.env.DB_PORT = "3306";
