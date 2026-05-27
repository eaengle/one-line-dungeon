import { PlayerStats, EnemyDefinition, CombatPrediction } from './types';

export function predictCombat(player: PlayerStats, enemy: EnemyDefinition): CombatPrediction {
  const playerDamagePerRound = Math.max(1, player.attack - enemy.defense);
  const enemyDamagePerRound = Math.max(1, enemy.attack - player.defense);
  const roundsToKillEnemy = Math.ceil(enemy.hp / playerDamagePerRound);
  const roundsUntilPlayerDeath = Math.ceil(player.hp / enemyDamagePerRound);
  const playerWins = roundsToKillEnemy <= roundsUntilPlayerDeath;
  // Player kills enemy on round N; enemy attacked rounds 1..N-1 before dying
  const hpCost = playerWins
    ? (roundsToKillEnemy - 1) * enemyDamagePerRound
    : player.hp;

  return {
    playerDamagePerRound,
    enemyDamagePerRound,
    roundsToKillEnemy,
    roundsUntilPlayerDeath,
    playerWins,
    hpCost,
  };
}

export function resolveCombat(
  player: PlayerStats,
  enemy: EnemyDefinition,
  currentEnemyHp: number
): { playerWins: boolean; hpCost: number; goldGained: number; loot: typeof enemy.loot } {
  const playerDamagePerRound = Math.max(1, player.attack - enemy.defense);
  const enemyDamagePerRound = Math.max(1, enemy.attack - player.defense);
  const roundsToKillEnemy = Math.ceil(currentEnemyHp / playerDamagePerRound);
  const roundsUntilPlayerDeath = Math.ceil(player.hp / enemyDamagePerRound);
  const playerWins = roundsToKillEnemy <= roundsUntilPlayerDeath;
  const hpCost = playerWins
    ? (roundsToKillEnemy - 1) * enemyDamagePerRound
    : player.hp;

  return {
    playerWins,
    hpCost,
    goldGained: playerWins ? enemy.goldReward : 0,
    loot: playerWins ? enemy.loot : undefined,
  };
}
