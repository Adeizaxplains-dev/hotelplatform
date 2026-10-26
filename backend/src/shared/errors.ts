/**
 * Typed application errors. Throw these from services; the central error handler turns
 * them into the API error contract. Messages are safe to show to end users.
 */
export interface ErrorDetail {
  path?: string;
  message: string;
}

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: ErrorDetail[]
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message = "The request contains invalid data.", details?: ErrorDetail[]) {
    super(400, "VALIDATION_ERROR", message, details);
  }
}
export class AuthenticationError extends AppError {
  constructor(message = "Please sign in to continue.") {
    super(401, "UNAUTHENTICATED", message);
  }
}
export class AuthorizationError extends AppError {
  constructor(message = "You do not have permission to perform this action.") {
    super(403, "FORBIDDEN", message);
  }
}
export class TenantAccessError extends AppError {
  constructor(message = "You do not have access to this hotel.") {
    super(403, "TENANT_ACCESS_DENIED", message);
  }
}
export class FeatureNotAvailableError extends AppError {
  constructor(message = "This feature is not included in your current plan.") {
    super(403, "FEATURE_NOT_AVAILABLE", message);
  }
}
export class NotFoundError extends AppError {
  constructor(message = "We could not find what you were looking for.") {
    super(404, "NOT_FOUND", message);
  }
}
export class ConflictError extends AppError {
  constructor(message = "This conflicts with existing data.") {
    super(409, "CONFLICT", message);
  }
}
/** Valid request that breaks a business rule (e.g. room already booked for those dates). */
export class BusinessRuleError extends AppError {
  constructor(message: string, code = "BUSINESS_RULE_VIOLATION") {
    super(422, code, message);
  }
}
export class PaymentError extends AppError {
  constructor(message = "The payment could not be processed.", code = "PAYMENT_ERROR") {
    super(422, code, message);
  }
}
export class RateLimitError extends AppError {
  constructor(message = "Too many requests. Please wait a moment and try again.") {
    super(429, "RATE_LIMITED", message);
  }
}
export class ServiceUnavailableError extends AppError {
  constructor(message = "The service is temporarily unavailable.") {
    super(503, "SERVICE_UNAVAILABLE", message);
  }
}

export class InvalidCredentialsError extends AppError {
  constructor() {
    // One message for "no such user", "wrong password" and "temporarily locked": no account enumeration.
    super(401, "INVALID_CREDENTIALS", "Invalid email or password.");
  }
}
export class AccountDisabledError extends AppError {
  constructor() {
    super(403, "ACCOUNT_DISABLED", "This account has been disabled. Please contact the hotel.");
  }
}
export class TenantNotFoundError extends AppError {
  constructor() {
    super(404, "TENANT_NOT_FOUND", "We could not find this hotel.");
  }
}
export class TenantSuspendedError extends AppError {
  constructor() {
    super(403, "TENANT_SUSPENDED", "This hotel's account is currently suspended.");
  }
}
