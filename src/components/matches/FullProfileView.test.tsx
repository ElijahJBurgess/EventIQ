import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FullProfileView from "./FullProfileView";

const mocks = vi.hoisted(() => ({ fetchMatchDetail: vi.fn() }));

vi.mock("@/lib/matchDetail", () => ({
  fetchMatchDetail: mocks.fetchMatchDetail,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchMatchDetail.mockResolvedValue(null);
});
afterEach(cleanup);

describe("FullProfileView back navigation", () => {
  it("uses the My Day label and callback when opened from My Day", async () => {
    const onBack = vi.fn();
    render(<FullProfileView matchId="match-id" currentUserId="current-user" onBack={onBack} backLabel="Back to My Day" />);

    const back = await screen.findByRole("button", { name: "← Back to My Day" });
    fireEvent.click(back);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("preserves the existing People back label by default", async () => {
    render(<FullProfileView matchId="match-id" currentUserId="current-user" onBack={vi.fn()} />);
    expect(await screen.findByRole("button", { name: "← Back to Matches" })).toBeInTheDocument();
  });
});
