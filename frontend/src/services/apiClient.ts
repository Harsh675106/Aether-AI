interface ImportMetaEnv {
  readonly VITE_AETHER_API_URL?: string;
}

interface ImportMetaWithEnv {
  readonly env: ImportMetaEnv;
}

const API_URL = (import.meta as unknown as ImportMetaWithEnv).env.VITE_AETHER_API_URL ?? "http://localhost:8001/api/v1";

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Aether API request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function apiDelete<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Aether API DELETE request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

