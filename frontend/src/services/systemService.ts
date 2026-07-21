import { apiGet } from "@/services/apiClient";

export interface SystemSnapshot {
  environment: string;
  model: string;
  memory: string;
  database: string;
  vision: string;
  internet: string;
  tools: string;
}

export function getSystemSnapshot() {
  return apiGet<SystemSnapshot>("/system/snapshot");
}

