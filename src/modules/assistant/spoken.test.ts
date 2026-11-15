import { describe, expect, it } from "vitest";
import { spokenToCommand } from "./spoken";

describe("spokenToCommand", () => {
  it("keeps typed-style commands", () => {
    expect(spokenToCommand("Find ibuprofen.")).toBe("find ibuprofen");
    expect(spokenToCommand("help")).toBe("help");
  });

  it("maps natural phrasing to commands", () => {
    expect(spokenToCommand("Where is the ibuprofen?")).toBe("find ibuprofen");
    expect(spokenToCommand("Do we have any bandages")).toBe("find bandages");
    expect(spokenToCommand("Explain my alerts please")).toBe("alerts");
    expect(spokenToCommand("What should I take")).toBe("suggest");
    expect(spokenToCommand("What can you do?")).toBe("help");
  });

  it("returns empty for silence", () => {
    expect(spokenToCommand("  ...  ")).toBe("");
  });
});
