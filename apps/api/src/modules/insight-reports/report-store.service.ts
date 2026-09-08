import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Readable } from 'stream';
import { R2Service } from '../content/r2.service';
import {
  REPORT_MIME,
  ReportFormat,
  ReportStore,
  StoredReport,
} from './report-document.model';

/**
 * Durable storage for generated insight reports, backed by R2.
 *
 * Reports used to live in a process-local Map with a 24h TTL. On Render's free
 * tier the process spins down constantly, so a download link handed to a user
 * five minutes earlier would 404 for no visible reason. Objects in R2 outlive
 * the process, so a link stays good.
 *
 * R2 is treated as best-effort, never as a hard dependency: if it is
 * unconfigured (local dev) or momentarily failing, we keep serving from memory
 * rather than failing report generation. A report that survives only until the
 * next restart still beats a 500.
 */

/** Reports held in process. Small — documents are a few hundred KB at most. */
const DOC_CACHE_LIMIT = 64;
/** Rendered binaries are much larger (PDF/PPTX), so cap by bytes, not count. */
const RENDERED_CACHE_BYTES = 48 * 1024 * 1024;

interface CachedDoc {
  report: StoredReport;
  /** True once the object is known to exist in R2 and can be re-read from it. */
  durable: boolean;
}

interface CachedBlob {
  body: Buffer;
  durable: boolean;
}

@Injectable()
export class ReportStoreService implements ReportStore {
  private readonly logger = new Logger(ReportStoreService.name);

  /** Doubles as the read cache and as the fallback store when R2 is unusable. */
  private readonly docs = new Map<string, CachedDoc>();
  private readonly rendered = new Map<string, CachedBlob>();
  private renderedBytes = 0;

  /** Guards the degradation warning so an outage logs once, not once per call. */
  private degradedWarned = false;

  constructor(private readonly r2: R2Service) {}

  // R2 keys are derived from the report id alone, so a fresh process can find
  // an existing report without any index to consult.
  private docKey(id: string): string {
    return `insight-reports/${id}/report.json`;
  }

  private renderedKey(id: string, format: ReportFormat): string {
    return `insight-reports/${id}/report.${format}`;
  }

  async save(report: StoredReport): Promise<void> {
    // Cache first: a read immediately after save must succeed even if the
    // upload below fails.
    this.rememberDoc(report, false);

    if (!this.r2.isConfigured()) {
      this.warnDegraded('R2 is not configured');
      return;
    }

    try {
      await this.r2.putBuffer(
        this.docKey(report.id),
        Buffer.from(JSON.stringify(report), 'utf8'),
        'application/json; charset=utf-8',
      );
      this.markDocDurable(report.id);
      this.degradedWarned = false;
    } catch (err) {
      this.warnDegraded(`could not persist report ${report.id}`, err);
    }
  }

  async get(id: string): Promise<StoredReport | null> {
    const cached = this.docs.get(id);
    if (cached) {
      this.touch(this.docs, id);
      return cached.report;
    }

    // A cache miss is not an answer — after a restart the cache is empty but
    // the report still exists. Always fall through to R2.
    if (!this.r2.isConfigured()) return null;

    try {
      const raw = await this.readObject(this.docKey(id));
      if (!raw) return null;
      const report = JSON.parse(raw.toString('utf8')) as StoredReport;
      this.rememberDoc(report, true);
      this.degradedWarned = false;
      return report;
    } catch (err) {
      this.warnDegraded(`could not read report ${id}`, err);
      return null;
    }
  }

  async putRendered(id: string, format: ReportFormat, body: Buffer): Promise<string> {
    const key = this.renderedKey(id, format);
    this.rememberRendered(key, body, false);

    if (!this.r2.isConfigured()) {
      this.warnDegraded('R2 is not configured');
      return key;
    }

    try {
      await this.r2.putBuffer(key, body, REPORT_MIME[format]);
      const entry = this.rendered.get(key);
      if (entry) entry.durable = true;
      this.degradedWarned = false;
    } catch (err) {
      this.warnDegraded(`could not persist rendered ${format} for report ${id}`, err);
    }

    return key;
  }

