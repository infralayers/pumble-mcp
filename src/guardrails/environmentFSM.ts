export type CircuitState = "HEALTHY" | "LOCKED" | "HALF_OPEN";

export type ToolCategory =
  | "ACTION"
  | "DESTRUCTIVE"
  | "INVESTIGATION"
  | "BULK_READ"
  | "INFO";

export interface ToolAccessResult {
  allowed: boolean;
  errorMessage?: string;
  requiredConfirmationToken?: string;
}

// === MODULE-LEVEL STATE ===
let circuitState: CircuitState = "HEALTHY";
let lastFailedTool: string | null = null;
let lastFailureReason: string = "";

let lockDurationMs: number = 3_000;
let probationDurationMs: number = 60_000;

let lockTimeout: NodeJS.Timeout | null = null;
let probationTimeout: NodeJS.Timeout | null = null;

// Airlock probation tracker: tracks which tool received the warning in HALF_OPEN or initial airlock
let acknowledgedInProbation: string | null = null;

// One-time security tokens for destructive operations
const activeChallenges: Map<string, { token: string; expiresAt: number }> = new Map();

// === 26-TOOL COMPREHENSIVE TAXONOMY ===
export const INVESTIGATION_TOOLS = new Set([
  "search_messages",
  "list_messages_via_name_or_id",
  "list_messages_via_channel_name_or_id",
  "list_thread_replies_via_channel_name_or_id",
  "list_user_groups",
]);

export const BULK_READ_TOOLS = new Set([
  "list_channels_only_when_user_calls",
  "list_users_not_for_id_lookup",
]);

export const DESTRUCTIVE_TOOLS = new Set([
  "remove_user_from_channel_via_name_or_id",
  "delete_scheduled_message_via_name_or_id",
  "delete_message",
]);

export const ACTION_TOOLS = new Set([
  "send_message_via_channel_name_or_id",
  "reply_message_via_channel_name_or_id",
  "edit_message",
  "send_dm_via_name_email_or_id",
  "send_group_dm_via_names_emails_or_ids",
  "create_channel",
  "add_users_to_channel_via_name_or_id",
  "add_reaction",
  "remove_reaction",
  "update_my_custom_status",
  "create_scheduled_message_via_name_or_id",
  "edit_scheduled_message_via_name_or_id",
]);

export const INFO_TOOLS = new Set([
  "get_my_info",
  "get_channel_detail_via_channel_name_or_id",
  "get_scheduled_message_via_name_or_id",
  "list_scheduled_messages",
  "get_message_via_id",
]);

export const MUTATING_TOOLS = new Set([
  ...ACTION_TOOLS,
  ...DESTRUCTIVE_TOOLS,
]);

export function getCircuitState(): CircuitState {
  return circuitState;
}

export function getLastFailedTool(): string | null {
  return lastFailedTool;
}

export function getLastFailureReason(): string {
  return lastFailureReason;
}

export function setFSMDurations(lockMs: number, probationMs: number): void {
  lockDurationMs = lockMs;
  probationDurationMs = probationMs;
}

export function getToolCategory(toolName: string): ToolCategory {
  if (
    DESTRUCTIVE_TOOLS.has(toolName) ||
    toolName.includes("remove_user") ||
    toolName.includes("delete_scheduled") ||
    toolName.includes("delete_message")
  ) {
    return "DESTRUCTIVE";
  }
  if (
    BULK_READ_TOOLS.has(toolName) ||
    toolName.includes("list_channels") ||
    toolName.includes("list_users")
  ) {
    return "BULK_READ";
  }
  if (
    INVESTIGATION_TOOLS.has(toolName) ||
    toolName.includes("search_messages") ||
    toolName.includes("list_messages") ||
    toolName.includes("list_thread_replies") ||
    toolName.includes("list_user_groups")
  ) {
    return "INVESTIGATION";
  }
  if (
    ACTION_TOOLS.has(toolName) ||
    toolName.includes("send_message") ||
    toolName.includes("reply_message") ||
    toolName.includes("edit_message") ||
    toolName.includes("send_dm") ||
    toolName.includes("send_group_dm") ||
    toolName.includes("create_channel") ||
    toolName.includes("add_users") ||
    toolName.includes("add_reaction") ||
    toolName.includes("remove_reaction") ||
    toolName.includes("update_my_custom_status") ||
    toolName.includes("create_scheduled") ||
    toolName.includes("edit_scheduled")
  ) {
    return "ACTION";
  }
  return "INFO";
}

