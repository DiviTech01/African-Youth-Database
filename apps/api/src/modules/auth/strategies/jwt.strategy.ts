import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { createPublicKey } from 'crypto';
import * as https from 'https';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthService } from '../auth.service';

interface JwtPayload {
  sub: string;
  email: string;
  user_metadata?: { name?: string };
}

// ── Tiny JWKS cache so we don't hit Supabase on every request ──────────────
// Supabase issues access tokens signed with ES256 keys served at
// {SUPABASE_URL}/auth/v1/.well-known/jwks.json. We fetch once and cache PEM
// public keys by kid. A 10-minute TTL is plenty (Supabase rotates rarely).
type PemMap = Map<string, string>;
const KID_CACHE: { keys: PemMap; expiresAt: number } = { keys: new Map(), expiresAt: 0 };

function fetchJwksOnce(jwksUrl: string, opts: https.RequestOptions = {}): Promise<PemMap> {
  return new Promise((resolve, reject) => {
    https
      .get(jwksUrl, opts, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          try {
            const body = Buffer.concat(chunks).toString('utf8');
            const json = JSON.parse(body) as { keys: any[] };
            const map: PemMap = new Map();
            for (const jwk of json.keys ?? []) {
              try {
                const pem = createPublicKey({ key: jwk, format: 'jwk' }).export({
                  type: 'spki',
                  format: 'pem',
                }) as string;
                if (jwk.kid) map.set(jwk.kid, pem);
              } catch (e) {
                console.warn('[JwtStrategy] could not import JWK:', (e as Error).message);
              }
            }
            resolve(map);
          } catch (err) {
            reject(err);
          }
        });
      })
      .on('error', reject);
  });
}

// Dev machines (notably Node on Windows) sometimes can't validate Supabase's
// TLS cert because Node doesn't trust the system root CA store — the fetch
// then fails with "unable to verify the first certificate" and every admin
// request 401s. We retry with rejectUnauthorized=false ONLY on that specific
// cert error, and ONLY outside production. JWKS keys are public so the worst
// case is fetching public keys over an unvalidated channel; tokens are still
// validated afterwards. In production the first attempt always succeeds.
async function fetchJwks(jwksUrl: string): Promise<PemMap> {
  try {
    return await fetchJwksOnce(jwksUrl);
  } catch (err) {
    const msg = (err as NodeJS.ErrnoException)?.message || '';
    const isCertError =
      /unable to verify the first certificate|self.?signed certificate|UNABLE_TO_VERIFY_LEAF_SIGNATURE|CERT_/i.test(
        msg,
      );
    if (isCertError && process.env.NODE_ENV !== 'production') {
      console.warn(
        '[JwtStrategy] JWKS TLS validation failed — retrying with rejectUnauthorized=false (dev only). ' +
          'For a permanent fix, run Node with --use-system-ca or install the missing root CA.',
      );
      return fetchJwksOnce(jwksUrl, { rejectUnauthorized: false } as https.RequestOptions);
    }
    throw err;
  }
}

async function getKeyForKid(jwksUrl: string, kid: string): Promise<string | null> {
  const now = Date.now();
  if (KID_CACHE.keys.has(kid) && KID_CACHE.expiresAt > now) {
    return KID_CACHE.keys.get(kid)!;
  }
  // Refresh — either expired or we don't have this kid yet (key rotation case).
  try {
    const fresh = await fetchJwks(jwksUrl);
    KID_CACHE.keys = fresh;
    KID_CACHE.expiresAt = now + 10 * 60 * 1000; // 10 min
    return fresh.get(kid) ?? null;
  } catch (err) {
    console.warn('[JwtStrategy] JWKS fetch failed:', (err as Error).message);
    return null;
  }
}

function decodeHeaderUnsafe(token: string): { alg?: string; kid?: string } | null {
  try {
    const [headerB64] = token.split('.');
    if (!headerB64) return null;
    return JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger('JwtStrategy');

  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
  ) {
    const hsSecret = process.env.SUPABASE_JWT_SECRET;
    const supabaseUrl = process.env.SUPABASE_URL;
    const jwksUrl = supabaseUrl
      ? `${supabaseUrl.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`
      : null;

    if (!hsSecret) {
      console.error('[JwtStrategy] SUPABASE_JWT_SECRET is not set — HS256 tokens (legacy) cannot validate');
    } else {
      console.log(`[JwtStrategy] HS256 secret loaded · length=${hsSecret.length}`);
    }
    if (!jwksUrl) {
      console.error('[JwtStrategy] SUPABASE_URL is not set — ES256/RS256 tokens cannot validate (no JWKS endpoint)');
    } else {
      console.log(`[JwtStrategy] JWKS endpoint: ${jwksUrl}`);
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['HS256', 'ES256', 'RS256'],
      secretOrKeyProvider: async (
        _request: unknown,
        rawJwtToken: string,
        done: (err: Error | null, key?: string | Buffer) => void,
      ) => {
        try {
          const header = decodeHeaderUnsafe(rawJwtToken);
          if (!header?.alg) return done(new Error('cannot decode token header'));

          if (header.alg === 'HS256') {
            if (!hsSecret) return done(new Error('HS256 secret not configured'));
            return done(null, hsSecret);
          }
          if (header.alg === 'ES256' || header.alg === 'RS256') {
            if (!jwksUrl) return done(new Error('JWKS URL not configured'));
            if (!header.kid) return done(new Error('asymmetric token has no kid'));
            const pem = await getKeyForKid(jwksUrl, header.kid);
            if (!pem) return done(new Error(`no JWKS key for kid=${header.kid}`));
            return done(null, pem);
          }
          return done(new Error(`unsupported alg: ${header.alg}`));
        } catch (err) {
          return done(err as Error);
        }
      },
      passReqToCallback: false,
    });
  }

  async validate(payload: JwtPayload) {
    const existing = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true },
    });

    if (existing) return existing;

    // First-time login — provision and send welcome email
    const name = payload.user_metadata?.name ?? undefined;
    const user = await this.prisma.user.create({
      data: {
        id: payload.sub,
        email: payload.email,
        name,
        role: 'REGISTERED',
      },
      select: { id: true, email: true, name: true, role: true },
    });

    this.authService.onNewUserProvisioned({
      id: user.id,
      email: user.email,
      name: user.name ?? undefined,
      role: user.role,
    });

    return user;
  }
}
