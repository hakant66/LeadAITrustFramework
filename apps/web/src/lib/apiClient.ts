/**
 * API client utilities for making authenticated requests to the backend.
 * Automatically includes entity_id and authentication headers.
 */

/**
 * Get the current entity ID from sessionStorage or context.
 * Falls back to null if not available.
 */
export function getCurrentEntityId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return sessionStorage.getItem("entityId");
}

/**
 * Build headers for API requests, including authentication and entity context.
 */
export async function buildApiHeaders(
  additionalHeaders?: HeadersInit
): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(additionalHeaders as Record<string, string>),
  };

  // Add entity_id if available
  const entityId = getCurrentEntityId();
  if (entityId) {
    headers["X-Entity-ID"] = entityId;
  }

  return headers;
}

/**
 * Make an authenticated API request to the core service.
 * Automatically includes entity_id and authentication headers.
 */
export async function apiRequest<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = typeof window !== "undefined" ? "/api/core" : 
    (process.env.CORE_SVC_URL ?? process.env.NEXT_PUBLIC_CORE_SVC_URL ?? "http://localhost:8001");

  const url = path.startsWith("http") ? path : `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  
  const headers = await buildApiHeaders(options.headers);
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string>),
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`API request failed: ${response.status} ${errorText}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Make a GET request with entity context.
 */
export async function apiGet<T = unknown>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: "GET" });
}

/**
 * Make a POST request with entity context.
 */
export async function apiPost<T = unknown>(
  path: string,
  body?: unknown
): Promise<T> {
  return apiRequest<T>(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Make a PUT request with entity context.
 */
export async function apiPut<T = unknown>(
  path: string,
  body?: unknown
): Promise<T> {
  return apiRequest<T>(path, {
    method: "PUT",
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Make a DELETE request with entity context.
 */
export async function apiDelete<T = unknown>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: "DELETE" });
}
