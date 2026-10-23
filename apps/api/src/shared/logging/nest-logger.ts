import type { Logger } from '@flowboard/logger';
import type { LoggerService } from '@nestjs/common';

// Nest diagnostics can contain routes, payloads or arbitrary exception messages.
// Keep only severity; application boundary events carry safe structured context.
export class NestLogger implements LoggerService {
  constructor(private readonly logger: Logger) {}
  log() {
    this.logger.debug('framework.log', { component: 'nest' });
  }
  error() {
    this.logger.error('framework.error', { component: 'nest' });
  }
  warn() {
    this.logger.warn('framework.warn', { component: 'nest' });
  }
  debug() {
    this.logger.debug('framework.debug', { component: 'nest' });
  }
  verbose() {
    this.logger.trace('framework.verbose', { component: 'nest' });
  }
  fatal() {
    this.logger.fatal('framework.fatal', { component: 'nest' });
  }
}
