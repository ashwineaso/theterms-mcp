/**
 * Signing request tools — mirrors `theterms`'s `/api/v1/signing-requests`
 * routes (`theterms/apps/web/src/server/api/v1/routes/signing-requests.ts`):
 *   - GET  /signing-requests      (:19, list, filters + pagination)
 *   - POST /signing-requests      (:34, create — requires versionId)
 *   - GET  /signing-requests/:id  (:49, get)
 *
 * `send_signing_request`'s REST counterpart, `CreateSigningRequestSchema`,
 * requires `versionId` (not `documentId`) and does not resolve one from the
 * other server-side — confirmed by reading `signing.service.ts`'s
 * `createRequest`, which looks up the version directly by id and further
 * requires it to be `status: "ACTIVE"` (i.e. already published; a draft's
 * versionId will be rejected). Per the controller ruling on this design
 * question, the tool's input schema exposes `versionId` as-is rather than
 * hiding a documentId→versionId resolution step inside the handler; the
 * description below tells the calling model how to obtain one instead.
 */
import type { z } from "zod";
import {
  getSigningRequestInputSchema,
  listSigningRequestsInputSchema,
  sendSigningRequestInputSchema,
} from "../schemas.js";
import { CREATE_ANNOTATIONS, READ_ONLY_ANNOTATIONS, callTheTermsApi } from "./rest-tool.js";

export const sendSigningRequestTool = {
  name: "send_signing_request",
  config: {
    description:
      "Create a signing request — send a signing invite to a signer for a specific, already-published document version. Requires a versionId, NOT a documentId, and the target version must already be published (ACTIVE), not a draft. To obtain a versionId: call get_document and read the `id` field of the entry in its `versions` array with status \"ACTIVE\" (the most recently published version). Note create_document's response does not include a version id — only get_document, update_draft, and publish_document responses carry the version record itself, whose `id` field is a versionId.",
    inputSchema: sendSigningRequestInputSchema,
    annotations: CREATE_ANNOTATIONS,
  },
  handler: async (args: z.infer<typeof sendSigningRequestInputSchema>) =>
    callTheTermsApi({ method: "POST", path: "/signing-requests", body: args }),
};

export const getSigningRequestTool = {
  name: "get_signing_request",
  config: {
    description:
      "Get a single signing request by id, including its current status (PENDING, ACCEPTED_FULL, ACCEPTED_PARTIAL, REJECTED, VOIDED, or EXPIRED).",
    inputSchema: getSigningRequestInputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
  },
  handler: async (args: z.infer<typeof getSigningRequestInputSchema>) =>
    callTheTermsApi({ method: "GET", path: `/signing-requests/${args.id}` }),
};

export const listSigningRequestsTool = {
  name: "list_signing_requests",
  config: {
    description:
      "List signing requests for your organization, optionally filtered by status, versionId, free-text search, or a relative date range, with pagination via limit/offset.",
    inputSchema: listSigningRequestsInputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
  },
  handler: async (args: z.infer<typeof listSigningRequestsInputSchema>) =>
    callTheTermsApi({
      method: "GET",
      path: "/signing-requests",
      searchParams: {
        status: args.status,
        versionId: args.versionId,
        search: args.search,
        dateRange: args.dateRange,
        sortBy: args.sortBy,
        sortDir: args.sortDir,
        limit: args.limit,
        offset: args.offset,
      },
    }),
};
