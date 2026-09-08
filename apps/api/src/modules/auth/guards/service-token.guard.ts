import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';

/**
 * Bearer-token auth for non-human API consumers (the B.I.L.L.I.E. voice
 * assistant is the first one).
 *
 * Deliberately NOT the Supabase JWT path used by the web and mobile apps:
 *  - Supabase access tokens expire in ~1h, so a headless service can't hold one.
 *  - The only Supabase role with access to platform/user numbers is ADMIN, and
 *    an ADMIN JWT also unlocks `DELETE /admin/users/:id` and
 *    `DELETE /admin/data/indicator-values`. A read-only consumer must not be
 *    handed that.
 *
 * The token is therefore a long-lived static secret with a single hard-coded
 * scope: read. `canActivate` rejects every non-GET request outright, so the
 * token stays read-only even if it is later applied to a controller that has
 * mutating routes. Widening this is a deliberate code change, not a config
 * change.
 */
@Injectable()
export class ServiceTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Scope enforcement first: read-only, no exceptions.
    if (request.method !== 'GET') {
      throw new ForbiddenException({
        message: 'This token is read-only. Write operations are not permitted.',
        statusCode: 403,
      });
    }

    const expected = process.env.AYO_BILLIE_TOKEN;
    if (!expected) {
      // Distinct from 401 on purpose: the caller's credential may be perfectly
      // fine — the server just has nothing to compare it against. A voice
      // assistant needs to tell "my token is wrong" apart from "the platform
      // is misconfigured", because only one of those is the operator's fault.
      throw new ServiceUnavailableException({
        message:
          'Service-token auth is not configured on this server (AYO_BILLIE_TOKEN is unset).',
        statusCode: 503,
      });
    }

    const header = request.headers?.authorization ?? '';
    const match = /^Bearer\s+(.+)$/i.exec(header.trim());
    if (!match) {
      throw new UnauthorizedException({
        message: 'Missing Authorization: Bearer <token> header.',
        statusCode: 401,
      });
    }

    if (!safeEqual(match[1], expected)) {
      throw new UnauthorizedException({
        message: 'Invalid service token.',
        statusCode: 401,
      });
    }

    // Mark the caller so RlsMiddleware-style consumers and the logging
    // interceptor can see this wasn't an anonymous public hit. No `role` is
    // set, so nothing that keys off UserRole can be reached with this token.
    request.serviceClient = 'billie';
    return true;
  }
}

/** Constant-time comparison that tolerates unequal lengths. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    // Still burn a comparison so length isn't leaked by timing.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
