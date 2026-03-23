/**
 * Common Exceptions Export
 */
export {
  BaseApplicationException,
  ValidationException,
  BusinessLogicException,
  ResourceNotFoundException,
  SecurityException,
  RateLimitException,
  IpBlockedException,
  BotDetectedException,
  InvalidUserAgentException,
  HeadlessBrowserException,
  ExternalServiceException,
  SystemException,
  DatabaseException,
} from './application.exception';

export type { InternalErrorDetails } from '../constants/error.constants';