  async getRendered(id: string, format: ReportFormat): Promise<Buffer | null> {
    const key = this.renderedKey(id, format);

    const cached = this.rendered.get(key);
    if (cached) {
      this.touch(this.rendered, key);
      return cached.body;
    }

    if (!this.r2.isConfigured()) return null;

    try {
      const body = await this.readObject(key);
      // null here means "not rendered yet" — the caller renders on demand and
      // calls putRendered. Render-once-and-cache depends on this being null and
      // not an exception.
      if (!body) return null;
      this.rememberRendered(key, body, true);
      this.degradedWarned = false;
      return body;
    } catch (err) {
      this.warnDegraded(`could not read rendered ${format} for report ${id}`, err);
      return null;
    }
  }

  /** Returns null for a missing object; rethrows anything else. */
  private async readObject(key: string): Promise<Buffer | null> {
    try {
      const { body } = await this.r2.getObject(key);
      return await this.drain(body);
    } catch (err) {
      if (this.isNotFound(err)) return null;
      throw err;
    }
  }

  /** Callers stream to HTTP responses themselves; hand back a settled Buffer. */
  private async drain(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  private isNotFound(err: unknown): boolean {
    if (err instanceof NotFoundException) return true;
    const e = err as { name?: string; status?: number; $metadata?: { httpStatusCode?: number } };
    return (
      e?.name === 'NoSuchKey' ||
      e?.name === 'NotFound' ||
      e?.status === 404 ||
      e?.$metadata?.httpStatusCode === 404
    );
  }

  private rememberDoc(report: StoredReport, durable: boolean): void {
    this.docs.delete(report.id);
    this.docs.set(report.id, { report, durable });
    this.evictDocs();
  }

  private markDocDurable(id: string): void {
    const entry = this.docs.get(id);
    if (entry) entry.durable = true;
  }

  private rememberRendered(key: string, body: Buffer, durable: boolean): void {
    const existing = this.rendered.get(key);
    if (existing) this.renderedBytes -= existing.body.byteLength;
    this.rendered.delete(key);

    // A single blob larger than the whole budget would evict everything and
    // still not fit — hold it durably in R2 only.
    if (body.byteLength > RENDERED_CACHE_BYTES) return;

    this.rendered.set(key, { body, durable });
    this.renderedBytes += body.byteLength;
    this.evictRendered();
  }

  /** Move an entry to the tail so eviction sees insertion order as LRU order. */
  private touch<T>(map: Map<string, T>, key: string): void {
    const value = map.get(key);
    if (value === undefined) return;
    map.delete(key);
    map.set(key, value);
  }

  private evictDocs(): void {
    while (this.docs.size > DOC_CACHE_LIMIT) {
      const victim = this.pickVictim(this.docs);
      if (!victim) break;
      this.docs.delete(victim);
    }
  }

  private evictRendered(): void {
    while (this.renderedBytes > RENDERED_CACHE_BYTES && this.rendered.size > 1) {
      const victim = this.pickVictim(this.rendered);
      if (!victim) break;
      const entry = this.rendered.get(victim);
      if (entry) this.renderedBytes -= entry.body.byteLength;
      this.rendered.delete(victim);
    }
  }

  /**
   * Prefer evicting entries that are safely in R2 — dropping one only costs a
   * refetch. Non-durable entries exist nowhere else, so they go last, and only
   * to keep memory bounded.
   */
  private pickVictim(map: Map<string, { durable: boolean }>): string | null {
    let fallback: string | null = null;
    for (const [key, entry] of map) {
      if (entry.durable) return key;
      if (fallback === null) fallback = key;
    }
    if (fallback !== null) {
      this.logger.warn(
        `Evicting memory-only insight report entry ${fallback} to stay within cache limits — it was never persisted to R2 and is now lost.`,
      );
    }
    return fallback;
  }

  private warnDegraded(reason: string, err?: unknown): void {
    if (this.degradedWarned) return;
    this.degradedWarned = true;
    const detail = err instanceof Error ? err.message : err !== undefined ? String(err) : '';
    this.logger.warn(
      `Insight report storage degraded to in-memory: ${reason}${detail ? ` (${detail})` : ''}. ` +
        'Reports will not survive a restart until R2 is reachable. Further failures are logged once per recovery.',
    );
  }
}
