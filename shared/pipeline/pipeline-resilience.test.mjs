import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isTransientError,
  resolveModelFallback,
  shouldPausePipeline,
  escalateToUser,
} from "./pipeline-resilience.mjs";

describe("pipeline-resilience", () => {
  // ── isTransientError ────────────────────────────────
  describe("isTransientError()", () => {
    it("should detect rate limit errors", () => {
      assert.ok(isTransientError("Error: rate limit exceeded"));
      assert.ok(isTransientError("429 Too Many Requests"));
    });

    it("should detect timeout errors", () => {
      assert.ok(isTransientError("ETIMEDOUT"));
      assert.ok(isTransientError("request timeout"));
    });

    it("should detect 5xx errors", () => {
      assert.ok(isTransientError("500 Internal Server Error"));
      assert.ok(isTransientError("502 Bad Gateway"));
      assert.ok(isTransientError("503 Service Unavailable"));
    });

    it("should detect overloaded errors", () => {
      assert.ok(isTransientError("model is overloaded"));
      assert.ok(isTransientError("server is currently busy"));
    });

    it("should NOT flag non-transient errors", () => {
      assert.ok(!isTransientError("SyntaxError: unexpected token"));
      assert.ok(!isTransientError("Module not found"));
      assert.ok(!isTransientError("Permission denied"));
    });
  });

  // ── resolveModelFallback ────────────────────────────
  describe("resolveModelFallback()", () => {
    it("should return next model from fallback chain", () => {
      const config = {
        worker_model: "deepseek/deepseek-r1",
        fallback_models: ["huggingface/qwen-2.5-coder", "deepseek/deepseek-chat"],
      };

      const result = resolveModelFallback(config, "deepseek/deepseek-r1");
      assert.equal(result, "huggingface/qwen-2.5-coder");
    });

    it("should return second fallback when first was tried", () => {
      const config = {
        worker_model: "deepseek/deepseek-r1",
        fallback_models: ["huggingface/qwen-2.5-coder", "deepseek/deepseek-chat"],
        tried_models: ["deepseek/deepseek-r1", "huggingface/qwen-2.5-coder"],
      };

      const result = resolveModelFallback(config, "deepseek/deepseek-r1");
      assert.equal(result, "deepseek/deepseek-chat");
    });

    it("should return null when all models exhausted", () => {
      const config = {
        worker_model: "deepseek/deepseek-r1",
        fallback_models: ["huggingface/qwen-2.5-coder"],
        tried_models: ["deepseek/deepseek-r1", "huggingface/qwen-2.5-coder"],
      };

      const result = resolveModelFallback(config, "deepseek/deepseek-r1");
      assert.equal(result, null);
    });

    it("should return null when no fallbacks configured", () => {
      const config = { worker_model: "deepseek/deepseek-r1" };
      const result = resolveModelFallback(config, "deepseek/deepseek-r1");
      assert.equal(result, null);
    });
  });

  // ── shouldPausePipeline ─────────────────────────────
  describe("shouldPausePipeline()", () => {
    it("should pause on 2+ consecutive failures", () => {
      const results = [
        { name: "a", exitCode: 0 },
        { name: "b", exitCode: 1 },
        { name: "c", exitCode: 1 },
      ];
      assert.ok(shouldPausePipeline(results, 2));
    });

    it("should NOT pause with only 1 failure", () => {
      const results = [
        { name: "a", exitCode: 0 },
        { name: "b", exitCode: 1 },
        { name: "c", exitCode: 0 },
      ];
      assert.ok(!shouldPausePipeline(results, 2));
    });

    it("should NOT pause when all pass", () => {
      const results = [
        { name: "a", exitCode: 0 },
        { name: "b", exitCode: 0 },
      ];
      assert.ok(!shouldPausePipeline(results, 2));
    });
  });

  // ── escalateToUser ──────────────────────────────────
  describe("escalateToUser()", () => {
    it("should format escalation message with findings", () => {
      const msg = escalateToUser({
        storyName: "my-feature",
        reason: "Review failed 3 cycles with CRITICAL findings",
        findings: ["Security: eval() usage detected", "Performance: N+1 query pattern"],
        options: ["Retry with different model", "Skip story", "Abort pipeline"],
      });

      assert.ok(msg.includes("my-feature"));
      assert.ok(msg.includes("CRITICAL"));
      assert.ok(msg.includes("eval()"));
      assert.ok(msg.includes("Retry"));
      assert.ok(msg.includes("Skip"));
      assert.ok(msg.includes("Abort"));
    });
  });
});