function transitionToHalfOpen(): void {
  circuitState = "HALF_OPEN";
  acknowledgedInProbation = null;

  if (probationTimeout) clearTimeout(probationTimeout);

  probationTimeout = setTimeout(() => {
    resetCircuitToHealthy();
  }, probationDurationMs);
  probationTimeout.unref();
}

/**
 * Called when an Entity Resolution or domain action failure occurs.
 * Trips the failed tool, all investigation tools, and bulk read tools into LOCKED for 3s.
 */
export function reportResolutionError(toolName: string, reason: string): void {
  lastFailedTool = toolName;
  lastFailureReason = reason;
  circuitState = "LOCKED";
  acknowledgedInProbation = null;

  if (lockTimeout) clearTimeout(lockTimeout);
  if (probationTimeout) clearTimeout(probationTimeout);

  lockTimeout = setTimeout(() => {
    transitionToHalfOpen();
  }, lockDurationMs);
  lockTimeout.unref();
}

/**
 * Called when any mutating tool completes successfully.
 * Self-healing: instantly restores the entire circuit to HEALTHY.
 */
export function reportSuccess(toolName: string): void {
  const category = getToolCategory(toolName);
  if (
    category === "ACTION" ||
    category === "DESTRUCTIVE" ||
    MUTATING_TOOLS.has(toolName)
  ) {
    resetCircuitToHealthy();
  }
}

/**
 * Evaluates tool accessibility based on current state and safety policies.
 */
