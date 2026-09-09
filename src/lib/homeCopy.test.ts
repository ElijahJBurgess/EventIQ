import { describe, expect, it } from "vitest";
import { companyColleagueNames, formatCompanyInRoom, dontLeaveWithoutMeetingHeading } from "./homeCopy";

describe("companyColleagueNames", () => {
  const others = [
    { full_name: "Alice Smith", company: "Acme Corp" },
    { full_name: "Bob Jones", company: "acme corp" },
    { full_name: "Carol White", company: "  ACME CORP " },
    { full_name: "Dave Black", company: "Other Inc" },
    { full_name: "Eve Green", company: null },
    { full_name: null, company: "Acme Corp" },
  ];

  it("matches company case-insensitively and trims whitespace", () => {
    expect(companyColleagueNames("acme corp", others)).toEqual(["Alice Smith", "Bob Jones", "Carol White"]);
  });

  it("returns nothing when the viewer's own company is blank", () => {
    expect(companyColleagueNames("", others)).toEqual([]);
    expect(companyColleagueNames("   ", others)).toEqual([]);
    expect(companyColleagueNames(null, others)).toEqual([]);
  });

  it("returns nothing when no other attendee shares the company", () => {
    expect(companyColleagueNames("Nobody LLC", others)).toEqual([]);
  });

  it("skips colleagues with no name", () => {
    expect(companyColleagueNames("Acme Corp", [{ full_name: null, company: "Acme Corp" }])).toEqual([]);
  });
});

describe("formatCompanyInRoom", () => {
  it("returns null when there are no colleague names", () => {
    expect(formatCompanyInRoom([], "Acme Corp")).toBeNull();
  });

  it("returns null when the company is blank", () => {
    expect(formatCompanyInRoom(["Alice Smith"], "  ")).toBeNull();
  });

  it("names the single colleague", () => {
    expect(formatCompanyInRoom(["Alice Smith"], "Acme Corp")).toBe("Alice Smith from Acme Corp is here");
  });

  it("counts multiple colleagues", () => {
    expect(formatCompanyInRoom(["Alice Smith", "Bob Jones"], "Acme Corp")).toBe("2 people from Acme Corp are here");
  });

  it("ignores blank names when counting", () => {
    expect(formatCompanyInRoom(["Alice Smith", "  ", ""], "Acme Corp")).toBe("Alice Smith from Acme Corp is here");
  });
});

describe("dontLeaveWithoutMeetingHeading", () => {
  it("personalizes to the one top match's name when there is exactly one", () => {
    expect(dontLeaveWithoutMeetingHeading([{ name: "Jordan Lee" }])).toBe("Don't Leave Without Meeting Jordan Lee");
  });

  it("stays generic when there are multiple top matches", () => {
    expect(dontLeaveWithoutMeetingHeading([{ name: "Jordan Lee" }, { name: "Taylor Smith" }])).toBe(
      "Don't Leave Without Meeting",
    );
  });

  it("stays generic when there are no top matches", () => {
    expect(dontLeaveWithoutMeetingHeading([])).toBe("Don't Leave Without Meeting");
  });

  it("stays generic when the single match has a blank name", () => {
    expect(dontLeaveWithoutMeetingHeading([{ name: "  " }])).toBe("Don't Leave Without Meeting");
  });
});
