"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/app/(components)/Header";
import { coreApiBase } from "@/lib/coreApiBase";
import { useTranslations } from "next-intl";
import { signIn } from "next-auth/react";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  RefreshCw,
  ShieldAlert,
  Save,
  X,
} from "lucide-react";

type UserEntityAccessItem = {
  entity_id: string;
  entity_name: string;
  entity_slug: string | null;
  role: string;
  granted_at: string | null;
};

type UserWithAccess = {
  nextauth_user_id: string;
  backend_user_id: string;
  email: string | null;
  name: string | null;
  department: string | null;
  role: string | null;
  status: string | null;
  entities: UserEntityAccessItem[];
};

type EntityOption = {
  id: string;
  full_legal_name: string;
  slug: string | null;
};

/** Map API error response to a user-friendly message. */
async function getApiErrorMessage(
  res: Response,
  fallback: string,
  accessDeniedMessage: string
): Promise<string> {
  const text = await res.text();
  if (res.status === 403) {
    try {
      const body = JSON.parse(text) as { detail?: string };
      const d = typeof body.detail === "string" ? body.detail : "";
      if (
        /master\s*admin\s*access\s*required/i.test(d) ||
        /master\s*admin\s*only/i.test(d)
      ) {
        return accessDeniedMessage;
      }
    } catch {
      // not JSON
    }
  }
  try {
    const body = JSON.parse(text) as { detail?: string };
    if (typeof body.detail === "string" && body.detail.trim())
      return body.detail.trim();
  } catch {
    // use raw text or fallback
  }
  return text.trim() || fallback;
}

