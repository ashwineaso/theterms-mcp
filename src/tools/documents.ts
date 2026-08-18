/**
 * Document tools — mirrors `theterms`'s `/api/v1/documents` routes
 * (`theterms/apps/web/src/server/api/v1/routes/documents.ts`):
 *   - GET    /documents            (:24, list, requires ?containerId=)
 *   - POST   /documents            (:32, create)
 *   - GET    /documents/:id        (:47, get)
 *   - PUT    /documents/:id/draft  (:55-58, update draft)
 *   - POST   /documents/:id/publish (:88, publish)
 *
 * Response-shape notes (from `theterms`'s `document.service.ts`, verified
 * by reading the service functions, not guessed) that inform the
 * descriptions below:
 *   - `createDocument`'s response is the plain `Document` record — it does
 *     NOT include the id of the DRAFT version it creates alongside it.
 *   - `getDocumentById`'s response includes a `versions` array, each entry
 *     carrying its own `id` — that `id` is the versionId other tools need.
 *   - `updateVersion`/`publishVersion` both return the `DocumentVersion`
 *     record directly, so their response's `id` field is also a versionId.
 */
import type { z } from "zod";
import {
  createDocumentInputSchema,
  getDocumentInputSchema,
  listDocumentsInputSchema,
  publishDocumentInputSchema,
  updateDraftInputSchema,
} from "../schemas.js";
import {
  CREATE_ANNOTATIONS,
  IDEMPOTENT_MUTATION_ANNOTATIONS,
  READ_ONLY_ANNOTATIONS,
  callTheTermsApi,
} from "./rest-tool.js";

export const listDocumentsTool = {
  name: "list_documents",
  config: {
    description: "List documents within a specific container. Requires the container's id.",
    inputSchema: listDocumentsInputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
  },
  handler: async (args: z.infer<typeof listDocumentsInputSchema>) =>
    callTheTermsApi({
      method: "GET",
      path: "/documents",
      searchParams: { containerId: args.containerId },
    }),
};

export const getDocumentTool = {
  name: "get_document",
  config: {
    description:
      "Get a single document by id, including all of its versions (draft, active/published, and archived) under the `versions` field. Each version has its own `id`, which is the versionId used by tools like send_signing_request.",
    inputSchema: getDocumentInputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
  },
  handler: async (args: z.infer<typeof getDocumentInputSchema>) =>
    callTheTermsApi({ method: "GET", path: `/documents/${args.id}` }),
};

export const createDocumentTool = {
  name: "create_document",
  config: {
    description:
      "Create a new document inside a container. This also creates the document's initial DRAFT version, but the response body contains only the document record — it does NOT include the new draft version's id. If you need that version's id (e.g. to call update_draft or send_signing_request later), call get_document with the returned document id afterward.",
    inputSchema: createDocumentInputSchema,
    annotations: CREATE_ANNOTATIONS,
  },
  handler: async (args: z.infer<typeof createDocumentInputSchema>) =>
    callTheTermsApi({ method: "POST", path: "/documents", body: args }),
};

export const updateDraftTool = {
  name: "update_draft",
  config: {
    description:
      'Replace a document\'s current draft version\'s content (clauses) and settings. IMPORTANT: this REPLACES the entire clauses array — there is no patch/merge on the server, so any clause you omit is permanently deleted, not preserved. You MUST call get_document first to fetch the document\'s current draft version, then pass its FULL, current "content.clauses" array back here (including every clause you are not changing) alongside whatever edits you are making. `settings` is likewise replaced in full on every update, not merged — carry the current draft version\'s `settings` object forward from get_document unless you are deliberately changing it.',
    inputSchema: updateDraftInputSchema,
    annotations: IDEMPOTENT_MUTATION_ANNOTATIONS,
  },
  handler: async (args: z.infer<typeof updateDraftInputSchema>) =>
    callTheTermsApi({
      method: "PUT",
      path: `/documents/${args.id}/draft`,
      body: { content: args.content, settings: args.settings },
    }),
};

export const publishDocumentTool = {
  name: "publish_document",
  config: {
    description:
      "Publish a document's current draft version, making it the active, signable version. Takes only the document's id as a path parameter — no request body.",
    inputSchema: publishDocumentInputSchema,
    annotations: IDEMPOTENT_MUTATION_ANNOTATIONS,
  },
  handler: async (args: z.infer<typeof publishDocumentInputSchema>) =>
    callTheTermsApi({ method: "POST", path: `/documents/${args.id}/publish` }),
};
