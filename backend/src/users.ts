import type { PoolClient } from 'pg';

// First the plans (cascades via weeks/sessions down to logged_sets and plan_block_exercises),
// then the user. Going directly via the users CASCADE fails because Postgres would otherwise delete
// the exercises before the logged_sets that reference them (without CASCADE). Must run inside a transaction.
export async function deleteUserWithData(client: PoolClient, userId: number) {
  await client.query('DELETE FROM plans WHERE user_id = $1', [userId]);
  await client.query('DELETE FROM users WHERE id = $1', [userId]);
}
