import { NextResponse } from "next/server";

export class HttpError extends Error {
  status: number;
  body: Record<string, unknown>;

  constructor(status: number, body: Record<string, unknown>) {
    super(String(body.detail ?? "Request failed"));
    this.name = "HttpError";
    this.status = status;
    this.body = body;
  }
}

export function jsonHttpError(detail: string, status: number): HttpError {
  return new HttpError(status, { detail });
}

export function errorToResponse(err: unknown): NextResponse | null {
  if (err instanceof HttpError) {
    return NextResponse.json(err.body, { status: err.status });
  }
  if (err instanceof Response) {
    return new NextResponse(err.body, {
      status: err.status,
      statusText: err.statusText,
      headers: err.headers,
    });
  }
  return null;
}
