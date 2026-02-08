import { Injectable, Logger } from '@nestjs/common';

export type SecurityEventSeverity = 'info' | 'warning' | 'critical';

export interface SecurityEvent {
  event: string;
  severity: SecurityEventSeverity;
  userId?: string;
  ip?: string;
  userAgent?: string;
  details?: Record<string, any>;
}

@Injectable()
export class SecurityLogService {
  private readonly logger = new Logger('Security');

  // In-memory failed login tracker (IP -> { count, lastAttempt })
  private failedLogins = new Map<
    string,
    { count: number; lastAttempt: number; blockedUntil?: number }
  >();

  // Cleanup interval (every 30 minutes)
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.cleanupInterval = setInterval(
      () => this.cleanupOldEntries(),
      30 * 60 * 1000,
    );
  }

  log(event: SecurityEvent) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      ...event,
    };

    switch (event.severity) {
      case 'critical':
        this.logger.error(JSON.stringify(logEntry));
        break;
      case 'warning':
        this.logger.warn(JSON.stringify(logEntry));
        break;
      default:
        this.logger.log(JSON.stringify(logEntry));
    }
  }

  // ─── Failed Login Tracking ────────────────────────────────────────────────

  recordFailedLogin(ip: string, email: string) {
    const key = `${ip}:${email}`;
    const existing = this.failedLogins.get(key) || {
      count: 0,
      lastAttempt: 0,
    };

    existing.count++;
    existing.lastAttempt = Date.now();

    // Block after 5 failed attempts for 15 minutes
    if (existing.count >= 5) {
      existing.blockedUntil = Date.now() + 15 * 60 * 1000;
      this.log({
        event: 'auth.login.blocked',
        severity: 'critical',
        ip,
        details: {
          email,
          attempts: existing.count,
          blockedMinutes: 15,
        },
      });
    }

    this.failedLogins.set(key, existing);

    this.log({
      event: 'auth.login.failed',
      severity: existing.count >= 3 ? 'warning' : 'info',
      ip,
      details: { email, attempts: existing.count },
    });

    // Also track IP-only (all emails from same IP)
    const ipKey = `ip:${ip}`;
    const ipEntry = this.failedLogins.get(ipKey) || {
      count: 0,
      lastAttempt: 0,
    };
    ipEntry.count++;
    ipEntry.lastAttempt = Date.now();

    // Block IP after 10 failed attempts across all accounts
    if (ipEntry.count >= 10) {
      ipEntry.blockedUntil = Date.now() + 30 * 60 * 1000;
      this.log({
        event: 'auth.ip.blocked',
        severity: 'critical',
        ip,
        details: {
          totalAttempts: ipEntry.count,
          blockedMinutes: 30,
        },
      });
    }

    this.failedLogins.set(ipKey, ipEntry);
  }

  isBlocked(ip: string, email?: string): boolean {
    // Check IP-level block
    const ipEntry = this.failedLogins.get(`ip:${ip}`);
    if (ipEntry?.blockedUntil && ipEntry.blockedUntil > Date.now()) {
      return true;
    }

    // Check IP+email block
    if (email) {
      const entry = this.failedLogins.get(`${ip}:${email}`);
      if (entry?.blockedUntil && entry.blockedUntil > Date.now()) {
        return true;
      }
    }

    return false;
  }

  clearFailedLogins(ip: string, email: string) {
    this.failedLogins.delete(`${ip}:${email}`);
  }

  recordSuccessfulLogin(
    ip: string,
    email: string,
    userId: string,
    userType: string,
  ) {
    this.clearFailedLogins(ip, email);
    this.log({
      event: 'auth.login.success',
      severity: 'info',
      userId,
      ip,
      details: { email, userType },
    });
  }

  // ─── Admin Events ─────────────────────────────────────────────────────────

  logAdminAction(
    adminId: string,
    action: string,
    ip?: string,
    details?: Record<string, any>,
  ) {
    this.log({
      event: `admin.action.${action}`,
      severity: 'info',
      userId: adminId,
      ip,
      details,
    });
  }

  logAdminLoginFailed(ip: string, email: string) {
    this.recordFailedLogin(ip, email);
    this.log({
      event: 'admin.login.failed',
      severity: 'warning',
      ip,
      details: { email },
    });
  }

  logAdminLoginSuccess(ip: string, adminId: string, email: string) {
    this.clearFailedLogins(ip, email);
    this.log({
      event: 'admin.login.success',
      severity: 'info',
      userId: adminId,
      ip,
      details: { email },
    });
  }

  // ─── Rate Limit Events ────────────────────────────────────────────────────

  logRateLimitExceeded(ip: string, endpoint: string) {
    this.log({
      event: 'api.rate_limit.exceeded',
      severity: 'warning',
      ip,
      details: { endpoint },
    });
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  private cleanupOldEntries() {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour

    for (const [key, entry] of this.failedLogins.entries()) {
      if (now - entry.lastAttempt > maxAge) {
        this.failedLogins.delete(key);
      }
    }
  }
}
