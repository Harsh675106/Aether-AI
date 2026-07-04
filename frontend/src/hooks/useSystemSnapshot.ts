import { useQuery } from "@tanstack/react-query";
import { getSystemSnapshot } from "@/services/systemService";

export function useSystemSnapshot() {
  return useQuery({
    queryKey: ["system-snapshot"],
    queryFn: getSystemSnapshot,
  });
}

