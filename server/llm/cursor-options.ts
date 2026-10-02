export type CursorAgentOptions = {
  apiKey: string;
  model: { id: string };
  tools: [];
  local: {
    cwd: string;
    settingSources: [];
  };
};

export function buildCursorAgentOptions(input: {
  apiKey: string;
  model: string;
  cwd: string;
}): CursorAgentOptions {
  return {
    apiKey: input.apiKey,
    model: { id: input.model },
    tools: [],
    local: {
      cwd: input.cwd,
      settingSources: [],
    },
  };
}
