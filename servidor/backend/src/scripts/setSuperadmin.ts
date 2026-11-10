import { Pool } from "pg";
import { env } from "../config/env";

async function main() {
  const emailArg = process.argv[2];
  const nifArg = process.argv[3];

  if (!emailArg) {
    console.error("Uso: npm run make-superadmin <email> [nif]");
    process.exit(1);
  }

  if (!env.DATABASE_URL) {
    console.error("Erro: DATABASE_URL não está configurada no ambiente.");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: env.DATABASE_URL,
  });

  try {
    const checkRes = await pool.query(
      "SELECT id, email, is_admin, is_superadmin, user_type, nif FROM auth.users WHERE lower(email) = lower($1) LIMIT 1",
      [emailArg.trim()]
    );

    if (!checkRes.rowCount || checkRes.rowCount === 0) {
      console.warn(
        `Atenção: Nenhum usuário encontrado com o e-mail "${emailArg}". O usuário precisa se cadastrar na plataforma antes de receber permissões.`
      );
      process.exit(1);
    }

    const updateQuery = nifArg
      ? `UPDATE auth.users 
         SET is_admin = true, is_superadmin = true, user_type = 'funcionario', nif = $2, is_blocked = false, updated_at = now() 
         WHERE lower(email) = lower($1) 
         RETURNING id, email, is_admin, is_superadmin, user_type, nif`
      : `UPDATE auth.users 
         SET is_admin = true, is_superadmin = true, user_type = 'funcionario', is_blocked = false, updated_at = now() 
         WHERE lower(email) = lower($1) 
         RETURNING id, email, is_admin, is_superadmin, user_type, nif`;

    const params = nifArg ? [emailArg.trim(), nifArg.trim()] : [emailArg.trim()];
    const result = await pool.query(updateQuery, params);

    const updatedUser = result.rows[0];
    console.log("Sucesso! Usuário promovido a superadministrador no banco de dados:");
    console.log({
      id: updatedUser.id,
      email: updatedUser.email,
      is_admin: updatedUser.is_admin,
      is_superadmin: updatedUser.is_superadmin,
      user_type: updatedUser.user_type,
      nif: updatedUser.nif,
    });
  } catch (err) {
    console.error("Erro ao atualizar superadministrador no banco de dados:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Erro inesperado:", err);
  process.exit(1);
});
