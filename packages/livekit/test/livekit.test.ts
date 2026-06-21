import { describe, it, expect, vi } from "vitest";
import { TenetLLM } from "../src/index.js";

function mockLLM() {
  return {
    chat: vi.fn().mockResolvedValue("response"),
    _client: { _fetch: globalThis.fetch, baseURL: "https://api.openai.com/v1" },
  };
}

describe("TenetLLM", () => {
  it("stores config", () => {
    const inner = mockLLM();
    const llm = new TenetLLM({ tenetKey: "tk_xxx", llm: inner });
    expect(llm.tenetKey).toBe("tk_xxx");
  });

  it("delegates chat to inner LLM", async () => {
    const inner = mockLLM();
    const llm = new TenetLLM({ tenetKey: "tk_xxx", llm: inner });
    await llm.chat({ chatCtx: "ctx" });
    expect(inner.chat).toHaveBeenCalledWith({ chatCtx: "ctx" });
  });

  it("sets caller ID from participant", () => {
    const inner = mockLLM();
    const llm = new TenetLLM({ tenetKey: "tk_xxx", llm: inner });
    llm.setParticipant({ identity: "caller_456" });
    expect(llm.callerId).toBe("caller_456");
  });

  it("sets room metadata", () => {
    const inner = mockLLM();
    const llm = new TenetLLM({ tenetKey: "tk_xxx", llm: inner });
    llm.setRoom({ name: "test-room", sid: "RM_abc" });
    expect(llm.roomName).toBe("test-room");
    expect(llm.roomSid).toBe("RM_abc");
  });
});
