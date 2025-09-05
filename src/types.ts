export type ToolIO<I, O> = {
  name: string;
  description: string;
  inputSchema: object;
  handler: (input: I) => Promise<O>;
};

export type AnalysisReport = {
  summary: string;
  complexityGuess?: string;
  issues: string[];
  hotspots: string[];
  next_steps: string[];
};

export type AlgorithmProposal = {
  problem: string;
  candidates: Array<{
    name: string;
    idea: string;
    complexity: { time: string; space: string };
    when_to_use: string;
    templateId: string;
  }>;
  summary: string;
  next_steps: string[];
};
