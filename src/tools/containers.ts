/**
 * Container tools — mirrors `theterms`'s `GET/POST /api/v1/containers`
 * (`theterms/apps/web/src/server/api/v1/routes/containers.ts:15,22`).
 */
import type { z } from "zod";
import { createContainerInputSchema } from "../schemas.js";
import { CREATE_ANNOTATIONS, READ_ONLY_ANNOTATIONS, callTheTermsApi } from "./rest-tool.js";

export const listContainersTool = {
  name: "list_containers",
  config: {
    description:
      "List all containers (top-level document collections) in your organization. Takes no input.",
    annotations: READ_ONLY_ANNOTATIONS,
  },
  handler: async () => callTheTermsApi({ method: "GET", path: "/containers" }),
};

export const createContainerTool = {
  name: "create_container",
  config: {
    description:
      "Create a new container — a top-level collection that documents are organized into.",
    inputSchema: createContainerInputSchema,
    annotations: CREATE_ANNOTATIONS,
  },
  handler: async (args: z.infer<typeof createContainerInputSchema>) =>
    callTheTermsApi({ method: "POST", path: "/containers", body: args }),
};
