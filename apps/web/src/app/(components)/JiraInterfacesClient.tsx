"use client";

import { useState, useEffect } from "react";
import { coreApiBase } from "@/lib/coreApiBase";
import { Settings, CheckCircle2, XCircle, AlertCircle, RefreshCw, ExternalLink } from "lucide-react";

interface JiraConfig {
  base_url: string;
  auth_type: string;
  configured: boolean;
  email?: string;
  api_token_configured?: boolean;
  username?: string;
  password_configured?: boolean;
  oauth_token_configured?: boolean;
}

interface JiraProject {
  key: string;
  name: string;
  project_type: string;
  id: string;
}

interface SyncStatus {
  project_slug: string;
  last_sync: string | null;
  issues_synced: number;
  governance_types_count: number;
  status: string;
}

export default function JiraInterfacesClient() {
  const [config, setConfig] = useState<JiraConfig | null>(null);
  const [projects, setProjects] = useState<JiraProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadConfig = async () => {
    try {
      const res = await fetch(`${coreApiBase()}/admin/jira/config`, {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`Failed to load config: ${res.status}`);
      }
      const data = await res.json() as JiraConfig;
      setConfig(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Jira configuration");
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    if (!config?.configured) return;
    try {
      const res = await fetch(`${coreApiBase()}/admin/jira/projects`, {
        cache: "no-store",
      });
      if (!res.ok) {
        // Don't show error for projects, just log it
        console.warn("Failed to load projects:", res.status);
        return;
      }
      const data = await res.json() as JiraProject[];
      setProjects(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load projects:", err);
      // Silently fail - projects are optional
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      const res = await fetch(`${coreApiBase()}/admin/jira/config/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({ success: true, message: data.message || "Connection successful" });
        setError(null);
        await loadProjects();
      } else {
        const errorMsg = data.detail || data.message || "Connection test failed";
        setTestResult({ success: false, message: errorMsg });
        setError(errorMsg);
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : "Connection test failed",
      });
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    if (config?.configured) {
      loadProjects();
    }
  }, [config?.configured]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Configuration Status */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Jira Interface Configuration
          </h2>
          <button
            onClick={testConnection}
            disabled={testing || !config?.configured}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {testing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Test Connection
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/60 dark:bg-red-950/40 dark:text-red-100">
            {error}
          </div>
        )}

        {testResult && (
          <div
            className={`mb-4 rounded-lg border p-3 text-sm ${
              testResult.success
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/60 dark:bg-emerald-950/40 dark:text-emerald-100"
                : "border-red-200 bg-red-50 text-red-700 dark:border-red-500/60 dark:bg-red-950/40 dark:text-red-100"
            }`}
          >
            <div className="flex items-center gap-2">
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <span>{testResult.message}</span>
            </div>
          </div>
        )}

        {config && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Base URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={config.base_url || ""}
                    readOnly
                    className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                  />
                  {config.base_url && (
                    <a
                      href={config.base_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Authentication Type
                </label>
                <div className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200">
                  {config.auth_type || "Not configured"}
                </div>
              </div>

              {config.auth_type === "api_token" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Email
                    </label>
                    <div className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200">
                      {config.email || "Not configured"}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      API Token
                    </label>
                    <div className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200">
                      {config.api_token_configured ? (
                        <span className="text-emerald-600 dark:text-emerald-400">✓ Configured</span>
                      ) : (
                        <span className="text-slate-400">Not configured</span>
                      )}
                    </div>
                  </div>
                </>
              )}

              {config.auth_type === "basic" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Username
                    </label>
                    <div className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200">
                      {config.username || "Not configured"}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Password
                    </label>
                    <div className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200">
                      {config.password_configured ? (
                        <span className="text-emerald-600 dark:text-emerald-400">✓ Configured</span>
                      ) : (
                        <span className="text-slate-400">Not configured</span>
                      )}
                    </div>
                  </div>
                </>
              )}

              {config.auth_type === "oauth2" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    OAuth Token
                  </label>
                  <div className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200">
                    {config.oauth_token_configured ? (
                      <span className="text-emerald-600 dark:text-emerald-400">✓ Configured</span>
                    ) : (
                      <span className="text-slate-400">Not configured</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                {config.configured ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      Configuration is active
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                      Configuration incomplete - set environment variables
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Available Projects */}
      {config?.configured && projects.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50 mb-4">
            Available Jira Projects
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {projects.slice(0, 12).map((project) => (
              <div
                key={project.id}
                className="p-3 border border-slate-200 rounded-lg dark:border-slate-700"
              >
                <div className="font-medium text-slate-900 dark:text-slate-50">
                  {project.key}
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {project.name}
                </div>
                <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  {project.project_type}
                </div>
              </div>
            ))}
          </div>
          {projects.length > 12 && (
            <div className="mt-4 text-sm text-slate-500 dark:text-slate-400 text-center">
              Showing 12 of {projects.length} projects
            </div>
          )}
        </div>
      )}

      {/* Configuration Instructions */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50 mb-4">
          Configuration Instructions
        </h2>
        <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
          <p>
            Configure Jira integration by setting environment variables in your Docker Compose or
            environment configuration:
          </p>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 font-mono text-xs overflow-x-auto">
            <div className="space-y-2">
              <div>
                <span className="text-emerald-600 dark:text-emerald-400"># Required</span>
              </div>
              <div>
                <span className="text-blue-600 dark:text-blue-400">JIRA_BASE_URL</span>=
                <span className="text-slate-700 dark:text-slate-300">
                  https://yourcompany.atlassian.net
                </span>
              </div>
              <div>
                <span className="text-blue-600 dark:text-blue-400">JIRA_AUTH_TYPE</span>=
                <span className="text-slate-700 dark:text-slate-300">api_token</span>
              </div>
              <div className="mt-3">
                <span className="text-emerald-600 dark:text-emerald-400">
                  # For API Token (Jira Cloud)
                </span>
              </div>
              <div>
                <span className="text-blue-600 dark:text-blue-400">JIRA_EMAIL</span>=
                <span className="text-slate-700 dark:text-slate-300">your.email@company.com</span>
              </div>
              <div>
                <span className="text-blue-600 dark:text-blue-400">JIRA_API_TOKEN</span>=
                <span className="text-slate-700 dark:text-slate-300">your_api_token</span>
              </div>
            </div>
          </div>
          <p className="pt-2">
            After setting environment variables, restart the core-svc container and test the
            connection using the button above.
          </p>
        </div>
      </div>
    </div>
  );
}
