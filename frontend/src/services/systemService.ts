import { apiGet } from "@/services/apiClient";

export interface SystemSnapshot {
  environment: string;
  model: string;
  memory: string;
  database: string;
  vision: string;
  internet: string;
  tools: string;
  cpu_percent: number;
  cpu_cores: number;
  ram_percent: number;
  ram_used_bytes: number;
  ram_total_bytes: number;
  disk_percent: number;
  disk_used_bytes: number;
  disk_total_bytes: number;
  uptime_seconds: number;
  hostname: string;
  platform: string;
  gpu?: string | null;
}

export function getSystemSnapshot() {
  return apiGet<SystemSnapshot>("/system/snapshot");
}