export function checkToolAccess(toolName: string, providedToken?: string): ToolAccessResult {
  const category = getToolCategory(toolName);
  const now = Date.now();

  // 1. STATE: LOCKED (Fast-Fail 3s Window)
  if (circuitState === "LOCKED") {
    const isRestrictedInLock =
      toolName === lastFailedTool ||
      category === "INVESTIGATION" ||
      category === "BULK_READ";

    if (isRestrictedInLock) {
      return {
        allowed: false,
        errorMessage:
          `CIRCUIT BREAKER [LOCKED]: Tool '${toolName}' execution restricted.\n` +
          `Recent Failure: "${lastFailureReason}"\n\n` +
          `OPERATIONAL DIRECTIVE:\n` +
          `- All action tools natively resolve channel names, user names, handles, and emails without directory lookups.\n` +
          `- Do not execute exploratory lookups or probing queries to recover from this failure.\n` +
          `- Report the exact failure reason above to the caller and request guidance.`,
      };
    }
  }

  // 2. STATE: HALF_OPEN (Airlock Probation Window)
  if (circuitState === "HALF_OPEN") {
    const isScopedToProbation =
      toolName === lastFailedTool ||
      category === "INVESTIGATION" ||
      category === "BULK_READ";

    if (isScopedToProbation) {
      if (acknowledgedInProbation !== toolName) {
        acknowledgedInProbation = toolName;

        if (category === "INVESTIGATION" || category === "BULK_READ") {
          const failureNote = lastFailureReason
            ? `Recent Failure Context: "${lastFailureReason}".\n\n`
            : "";
          return {
            allowed: false,
            errorMessage:
              `⚠️ GUARDRAIL [PRE-EXECUTION CHECKPOINT]:\n` +
              `Tool '${toolName}' is a guarded investigation/directory tool.\n` +
              failureNote +
              `NOTE: You do NOT need to call bulk reading or investigation tools for ID resolution. All action tools (sendMessage, sendDm, sendGroupDm, addUsersToChannel, etc.) natively and automatically resolve names, emails, and channels for you.\n\n` +
              `BRANCH A (Caller explicitly requested this information):\n` +
              `If your calling instruction directed you to inspect, list, or search this workspace data, re-invoke this tool call immediately with your parameters. The airlock will permit execution.\n\n` +
              `BRANCH B (Autonomous ID lookup before taking action):\n` +
              `Do not proceed with this call. Invoke the target action tool directly.`,
          };
        }

        return {
          allowed: false,
          errorMessage:
            `⚠️ GUARDRAIL [PRE-EXECUTION CHECKPOINT]:\n` +
            `Tool '${toolName}' is in a probation state following a recent failure: "${lastFailureReason}".\n\n` +
            `BRANCH A (Caller provided new input or instructed retry):\n` +
            `Re-invoke this tool call immediately to proceed with execution.\n\n` +
            `BRANCH B (Autonomous retry without caller instruction):\n` +
            `Do not retry automatically. Report the failure reason to the caller and request guidance.`,
        };
      }

      // Second call: Acknowledged! Permit execution.
      acknowledgedInProbation = null;
    }
  }

  // 3. INVESTIGATION & BULK_READ TOOLS IN HEALTHY (Initial Airlock Probation)
  if (circuitState === "HEALTHY" && (category === "INVESTIGATION" || category === "BULK_READ")) {
    if (acknowledgedInProbation !== toolName) {
      acknowledgedInProbation = toolName;
      return {
        allowed: false,
        errorMessage:
          `⚠️ GUARDRAIL [PRE-EXECUTION CHECKPOINT]:\n` +
          `Tool '${toolName}' is a guarded investigation/directory tool.\n` +
          `NOTE: You do NOT need to call bulk reading or investigation tools to find IDs. All action tools (sendMessage, sendDm, sendGroupDm, addUsersToChannel, etc.) natively and automatically resolve names, emails, and channels for you.\n\n` +
          `BRANCH A (Caller explicitly requested this information):\n` +
          `If your calling instruction directed you to inspect, list, or search this workspace data, re-invoke this tool call immediately with your parameters. The airlock will permit execution.\n\n` +
          `BRANCH B (Autonomous ID lookup before taking action):\n` +
          `Do not proceed with this call. Invoke the target action tool directly.`,
      };
    }

    // Second call: Acknowledged! Permit execution.
    acknowledgedInProbation = null;
  }

  // 4. DESTRUCTIVE TOOLS: Always require confirmation token
  if (category === "DESTRUCTIVE") {
    const challenge = activeChallenges.get(toolName);
    const isAuthorized =
      providedToken &&
      challenge &&
      challenge.token === providedToken &&
      now < challenge.expiresAt;

    if (!isAuthorized) {
      const token = `AUTH-${Math.floor(1000 + Math.random() * 9000)}`;
      activeChallenges.set(toolName, { token, expiresAt: now + 60_000 });
      return {
        allowed: false,
        requiredConfirmationToken: token,
        errorMessage:
          `⚠️ SECURITY GATE: DESTRUCTIVE WORKSPACE ACTION INTERCEPTED.\n` +
          `You cannot execute destructive deletions or user removals autonomously.\n\n` +
          `Relay this requirement to the caller:\n` +
          `"Destructive operation intercepted. Provide confirmation code ${token} to authorize execution."\n\n` +
          `Do not re-invoke this tool until the confirmation code is provided by the caller.`,
      };
    }

    // Token consumed only when authorized to execute
    activeChallenges.delete(toolName);
  }

  return { allowed: true };
}

export function resetCircuitToHealthy(): void {
  circuitState = "HEALTHY";
  lastFailedTool = null;
  lastFailureReason = "";
  acknowledgedInProbation = null;

  if (lockTimeout) {
    clearTimeout(lockTimeout);
    lockTimeout = null;
  }
  if (probationTimeout) {
    clearTimeout(probationTimeout);
    probationTimeout = null;
  }
}

export function clearCircuitBreaker(): void {
  resetCircuitToHealthy();
  activeChallenges.clear();
}
