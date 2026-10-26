import type { Request, RequestHandler, Response } from "express";
import { getCtx } from "../../shared/context.js";
import { AuthenticationError, TenantNotFoundError } from "../../shared/errors.js";
import { getValidated } from "../../middleware/validate.js";
import { sendSuccess } from "../../shared/response.js";
import { baseUrlFor, requestMeta } from "../auth/auth.controller.js";
import { assignableRoles, permissionsFor, STAFF_ROLES } from "../rbac/roles.js";
import type { CreateUserBody, ListUsersQuery, UpdateUserBody } from "./user.schemas.js";
import type { UserService } from "./user.service.js";

function who(res: Response) {
  const { auth, tenant } = getCtx(res);
  if (!auth) throw new AuthenticationError();
  if (!tenant) throw new TenantNotFoundError();
  return { actor: auth, tenant };
}
const h = (fn: (req: Request, res: Response) => Promise<void>): RequestHandler => (req, res, next) => void fn(req, res).catch(next);

export function createUserController(users: UserService) {
  return {
    list: h(async (_req, res) => {
      const { tenant } = who(res);
      const { query } = getValidated<unknown, ListUsersQuery>(res);
      const { items, meta } = await users.list(tenant.id, query);
      sendSuccess(res, items, 200, meta);
    }),
    get: h(async (_req, res) => {
      const { tenant } = who(res);
      const { params } = getValidated<unknown, unknown, { id: string }>(res);
      sendSuccess(res, await users.get(tenant.id, params.id));
    }),
    create: h(async (req, res) => {
      const { actor, tenant } = who(res);
      const { body } = getValidated<CreateUserBody>(res);
      sendSuccess(res, await users.create(actor, tenant, body, baseUrlFor(req), requestMeta(req, res)), 201);
    }),
    update: h(async (req, res) => {
      const { actor, tenant } = who(res);
      const { body, params } = getValidated<UpdateUserBody, unknown, { id: string }>(res);
      sendSuccess(res, await users.update(actor, tenant, params.id, body, requestMeta(req, res)));
    }),
    disable: h(async (req, res) => {
      const { actor, tenant } = who(res);
      const { params } = getValidated<unknown, unknown, { id: string }>(res);
      sendSuccess(res, await users.setActive(actor, tenant, params.id, false, requestMeta(req, res)));
    }),
    enable: h(async (req, res) => {
      const { actor, tenant } = who(res);
      const { params } = getValidated<unknown, unknown, { id: string }>(res);
      sendSuccess(res, await users.setActive(actor, tenant, params.id, true, requestMeta(req, res)));
    }),
    roles: h(async (_req, res) => {
      const { actor } = who(res);
      const assignable = new Set(assignableRoles(actor.role));
      sendSuccess(res, STAFF_ROLES.map((r) => ({ role: r, assignable: assignable.has(r), permissions: permissionsFor(r) })));
    }),
  };
}
