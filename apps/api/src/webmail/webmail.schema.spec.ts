import { describe, expect, it } from "vitest";
import { MoveRequest, UnlockRequest } from "./webmail.service";

describe("MoveRequest / UnlockRequest", () => {
  it("requires a non-empty destination", () => {
    expect(MoveRequest.safeParse({ destination: "" }).success).toBe(false);
    expect(MoveRequest.parse({ destination: "Archive" }).destination).toBe(
      "Archive",
    );
  });

  it("requires a non-empty password within bounds", () => {
    expect(UnlockRequest.safeParse({ password: "" }).success).toBe(false);
    expect(UnlockRequest.parse({ password: "s3cret" }).password).toBe("s3cret");
  });
});
