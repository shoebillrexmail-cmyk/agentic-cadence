/**
 * Pipeline resilience — error recovery, model fallback, crash handling,
 * and human-in-the-loop escalation.
 */

// ── Transient Error Patterns ──────────────────────────

const TRANSIENT_PATTERNS = [
  /rate.?limit/i,
  /429/,
  /timeout/i,
  /timed?\s*out/i,
  /ETIMEDOUT/,
  /ECONNRESET/,
  /ECONNREFUSED/,
  /50[0-9]/,
  /server error/i,
  /overloaded/i,
  /busy/i,
  /capacity/i,
  /try again/i,
  /temporarily/i,
];

// ── isTransientError ──────────────────────────────────

/**
 * Check if an error message indicates a transient (retryable) failure.
 * @param {string} errorMessage
 * @returns {boolean}
 */
export function isTransientError(errorMessage) {
  if (!errorMessage) return false;
  return TRANSIENT_PATTERNS.some((pattern) => pattern.test(errorMessage));
}

// ── resolveModelFallback ──────────────────────────────

/**
 * Pick the next model from the fallback chain.
 * Skips models that have already been tried.
 * @param {{worker_model: string, fallback_models?: string[], tried_models?: string[]}} config
 * @param {string} currentModel
 * @returns {string|null} Next model, or null if exhausted
 */
export function resolveModelFallback(config, currentModel) {
  const tried = new Set(config.tried_models || [currentModel]);
  const candidates = [config.worker_model, ...(config.fallback_models || [])];

  for (const model of candidates) {
    if (!tried.has(model)) return model;
  }

  return null;
}

// ── shouldPausePipeline ───────────────────────────────

/**
 * Check if the pipeline should pause based on consecutive failures.
 * @param {{name: string, exitCode: number}[]} results
 * @param {number} threshold — consecutive failures to trigger pause (default 2)
 * @returns {boolean}
 */
export function shouldPausePipeline(results, threshold = 2) {
  let consecutive = 0;
  for (const r of results) {
    if (r.exitCode !== 0) {
      consecutive++;
      if (consecutive >= threshold) return true;
    } else {
      consecutive = 0;
    }
  }
  return false;
}

// ── escalateToUser ────────────────────────────────────

/**
 * Format an escalation message for human intervention.
 * @param {{storyName: string, reason: string, findings?: string[], options?: string[]}} opts
 * @returns {string}
 */
export function escalateToUser({ storyName, reason, findings = [], options = [] }) {
  const lines = [
    `## Pipeline Paused: Human Intervention Required`,
    "",
    `**Story**: STORY-${storyName}`,
    `**Reason**: ${reason}`,
  ];

  if (findings.length > 0) {
    lines.push("", "### Findings");
    for (const f of findings) {
      lines.push(`- ${f}`);
    }
  }

  if (options.length > 0) {
    lines.push("", "### Options");
    for (let i = 0; i < options.length; i++) {
      lines.push(`${i + 1}. ${options[i]}`);
    }
  }

  lines.push("", "_Waiting for your decision..._");
  return lines.join("\n");
}
