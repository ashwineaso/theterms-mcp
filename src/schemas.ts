/**
 * Input schemas for the MCP server's tools.
 *
 * These are hand-mirrored copies of the REST API's request validation
 * schemas from the sibling `theterms` repo — NOT a shared import (see
 * design.md D1: this repo has zero build/runtime dependency on
 * `theterms`). Each schema below carries a one-line source-pointer
 * comment so it can be re-synced by hand if the REST source changes.
 *
 * Source repo root for all pointers below:
 *   theterms/apps/web/src/server/api/v1/
 */
import { z } from "zod";

// ─── Containers ───────────────────────────────────────────────

// Mirrors CreateContainerSchema — schemas.ts:41-44 (used by POST /containers, routes/containers.ts:22)
export const createContainerInputSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

// NOTE: list_containers (GET /containers, routes/containers.ts:15) has no
// request-validated input in the REST source — it takes no query/body
// params, just the org scope resolved from the API key. No schema is
// mirrored for it, per the brief's allowance that not every tool needs one.

// ─── Documents ────────────────────────────────────────────────

// Mirrors ContainerIdQuerySchema — schemas.ts:64-66 (used by GET /documents, routes/documents.ts:24)
export const listDocumentsInputSchema = z.object({
  containerId: z.string().uuid(),
});

// Mirrors UuidParamSchema — schemas.ts:25-27 (used by GET /documents/:id, routes/documents.ts:47)
export const getDocumentInputSchema = z.object({
  id: z.string().uuid(),
});

// Mirrors CreateDocumentSchema — schemas.ts:58-62 (used by POST /documents, routes/documents.ts:32)
export const createDocumentInputSchema = z.object({
  containerId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

// Mirrors ClauseSchema — schemas.ts:68-77 (nested inside UpdateDraftSchema's content.clauses array)
export const clauseInputSchema = z.object({
  id: z.string(),
  order: z.number(),
  section: z.string().optional(),
  title: z.string(),
  content: z.string(),
  is_mandatory: z.boolean(),
  default_checked: z.boolean(),
  slug: z.string(),
});

// Mirrors UuidParamSchema (param) + UpdateDraftSchema (body) — schemas.ts:25-27, 79-87
// (used together by PUT /documents/:id/draft, routes/documents.ts:55-58)
export const updateDraftInputSchema = z.object({
  id: z.string().uuid(),
  content: z.object({
    clauses: z.array(clauseInputSchema),
  }),
  settings: z.object({
    expiry_days: z.number().min(0).max(365),
    redirect_url: z.string().url().nullish(),
  }),
});

// Mirrors UuidParamSchema — schemas.ts:25-27 (used by POST /documents/:id/publish, routes/documents.ts:88)
export const publishDocumentInputSchema = z.object({
  id: z.string().uuid(),
});

// ─── Signing Requests ─────────────────────────────────────────

// Mirrors CreateSigningRequestSchema — schemas.ts:103-107 (used by POST /signing-requests, routes/signing-requests.ts:34)
export const sendSigningRequestInputSchema = z.object({
  versionId: z.string().uuid(),
  signerName: z.string().min(1),
  signerEmail: z.string().email(),
});

// Mirrors UuidParamSchema — schemas.ts:25-27 (used by GET /signing-requests/:id, routes/signing-requests.ts:49)
export const getSigningRequestInputSchema = z.object({
  id: z.string().uuid(),
});

// Mirrors ListSigningRequestsQuerySchema — schemas.ts:109-120 (used by GET /signing-requests, routes/signing-requests.ts:19)
export const listSigningRequestsInputSchema = z.object({
  status: z
    .enum(["PENDING", "ACCEPTED_FULL", "ACCEPTED_PARTIAL", "REJECTED", "VOIDED", "EXPIRED"])
    .optional(),
  versionId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
  dateRange: z.enum(["7d", "30d", "90d"]).optional(),
  sortBy: z.enum(["created_at", "signer_name", "status"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  limit: z.coerce.number().min(1).max(100).default(25),
  offset: z.coerce.number().min(0).default(0),
});
