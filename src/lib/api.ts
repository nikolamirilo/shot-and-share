import { NextResponse } from "next/server";
import type { ZodTypeAny, output } from "zod";

export type ApiErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "gone"
  | "quota_exceeded"
  | "rate_limited"
  | "not_configured"
  | "server_error";

const STATUS: Record<ApiErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  gone: 410,
  quota_exceeded: 413,
  rate_limited: 429,
  not_configured: 501,
  server_error: 500,
};

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function fail(
  code: ApiErrorCode,
  message: string,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json(
    { error: { code, message, ...extra } },
    { status: STATUS[code] },
  );
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

/**
 * One place where an unexpected throw becomes a 500 without leaking a stack
 * trace to whoever is poking at the endpoint.
 */
export async function handle(
  fn: () => Promise<Response>,
): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.code, error.message, error.extra);
    }
    console.error("[api]", error);

    // A missing variable is a deployment problem, not a bug. Saying so with a
    // distinct status means monitoring can tell "we are broken" apart from
    // "we were never finished being set up", and the message is safe to show:
    // it names a variable, never a value.
    if (
      error instanceof Error &&
      /Missing required environment/.test(error.message)
    ) {
      return fail("not_configured", error.message);
    }

    return fail("server_error", "Something went wrong. Please try again.");
  }
}

/**
 * The parsed body, typed as what the schema *produces* rather than what it
 * accepts - so a field with a `.default()` reads as set, which is the whole
 * point of giving it one.
 */
export async function parseBody<S extends ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<output<S>> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw new ApiError("bad_request", "Expected a JSON body.");
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    throw new ApiError("bad_request", result.error.issues[0]?.message ?? "Invalid request.");
  }
  return result.data;
}
