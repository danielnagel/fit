import type { PoolClient } from 'pg';

// Erst die Plaene (kaskadiert ueber Wochen/Sessions bis zu logged_sets und plan_block_exercises),
// dann den Benutzer. Direkt per users-CASCADE scheitert es, weil Postgres die Uebungen sonst vor
// den logged_sets loescht, die (ohne CASCADE) auf sie verweisen. Muss innerhalb einer Transaktion laufen.
export async function deleteUserWithData(client: PoolClient, userId: number) {
  await client.query('DELETE FROM plans WHERE user_id = $1', [userId]);
  await client.query('DELETE FROM users WHERE id = $1', [userId]);
}
