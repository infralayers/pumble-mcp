import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EnvironmentFSM } from "../../src/guardrails/environmentFSM.js";

describe("EnvironmentFSM", () => {
  let fsm: EnvironmentFSM;

  beforeEach(() => {
    vi.useFakeTimers();
    fsm = new EnvironmentFSM(3000, 60000);
  });

  afterEach(() => {
    fsm.clear();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("starts in HEALTHY state with action and info tools allowed", () => {
    expect(fsm.getState()).toBe("HEALTHY");

    const actionAccess = fsm.checkToolAccess("send_message_via_channel_name_or_id");
    expect(actionAccess.allowed).toBe(true);

    const infoAccess = fsm.checkToolAccess("get_my_info");
    expect(infoAccess.allowed).toBe(true);

    const channelDetailAccess = fsm.checkToolAccess("get_channel_detail_via_channel_name_or_id");
    expect(channelDetailAccess.allowed).toBe(true);
    expect(fsm.getCategory("get_channel_detail_via_channel_name_or_id")).toBe("INFO");
  });

  it("requires an AUTH token for destructive tools in HEALTHY state", () => {
    const access = fsm.checkToolAccess("remove_user_from_channel_via_name_or_id");
    expect(access.allowed).toBe(false);
    expect(access.requiredConfirmationToken).toMatch(/^AUTH-\d{4}$/);
    expect(access.errorMessage).toContain("SECURITY GATE: DESTRUCTIVE WORKSPACE ACTION INTERCEPTED");

    // Passing the valid token permits execution and burns the token
    const token = access.requiredConfirmationToken;
    const authorizedAccess = fsm.checkToolAccess("remove_user_from_channel_via_name_or_id", token);
    expect(authorizedAccess.allowed).toBe(true);

    // Reusing the same token fails
    const replayedAccess = fsm.checkToolAccess("remove_user_from_channel_via_name_or_id", token);
    expect(replayedAccess.allowed).toBe(false);

    // delete_message is also protected as a destructive tool
    const deleteMessageAccess = fsm.checkToolAccess("delete_message");
    expect(deleteMessageAccess.allowed).toBe(false);
    expect(deleteMessageAccess.requiredConfirmationToken).toMatch(/^AUTH-\d{4}$/);
    expect(deleteMessageAccess.errorMessage).toContain("SECURITY GATE: DESTRUCTIVE WORKSPACE ACTION INTERCEPTED");
  });

  it("trips to LOCKED when a resolution error occurs", () => {
    fsm.reportResolutionError("add_users_to_channel_via_name_or_id", "User 'GhostUser' not found");
    expect(fsm.getState()).toBe("LOCKED");
    expect(fsm.getLastFailedTool()).toBe("add_users_to_channel_via_name_or_id");
    expect(fsm.getLastFailureReason()).toBe("User 'GhostUser' not found");

    // The failed tool is blocked
    const failedAccess = fsm.checkToolAccess("add_users_to_channel_via_name_or_id");
    expect(failedAccess.allowed).toBe(false);
    expect(failedAccess.errorMessage).toContain("CIRCUIT BREAKER [LOCKED]");
    expect(failedAccess.errorMessage).not.toMatch(/\b3\b|\b30\b|cooldown/i);

    // All investigation tools are blocked
    const searchAccess = fsm.checkToolAccess("search_messages");
    expect(searchAccess.allowed).toBe(false);
    expect(searchAccess.errorMessage).toContain("CIRCUIT BREAKER [LOCKED]");

    const listMessagesAccess = fsm.checkToolAccess("list_messages_via_channel_name_or_id");
    expect(listMessagesAccess.allowed).toBe(false);

    // All bulk read tools are blocked
    const listUsersAccess = fsm.checkToolAccess("list_users_not_for_id_lookup");
    expect(listUsersAccess.allowed).toBe(false);

    // Unrelated action tools remain open
    const independentAccess = fsm.checkToolAccess("send_message_via_channel_name_or_id");
    expect(independentAccess.allowed).toBe(true);
  });

  it("transitions from LOCKED to HALF_OPEN after 3 seconds", () => {
    fsm.reportResolutionError("add_users_to_channel_via_name_or_id", "User 'GhostUser' not found");
    expect(fsm.getState()).toBe("LOCKED");

    vi.advanceTimersByTime(2999);
    expect(fsm.getState()).toBe("LOCKED");

    vi.advanceTimersByTime(1);
    expect(fsm.getState()).toBe("HALF_OPEN");
  });

  it("intercepts the first call in HALF_OPEN with pre-execution warning and allows the second call", () => {
    fsm.reportResolutionError("add_users_to_channel_via_name_or_id", "User 'GhostUser' not found");
    vi.advanceTimersByTime(3000);
    expect(fsm.getState()).toBe("HALF_OPEN");

    // Call 1: Intercepted with warning gate
    const call1 = fsm.checkToolAccess("add_users_to_channel_via_name_or_id");
    expect(call1.allowed).toBe(false);
    expect(call1.errorMessage).toContain("GUARDRAIL [PRE-EXECUTION CHECKPOINT]");

    // Call 2: Acknowledged! Allowed to proceed
    const call2 = fsm.checkToolAccess("add_users_to_channel_via_name_or_id");
    expect(call2.allowed).toBe(true);
  });

  it("self-heals back to HEALTHY when any mutating tool succeeds", () => {
    fsm.reportResolutionError("add_users_to_channel_via_name_or_id", "User 'GhostUser' not found");
    expect(fsm.getState()).toBe("LOCKED");

    // A mutating action succeeds
    fsm.reportSuccess("send_message_via_channel_name_or_id");
    expect(fsm.getState()).toBe("HEALTHY");

    // Action tools are allowed directly
    const actionAccess = fsm.checkToolAccess("send_message_via_channel_name_or_id");
    expect(actionAccess.allowed).toBe(true);

    // Investigation tools require acknowledgment checkpoint
    const searchAccess1 = fsm.checkToolAccess("search_messages");
    expect(searchAccess1.allowed).toBe(false);
    expect(searchAccess1.errorMessage).toContain("GUARDRAIL [PRE-EXECUTION CHECKPOINT]");

    const searchAccess2 = fsm.checkToolAccess("search_messages");
    expect(searchAccess2.allowed).toBe(true);
  });

  it("guards investigation and bulk read tools with initial airlock checkpoint in HEALTHY state", () => {
    expect(fsm.getState()).toBe("HEALTHY");

    // Call 1: Intercepted with initial airlock warning
    const call1 = fsm.checkToolAccess("search_messages");
    expect(call1.allowed).toBe(false);
    expect(call1.errorMessage).toContain("Tool 'search_messages' is a guarded investigation/directory tool.");
    expect(call1.errorMessage).toContain("All action tools (sendMessage, sendDm, sendGroupDm, addUsersToChannel, etc.) natively and automatically resolve names, emails, and channels for you.");
    expect(call1.errorMessage).not.toContain("proceed by calling the tool again");

    // Call 2: Permitted
    const call2 = fsm.checkToolAccess("search_messages");
    expect(call2.allowed).toBe(true);

    // Bulk read tool also guarded initially
    const bulkCall1 = fsm.checkToolAccess("list_users_not_for_id_lookup");
    expect(bulkCall1.allowed).toBe(false);
    expect(bulkCall1.errorMessage).toContain("Tool 'list_users_not_for_id_lookup' is a guarded investigation/directory tool.");

    const bulkCall2 = fsm.checkToolAccess("list_users_not_for_id_lookup");
    expect(bulkCall2.allowed).toBe(true);
  });

  it("silently expires from HALF_OPEN back to HEALTHY after 60 seconds", () => {
    fsm.reportResolutionError("add_users_to_channel_via_name_or_id", "User 'GhostUser' not found");
    vi.advanceTimersByTime(3000);
    expect(fsm.getState()).toBe("HALF_OPEN");

    vi.advanceTimersByTime(59999);
    expect(fsm.getState()).toBe("HALF_OPEN");

    vi.advanceTimersByTime(1);
    expect(fsm.getState()).toBe("HEALTHY");
  });
});
