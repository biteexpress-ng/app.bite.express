import { describe, expect, it } from "vitest";
import { activeTab, homeHref, showTabBar } from "./tab-bar";

describe("showTabBar", () => {
  it("is false on checkout and everything under it", () => {
    expect(showTabBar("/checkout")).toBe(false);
    expect(showTabBar("/checkout/success")).toBe(false);
    expect(showTabBar("/checkout/offline")).toBe(false);
    expect(showTabBar("/checkout/transfer")).toBe(false);
  });

  it("is false on the auth pages", () => {
    expect(showTabBar("/signin")).toBe(false);
    expect(showTabBar("/signup")).toBe(false);
  });

  it("is true elsewhere", () => {
    expect(showTabBar("/")).toBe(true);
    expect(showTabBar("/browse")).toBe(true);
    expect(showTabBar("/store/12")).toBe(true);
    expect(showTabBar("/cart")).toBe(true);
    expect(showTabBar("/orders")).toBe(true);
    expect(showTabBar("/orders/9")).toBe(true);
    expect(showTabBar("/profile")).toBe(true);
    expect(showTabBar("/wallet")).toBe(true);
    expect(showTabBar("/notifications")).toBe(true);
  });

  it("does not false-positive on a route that merely starts with the same letters", () => {
    expect(showTabBar("/checkout-history")).toBe(true);
    expect(showTabBar("/signing-up")).toBe(true);
  });
});

describe("activeTab", () => {
  it("matches home for /, /browse and /store", () => {
    expect(activeTab("/")).toBe("home");
    expect(activeTab("/browse")).toBe("home");
    expect(activeTab("/browse/3")).toBe("home");
    expect(activeTab("/store/12")).toBe("home");
  });

  it("matches cart only for /cart", () => {
    expect(activeTab("/cart")).toBe("cart");
  });

  it("matches orders for /orders and nested order pages", () => {
    expect(activeTab("/orders")).toBe("orders");
    expect(activeTab("/orders/9")).toBe("orders");
  });

  it("matches profile for /profile and nested profile pages", () => {
    expect(activeTab("/profile")).toBe("profile");
    expect(activeTab("/profile/edit")).toBe("profile");
    expect(activeTab("/profile/password")).toBe("profile");
  });

  it("is null for routes with no tab, such as wallet and notifications", () => {
    expect(activeTab("/wallet")).toBeNull();
    expect(activeTab("/notifications")).toBeNull();
    expect(activeTab("/addresses")).toBeNull();
    expect(activeTab("/wishlist")).toBeNull();
  });

  it("does not false-positive on a route that merely starts with the same letters", () => {
    expect(activeTab("/carts-are-fun")).toBeNull();
    expect(activeTab("/profiles")).toBeNull();
  });
});

describe("homeHref", () => {
  it("goes to /browse once a delivery location is set", () => {
    expect(homeHref(true)).toBe("/browse");
  });

  it("goes to / when there is no delivery location yet", () => {
    expect(homeHref(false)).toBe("/");
  });
});