export default function ManageAccessPage() {
  const t = useTranslations("MasterAdminPage");
  const [users, setUsers] = useState<UserWithAccess[]>([]);
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAccessDenied, setIsAccessDenied] = useState(false);
  
  // Per-user editing state
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("viewer");
  const [actionType, setActionType] = useState<"add" | "update" | "delete">("add");
  const [saving, setSaving] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileDepartment, setProfileDepartment] = useState("");
  const [profileRole, setProfileRole] = useState("");
  const [profileStatus, setProfileStatus] = useState<"" | "internal" | "external" | "inactive">("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteStatus, setInviteStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [createEmail, setCreateEmail] = useState("");
  const [createName, setCreateName] = useState("");
  const [createStatus, setCreateStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [createMessage, setCreateMessage] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsAccessDenied(false);
    try {
      const res = await fetch(`${coreApiBase()}/admin/master/users`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) {
        const message = await getApiErrorMessage(
          res,
          t("errors.loadFailed"),
          t("errors.accessDenied")
        );
        setError(message);
        setIsAccessDenied(res.status === 403);
        setUsers([]);
        return;
      }
      const data = (await res.json()) as UserWithAccess[];
      setUsers(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("errors.loadFailed")
      );
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  const fetchEntities = useCallback(async () => {
    try {
      const res = await fetch(`${coreApiBase()}/admin/master/entities`, {
        cache: "no-store",
        credentials: "include",
      });
      if (res.ok) {
        const data = (await res.json()) as EntityOption[];
        setEntities(data);
      }
    } catch (err) {
      // Ignore errors, entities are optional
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchEntities();
  }, [fetchUsers, fetchEntities]);

  const handleStartEdit = (
    user: UserWithAccess,
    type: "add" | "update" | "delete",
    entityId?: string,
    role?: string
  ) => {
    setEditingUser(user.nextauth_user_id);
    setActionType(type);
    setSelectedEntityId(entityId || "");
    setSelectedRole(role || "viewer");
    if (type === "update") {
      setProfileName(user.name ?? "");
      setProfileDepartment(user.department ?? "");
      setProfileRole(user.role ?? "");
      setProfileStatus((user.status as "internal" | "external" | "inactive") ?? "");
    } else {
      setProfileName("");
      setProfileDepartment("");
      setProfileRole("");
      setProfileStatus("");
    }
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setSelectedEntityId("");
    setSelectedRole("viewer");
    setActionType("add");
    setProfileName("");
    setProfileDepartment("");
    setProfileRole("");
    setProfileStatus("");
  };

  const handleSave = async (user: UserWithAccess) => {
    setSaving(true);
    setError(null);

    try {
      const normalized = (val: string | null | undefined) => (val ?? "").trim();
      const namePayload = normalized(profileName);
      const deptPayload = normalized(profileDepartment);
      const rolePayload = normalized(profileRole);
      const statusPayload = profileStatus || "";

      const profileChanged =
        normalized(user.name) !== namePayload ||
        normalized(user.department) !== deptPayload ||
        normalized(user.role) !== rolePayload ||
        normalized(user.status) !== statusPayload;

      if (actionType === "update" && profileChanged) {
        const profileRes = await fetch(
          `${coreApiBase()}/admin/master/users/${user.nextauth_user_id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              name: namePayload || null,
              department: deptPayload || null,
              role: rolePayload || null,
              status: statusPayload || null,
            }),
          }
        );
        if (!profileRes.ok) {
          const message = await getApiErrorMessage(
            profileRes,
            "Failed to update user profile",
            t("errors.accessDenied")
          );
          throw new Error(message);
        }
      }

      const wantsAccessChange =
        actionType === "add" ||
        actionType === "delete" ||
        (actionType === "update" && selectedEntityId);

      if (wantsAccessChange) {
        if (!selectedEntityId) {
          throw new Error("Please select an entity");
        }
        if (!user.backend_user_id) {
          throw new Error("User must log in at least once before access can be granted");
        }

        let res: Response;
        const baseUrl = `${coreApiBase()}/admin/master/users/${user.backend_user_id}/entities/${selectedEntityId}`;

        if (actionType === "add") {
          res = await fetch(baseUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ role: selectedRole }),
          });
        } else if (actionType === "update") {
          res = await fetch(baseUrl, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ role: selectedRole }),
          });
        } else {
          // delete
          res = await fetch(baseUrl, {
            method: "DELETE",
            credentials: "include",
          });
        }

        if (!res.ok) {
          const message = await getApiErrorMessage(
            res,
            "Failed to update access",
            t("errors.accessDenied")
          );
          throw new Error(message);
        }
      }

      if (actionType === "update" && !profileChanged && !wantsAccessChange) {
        throw new Error("No changes to save.");
      }

      // Refresh users list
      await fetchUsers();
      handleCancelEdit();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update access"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleInviteUser = async () => {
    if (!inviteEmail.trim()) {
      setInviteMessage("Please enter an email address.");
      setInviteStatus("error");
      return;
    }
    setInviteStatus("sending");
    setInviteMessage(null);
    try {
      const result = await signIn("email", { email: inviteEmail.trim(), redirect: false });
      if (result?.ok) {
        setInviteStatus("sent");
        setInviteMessage("Invitation sent. Ask the user to check their email for the sign-in code.");
      } else {
        setInviteStatus("error");
        setInviteMessage("Failed to send invite. Check email settings and try again.");
      }
    } catch (err) {
      setInviteStatus("error");
      setInviteMessage(err instanceof Error ? err.message : "Failed to send invite.");
    }
  };

  const handleCreateUser = async () => {
    if (!createEmail.trim()) {
      setCreateMessage("Please enter an email address.");
      setCreateStatus("error");
      return;
    }
    setCreateStatus("saving");
    setCreateMessage(null);
    try {
      const res = await fetch(`${coreApiBase()}/admin/master/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: createEmail.trim(),
          name: createName.trim() || null,
        }),
      });
      if (!res.ok) {
        const message = await getApiErrorMessage(
          res,
          "Failed to create user",
          t("errors.accessDenied")
        );
        throw new Error(message);
      }
      setCreateStatus("saved");
      setCreateMessage("User created. You can now grant access or send an invite.");
      setCreateEmail("");
      setCreateName("");
      await fetchUsers();
    } catch (err) {
      setCreateStatus("error");
      setCreateMessage(err instanceof Error ? err.message : "Failed to create user.");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Header title="Manage Access" subtitle="System Admin" />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  if (isAccessDenied) {
    return (
      <div className="space-y-6">
        <Header title="Manage Access" subtitle="System Admin" />
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            <span>{error || t("errors.accessDenied")}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header title="Manage Access" subtitle="System Admin">
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={() => {
              fetchUsers();
              fetchEntities();
            }}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </Header>

      {error && !isAccessDenied && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-indigo-600" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Invite User
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Sends a sign-in code to the user. They will appear here after they log in.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="user@company.com"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 lg:flex-1"
            />
            <button
              onClick={handleInviteUser}
              disabled={inviteStatus === "sending"}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {inviteStatus === "sending" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Send Invite
            </button>
          </div>
          {inviteMessage && (
            <p
              className={`mt-2 text-xs ${
                inviteStatus === "error"
                  ? "text-rose-600 dark:text-rose-300"
                  : "text-emerald-600 dark:text-emerald-300"
              }`}
            >
              {inviteMessage}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-emerald-600" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Create User
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Creates the user record immediately so you can grant access before they sign in.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Full name (optional)"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <input
              type="email"
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
              placeholder="user@company.com"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={handleCreateUser}
              disabled={createStatus === "saving"}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {createStatus === "saving" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Create User
            </button>
          </div>
          {createMessage && (
            <p
              className={`mt-2 text-xs ${
                createStatus === "error"
                  ? "text-rose-600 dark:text-rose-300"
                  : "text-emerald-600 dark:text-emerald-300"
              }`}
            >
              {createMessage}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 text-left text-sm font-semibold text-slate-900 dark:text-slate-100">
                  User
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Current Access
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-500">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.nextauth_user_id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {user.email || user.name || "Unknown"}
                      </div>
                      {user.email && user.name && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {user.name}
                        </div>
                      )}
                      {(user.department || user.role || user.status) && (
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {[user.department, user.role, user.status].filter(Boolean).join(" · ")}
                        </div>
                      )}
                      {!user.backend_user_id && (
                        <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                          Not logged in yet
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {user.entities.length === 0 ? (
                        <span className="text-slate-400 dark:text-slate-500">No access</span>
                      ) : (
                        <div className="space-y-1">
                          {user.entities.map((entity) => (
                            <div
                              key={entity.entity_id}
                              className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800"
                            >
                              <span className="font-medium text-slate-900 dark:text-slate-100">
                                {entity.entity_name}
                              </span>
                              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                                {entity.role}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      {editingUser === user.nextauth_user_id ? (
                        <div className="flex flex-col gap-3">
                          {actionType === "update" && (
                            <div className="grid gap-2 sm:grid-cols-2">
                              <input
                                type="text"
                                value={profileName}
                                onChange={(e) => setProfileName(e.target.value)}
                                placeholder="Name"
                                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                disabled={saving}
                              />
                              <input
                                type="text"
                                value={profileDepartment}
                                onChange={(e) => setProfileDepartment(e.target.value)}
                                placeholder="Department"
                                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                disabled={saving}
                              />
                              <input
                                type="text"
                                value={profileRole}
                                onChange={(e) => setProfileRole(e.target.value)}
                                placeholder="Role"
                                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                disabled={saving}
                              />
                              <select
                                value={profileStatus}
                                onChange={(e) =>
                                  setProfileStatus(e.target.value as "internal" | "external" | "inactive" | "")
                                }
                                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                disabled={saving}
                              >
                                <option value="">Select status...</option>
                                <option value="internal">Internal</option>
                                <option value="external">External</option>
                                <option value="inactive">Inactive</option>
                              </select>
                            </div>
                          )}

                          <div className="flex flex-wrap items-center gap-2">
                            {actionType === "add" && (
                              <>
                                <select
                                  value={selectedEntityId}
                                  onChange={(e) => setSelectedEntityId(e.target.value)}
                                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                  disabled={saving}
                                >
                                  <option value="">Select entity...</option>
                                  {entities.map((e) => (
                                    <option key={e.id} value={e.id}>
                                      {e.full_legal_name}
                                    </option>
                                  ))}
                                </select>
                                <select
                                  value={selectedRole}
                                  onChange={(e) => setSelectedRole(e.target.value)}
                                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                  disabled={saving}
                                >
                                  <option value="viewer">Viewer</option>
                                  <option value="editor">Editor</option>
                                  <option value="admin">Admin</option>
                                </select>
                              </>
                            )}
                            {actionType === "update" && user.entities.length > 0 && (
                              <>
                                <select
                                  value={selectedEntityId}
                                  onChange={(evt) => {
                                    setSelectedEntityId(evt.target.value);
                                    const entity = user.entities.find((ent) => ent.entity_id === evt.target.value);
                                    if (entity) {
                                      setSelectedRole(entity.role);
                                    }
                                  }}
                                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                  disabled={saving}
                                >
                                  <option value="">Select entity to update...</option>
                                  {user.entities.map((ent) => (
                                    <option key={ent.entity_id} value={ent.entity_id}>
                                      {ent.entity_name} ({ent.role})
                                    </option>
                                  ))}
                                </select>
                                <select
                                  value={selectedRole}
                                  onChange={(e) => setSelectedRole(e.target.value)}
                                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                  disabled={saving}
                                >
                                  <option value="viewer">Viewer</option>
                                  <option value="editor">Editor</option>
                                  <option value="admin">Admin</option>
                                </select>
                              </>
                            )}
                            {actionType === "delete" && (
                              <select
                                value={selectedEntityId}
                                onChange={(e) => setSelectedEntityId(e.target.value)}
                                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                disabled={saving}
                              >
                                <option value="">Select entity to remove...</option>
                                {user.entities.map((e) => (
                                  <option key={e.entity_id} value={e.entity_id}>
                                    {e.entity_name} ({e.role})
                                  </option>
                                ))}
                              </select>
                            )}

                            <button
                              onClick={() => handleSave(user)}
                              disabled={saving || (actionType !== "update" && !selectedEntityId)}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2 py-1 text-xs font-medium text-white transition hover:bg-emerald-600 disabled:opacity-50"
                            >
                              {saving ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Save className="h-3 w-3" />
                              )}
                              Save
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              disabled={saving}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              <X className="h-3 w-3" />
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleStartEdit(user, "add")}
                            disabled={!user.backend_user_id}
                            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2 py-1 text-xs font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
                            title="Add user to entity"
                          >
                            <Plus className="h-3 w-3" />
                            Add
                          </button>
                          {user.entities.length > 0 && (
                            <>
                              <button
                                onClick={() => handleStartEdit(user, "update")}
                                className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2 py-1 text-xs font-medium text-white transition hover:bg-amber-700 disabled:opacity-50"
                                title="Update user role for an entity"
                              >
                                <Pencil className="h-3 w-3" />
                                Update
                              </button>
                              <button
                                onClick={() => handleStartEdit(user, "delete")}
                                disabled={!user.backend_user_id}
                                className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2 py-1 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
                                title="Remove user from an entity"
                              >
                                <Trash2 className="h-3 w-3" />
                                Remove
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
