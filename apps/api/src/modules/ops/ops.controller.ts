import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { OpsService } from './ops.service';
import { ServiceTokenGuard } from '../auth/guards/service-token.guard';

/**
 * Operator status and headline numbers, for headless consumers.
 *
 * Guarded by ServiceTokenGuard (static bearer token, read-only) rather than the
 * Supabase JWT + @Roles('ADMIN') pair used by AdminController. Same numbers, but
 * reaching them must not require a credential that can also delete users or
 * wipe indicator values.
 *
 * `GET /api/health` is intentionally NOT here — it stays public and unauthed so
 * a consumer can tell "the platform is down" apart from "my token is broken".
 */
@ApiTags('ops')
@Controller('ops')
@UseGuards(ServiceTokenGuard)
@ApiBearerAuth()
// One voice query can trigger a status check; 30/min is generous for a single
// assistant and still caps a leaked token's usefulness.
@Throttle({ medium: { ttl: 60000, limit: 30 } })
export class OpsController {
  constructor(private readonly ops: OpsService) {}

  @Get('status')
  @ApiOperation({
    summary: 'Is the platform up, and what is broken',
    description:
      'Rolls up the API, database, public website and AI layer into one status plus a plain-language problems list. Unlike /insights/status, the AI check is a real round trip to Anthropic, not a check that an env var exists.',
  })
  getStatus() {
    return this.ops.getStatus();
  }

  @Get('users')
  @ApiOperation({
    summary: 'Signup and engagement counts',
    description:
      'Total registered users, new signups this week and month, active users, role breakdown, and newsletter subscribers. Counts only — no names, emails or per-user records.',
  })
  getUsers() {
    return this.ops.getUsers();
  }

  @Get('numbers')
  @ApiOperation({
    summary: 'Headline platform numbers',
    description:
      'Countries, indicators, themes, data points, year coverage, indexed countries, experts, policies, documents, users and subscribers in a single call.',
  })
  getNumbers() {
    return this.ops.getNumbers();
  }
}
