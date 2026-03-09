/**
 * Middleware de protecao para interacoes.
 * - Cooldown por usuario/acao
 * - Lock de execucao por usuario/acao (liberado em finally)
 */

class ExecutionGuard {
  constructor() {
    this.cooldowns = new Map();
    this.locks = new Set();
  }

  _now() {
    return Date.now();
  }

  _cleanup() {
    if (this.cooldowns.size > 10000) {
      const now = this._now();
      for (const [key, until] of this.cooldowns.entries()) {
        if (until <= now) this.cooldowns.delete(key);
      }
    }
  }

  _cooldownKey(scope, userId, action) {
    return `${scope}:${userId}:${action}`;
  }

  _lockKey(scope, userId, action) {
    return `${scope}:${userId}:${action}`;
  }

  getRemainingMs(scope, userId, action) {
    const key = this._cooldownKey(scope, userId, action);
    const until = this.cooldowns.get(key) || 0;
    const left = until - this._now();
    return left > 0 ? left : 0;
  }

  setCooldown(scope, userId, action, ms) {
    if (!ms || ms <= 0) return;
    const key = this._cooldownKey(scope, userId, action);
    this.cooldowns.set(key, this._now() + ms);
    this._cleanup();
  }

  isLocked(scope, userId, action) {
    return this.locks.has(this._lockKey(scope, userId, action));
  }

  acquire(scope, userId, action) {
    const lockKey = this._lockKey(scope, userId, action);
    if (this.locks.has(lockKey)) return false;
    this.locks.add(lockKey);
    return true;
  }

  release(scope, userId, action) {
    this.locks.delete(this._lockKey(scope, userId, action));
  }
}

module.exports = ExecutionGuard;
