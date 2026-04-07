export const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export type Dataset = {
  id: string;
  name: string;
  status: string;
  rows?: number;
  columns?: number;
  health_score: number;
  created_at: string;
};

export type Report = {
  dataset_id?: string;
  dataset_name?: string;
  health_score: number;
  missing_pct: number;
  missing_cells?: number;
  duplicate_rows: number;
  outlier_count: number;
  total_rows: number;
  total_columns: number;
  bias_flags: string[];
  recommendations: string[];
  completeness_score?: number;
  consistency_score?: number;
  noise_score?: number;
  columns?: Array<{
    name: string;
    dtype?: string;
    missing_pct?: number;
    unique_count?: number;
    mean?: number;
    std?: number;
    min?: number;
    max?: number;
    outlier_pct?: number;
    top_values?: Record<string, number>;
  }>;
  correlations?: Array<{
    col1: string;
    col2: string;
    value: number;
  }>;
  [key: string]: unknown;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  sources?: string[];
};

export type AlgoRecommendation = {
  name: string;
  score: number;
  category?: string;
  complexity?: "low" | "medium" | "high" | string;
  reason: string;
  pros: string[];
  cons: string[];
  rank?: number;
  suitability_score?: number;
  [key: string]: unknown;
};

type ApiResult<T> = {
  data: T | null;
  error: string | null;
};

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
  };
}

async function parseJsonSafe<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export const datasetsAPI = {
  async list(token: string): Promise<{ data: Dataset[]; error: string | null }> {
    try {
      const res = await fetch(`${API_BASE}/api/datasets`, {
        method: "GET",
        headers: {
          ...authHeaders(token),
        },
      });

      if (!res.ok) {
        const err = await parseJsonSafe<{ detail?: string }>(res);
        return { data: [], error: err?.detail || `Request failed (${res.status})` };
      }

      const data = (await res.json()) as Dataset[];
      return { data, error: null };
    } catch (err) {
      return { data: [], error: (err as Error).message };
    }
  },

  async getReport(id: string, token: string): Promise<ApiResult<Report>> {
    try {
      const res = await fetch(`${API_BASE}/api/datasets/${id}/report`, {
        method: "GET",
        headers: {
          ...authHeaders(token),
        },
      });

      if (!res.ok) {
        const err = await parseJsonSafe<{ detail?: string }>(res);
        return { data: null, error: err?.detail || `Request failed (${res.status})` };
      }

      const data = (await res.json()) as Report;
      return { data, error: null };
    } catch (err) {
      return { data: null, error: (err as Error).message };
    }
  },

  async upload(file: File, token: string): Promise<ApiResult<{ id: string }>> {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE}/api/datasets/upload`, {
        method: "POST",
        headers: {
          ...authHeaders(token),
        },
        body: formData,
      });

      if (!res.ok) {
        const err = await parseJsonSafe<{ detail?: string }>(res);
        return { data: null, error: err?.detail || `Request failed (${res.status})` };
      }

      const data = (await res.json()) as { id: string };
      return { data: { id: data.id }, error: null };
    } catch (err) {
      return { data: null, error: (err as Error).message };
    }
  },

  async chat(id: string, question: string, token: string): Promise<ApiResult<{ answer: string; sources: string[] }>> {
    try {
      const res = await fetch(`${API_BASE}/api/datasets/${id}/chat`, {
        method: "POST",
        headers: {
          ...authHeaders(token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question }),
      });

      if (!res.ok) {
        const err = await parseJsonSafe<{ detail?: string }>(res);
        return { data: null, error: err?.detail || `Request failed (${res.status})` };
      }

      const data = (await res.json()) as { answer: string; sources: string[] };
      return { data, error: null };
    } catch (err) {
      return { data: null, error: (err as Error).message };
    }
  },

  async getChatHistory(id: string, token: string): Promise<{ data: ChatMessage[]; error: string | null }> {
    try {
      const res = await fetch(`${API_BASE}/api/datasets/${id}/chat/history`, {
        method: "GET",
        headers: {
          ...authHeaders(token),
        },
      });

      if (!res.ok) {
        const err = await parseJsonSafe<{ detail?: string }>(res);
        return { data: [], error: err?.detail || `Request failed (${res.status})` };
      }

      const data = (await res.json()) as ChatMessage[];
      return { data, error: null };
    } catch (err) {
      return { data: [], error: (err as Error).message };
    }
  },

  async getAlgoRecommendations(id: string, token: string): Promise<{ data: AlgoRecommendation[]; error: string | null }> {
    try {
      const res = await fetch(`${API_BASE}/api/datasets/${id}/recommendations`, {
        method: "GET",
        headers: {
          ...authHeaders(token),
        },
      });

      if (!res.ok) {
        const err = await parseJsonSafe<{ detail?: string }>(res);
        return { data: [], error: err?.detail || `Request failed (${res.status})` };
      }

      const data = (await res.json()) as AlgoRecommendation[];
      return { data, error: null };
    } catch (err) {
      return { data: [], error: (err as Error).message };
    }
  },

  async exportPdf(id: string, token: string): Promise<ApiResult<{ file_id: string }>> {
    try {
      const res = await fetch(`${API_BASE}/api/datasets/${id}/export/pdf`, {
        method: "POST",
        headers: {
          ...authHeaders(token),
        },
      });

      if (!res.ok) {
        const err = await parseJsonSafe<{ detail?: string }>(res);
        return { data: null, error: err?.detail || `Request failed (${res.status})` };
      }

      const data = (await res.json()) as { file_id: string };
      return { data, error: null };
    } catch (err) {
      return { data: null, error: (err as Error).message };
    }
  },

  downloadUrl(file_id: string, token: string): string {
    return `${API_BASE}/api/export/download/${file_id}?token=${token}`;
  },

  async delete(id: string, token: string): Promise<{ error: string | null }> {
    try {
      const res = await fetch(`${API_BASE}/api/datasets/${id}`, {
        method: "DELETE",
        headers: {
          ...authHeaders(token),
        },
      });

      if (!res.ok) {
        const err = await parseJsonSafe<{ detail?: string }>(res);
        return { error: err?.detail || `Request failed (${res.status})` };
      }

      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },
};
