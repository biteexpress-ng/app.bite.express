import { describe, expect, it } from "vitest";
import { moduleEntry } from "./module-entry";

describe("moduleEntry", () => {
  it("sends the parcel module to /send, with no shop count", () => {
    expect(moduleEntry({ id: 6, module_type: "parcel", stores_count: 0 })).toEqual({
      href: "/send",
      subtitle: "Send a package across town",
      showCount: false,
    });
  });

  it("keeps shop modules on /browse/{id} with their count", () => {
    expect(moduleEntry({ id: 1, module_type: "food", stores_count: 12 })).toEqual({
      href: "/browse/1",
      subtitle: "Explore 12 shops",
      showCount: true,
    });
  });

  it("marks a shop module with no shops as coming soon", () => {
    expect(moduleEntry({ id: 2, module_type: "grocery", stores_count: 0 })).toEqual({
      href: "/browse/2",
      subtitle: "Coming soon",
      showCount: false,
    });
    expect(moduleEntry({ id: 3, module_type: "pharmacy" }).subtitle).toBe("Coming soon");
  });
});
