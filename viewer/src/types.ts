export interface IRNode {
  id: string;
  type: 'task' | 'decision' | 'start' | 'end' | 'parallel_split' | 'parallel_join';
  label: string;
  code_ref?: string;
  logic_type?: 'deterministic' | 'configurable' | 'probabilistic';
  description?: string;
  calls?: string[];
  span_name?: string | null;
  decision_point?: string | null;
  reason_codes?: string[];
  model?: string;
  confidence_range?: number[];
}

export interface IREdge {
  from: string;
  to: string;
  condition?: string;
  reason_code?: string;
}

export interface IRFlow {
  flow: string;
  version: number;
  title: string;
  description: string;
  service?: string;
  module?: string;
  status: string;
  nodes: IRNode[];
  edges: IREdge[];
  entry_point: string;
  exit_points: string[];
  estimated_duration_ms?: string;
  error_modes?: string[];
}
