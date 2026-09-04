import { describe, expect, it } from "vitest";
import { deleteAccount, type AccountDeletionPorts } from "./deletion.ts";

const USER_ID = "11111111-1111-4111-8111-111111111111";

interface Recorder {
  calls: string[];
  ports: AccountDeletionPorts;
}

interface Behaviour {
  countOrganizedEvents?: (id: string) => Promise<number>;
  clearGeneratedReports?: (id: string) => Promise<number>;
  deleteProfilePhotos?: (id: string) => Promise<number>;
  deleteAuthUser?: (id: string) => Promise<void>;
}

// Every port records its call before delegating to the supplied behaviour, so
// overriding a port's return value never drops it from the call log.
function recorder(behaviour: Behaviour = {}): Recorder {
  const calls: string[] = [];
  const record = <T>(name: string, fn: (id: string) => Promise<T>) => async (id: string): Promise<T> => {
    calls.push(`${name}:${id}`);
    return fn(id);
  };
  const ports: AccountDeletionPorts = {
    countOrganizedEvents: record("countOrganizedEvents", behaviour.countOrganizedEvents ?? (async () => 0)),
    clearGeneratedReports: record("clearGeneratedReports", behaviour.clearGeneratedReports ?? (async () => 0)),
    deleteProfilePhotos: record("deleteProfilePhotos", behaviour.deleteProfilePhotos ?? (async () => 0)),
    deleteAuthUser: record("deleteAuthUser", behaviour.deleteAuthUser ?? (async () => {})),
  };
  return { calls, ports };
}

describe("deleteAccount", () => {
  it("blocks deletion when the user organizes any event and touches nothing else", async () => {
    const { calls, ports } = recorder({ countOrganizedEvents: async () => 2 });

    const result = await deleteAccount(USER_ID, ports);

    expect(result).toEqual({ status: "blocked_organizer", organizedEventCount: 2 });
    expect(calls).toEqual([`countOrganizedEvents:${USER_ID}`]);
  });

  it("clears report FKs and profile photos before deleting the auth user, in that order", async () => {
    const { calls, ports } = recorder();

    const result = await deleteAccount(USER_ID, ports);

    expect(calls).toEqual([
      `countOrganizedEvents:${USER_ID}`,
      `clearGeneratedReports:${USER_ID}`,
      `deleteProfilePhotos:${USER_ID}`,
      `deleteAuthUser:${USER_ID}`,
    ]);
    expect(result).toEqual({ status: "deleted", clearedReports: 0, deletedPhotos: 0 });
  });

  it("surfaces the counts returned by the ports", async () => {
    const { ports } = recorder({
      clearGeneratedReports: async () => 3,
      deleteProfilePhotos: async () => 1,
    });

    const result = await deleteAccount(USER_ID, ports);

    expect(result).toEqual({ status: "deleted", clearedReports: 3, deletedPhotos: 1 });
  });

  it("never deletes the auth user if an earlier cleanup step fails", async () => {
    const { calls, ports } = recorder({
      clearGeneratedReports: async () => {
        throw new Error("reports update failed");
      },
    });

    await expect(deleteAccount(USER_ID, ports)).rejects.toThrow("reports update failed");
    expect(calls).toEqual([`countOrganizedEvents:${USER_ID}`, `clearGeneratedReports:${USER_ID}`]);
  });
});
