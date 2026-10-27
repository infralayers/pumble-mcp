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

export class EnvironmentFSM {
  private state: CircuitState = "HEALTHY";
  private lastFailedTool: string | null = null;
  private lastFailureReason: string = "";

  // Timing constants (internal only, never exposed to AI)
  private readonly LOCK_DURATION_MS: number;
  private readonly PROBATION_DURATION_MS: number;

  private lockTimeout: NodeJS.Timeout | null = null;
  private probationTimeout: NodeJS.Timeout | null = null;

  // Airlock probation tracker: tracks which tool received the warning in HALF_OPEN
  private acknowledgedInProbation: string | null = null;

  // One-time security tokens for destructive operations
  private activeChallenges: Map<string, { token: string; expiresAt: number }> = new Map();

  // === 24-TOOL COMPREHENSIVE TAXONOMY ===

  public static readonly INVESTIGATION_TOOLS = new Set([
    "search_messages",
    "list_messages_via_name_or_id",
    "list_thread_replies_via_channel_name_or_id",
    "list_user_groups",
  ]);

  public static readonly BULK_READ_TOOLS = new Set([
    "list_channels_only_when_user_calls",
    "list_users_not_for_id_lookup",
  ]);

  public static readonly DESTRUCTIVE_TOOLS = new Set([
    "remove_user_from_channel_via_name_or_id",
    "delete_scheduled_message_via_name_or_id",
    "delete_message",
  ]);

  public static readonly ACTION_TOOLS = new Set([
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

  public static readonly INFO_TOOLS = new Set([
    "get_my_info",
    "get_channel_detail_via_channel_name_or_id",
    "get_scheduled_message_via_name_or_id",
    "list_scheduled_messages",
    "get_message_via_id",
  ]);

  // All state-mutating tools: A success in any of these resets the circuit to HEALTHY
  public static readonly MUTATING_TOOLS = new Set([
    ...EnvironmentFSM.ACTION_TOOLS,
    ...EnvironmentFSM.DESTRUCTIVE_TOOLS,
  ]);

  constructor(lockDurationMs: number = 3_000, probationDurationMs: number = 60_000) {
    this.LOCK_DURATION_MS = lockDurationMs;
    this.PROBATION_DURATION_MS = probationDurationMs;
  }

  public getState(): CircuitState {
    return this.state;
  }

  public getLastFailedTool(): string | null {
    return this.lastFailedTool;
  }

  public getLastFailureReason(): string {
    return this.lastFailureReason;
  }

  public getCategory(toolName: string): ToolCategory {
    if (
      EnvironmentFSM.DESTRUCTIVE_TOOLS.has(toolName) ||
      toolName.includes("remove_user") ||
      toolName.includes("delete_scheduled") ||
      toolName.includes("delete_message")
    ) {
      return "DESTRUCTIVE";
    }
    if (
      EnvironmentFSM.BULK_READ_TOOLS.has(toolName) ||
      toolName.includes("list_channels") ||
      toolName.includes("list_users")
    ) {
      return "BULK_READ";
    }
    if (
      EnvironmentFSM.INVESTIGATION_TOOLS.has(toolName) ||
      toolName.includes("search_messages") ||
      toolName.includes("list_messages") ||
      toolName.includes("list_thread_replies") ||
      toolName.includes("list_user_groups")
    ) {
      return "INVESTIGATION";
    }
    if (
      EnvironmentFSM.ACTION_TOOLS.has(toolName) ||
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

  /**
   * Called when an Entity Resolution or domain action failure occurs.
   * Trips the failed tool, all investigation tools, and bulk read tools into LOCKED for 3s.
   */
  public reportResolutionError(toolName: string, reason: string): void {
    this.lastFailedTool = toolName;
    this.lastFailureReason = reason;
    this.state = "LOCKED";
    this.acknowledgedInProbation = null;

    if (this.lockTimeout) clearTimeout(this.lockTimeout);
    if (this.probationTimeout) clearTimeout(this.probationTimeout);

    // After 3 seconds, transition silently from LOCKED to HALF_OPEN
    this.lockTimeout = setTimeout(() => {
      this.transitionToHalfOpen();
    }, this.LOCK_DURATION_MS);
    this.lockTimeout.unref(); // Prevent blocking process exit
  }

  /**
   * Transitions from LOCKED to HALF_OPEN with a 60-second idle expiration.
   */
  private transitionToHalfOpen(): void {
    this.state = "HALF_OPEN";
    this.acknowledgedInProbation = null;

    if (this.probationTimeout) clearTimeout(this.probationTimeout);

    // If no interaction occurs within 60s, silently reset to HEALTHY
    this.probationTimeout = setTimeout(() => {
      this.resetToHealthy();
    }, this.PROBATION_DURATION_MS);
    this.probationTimeout.unref();
  }

  /**
   * Called when any mutating tool completes successfully.
   * Self-healing: instantly restores the entire circuit to HEALTHY.
   */
  public reportSuccess(toolName: string): void {
    if (EnvironmentFSM.MUTATING_TOOLS.has(toolName)) {
      this.resetToHealthy();
    }
  }

  /**
   * Evaluates tool accessibility based on current state and safety policies.
   */
  public checkToolAccess(toolName: string, providedToken?: string): ToolAccessResult {
    const category = this.getCategory(toolName);
    const now = Date.now();

    // 1. STATE: LOCKED (Fast-Fail 3s Window)
    // The specific failed tool + all investigation tools + all bulk reading tools are blocked.
    if (this.state === "LOCKED") {
      const isRestrictedInLock =
        toolName === this.lastFailedTool ||
        category === "INVESTIGATION" ||
        category === "BULK_READ";

      if (isRestrictedInLock) {
        return {
          allowed: false,
          errorMessage:
            `CIRCUIT BREAKER [LOCKED]: Tool '${toolName}' execution restricted.\n` +
            `Recent Failure: "${this.lastFailureReason}"\n\n` +
            `OPERATIONAL DIRECTIVE:\n` +
            `- All action tools natively resolve channel names, user names, handles, and emails without directory lookups.\n` +
            `- Do not execute exploratory lookups or probing queries to recover from this failure.\n` +
            `- Report the exact failure reason above to the caller and request guidance.`,
        };
      }
    }

    // 2. STATE: HALF_OPEN (Airlock Probation Window)
    if (this.state === "HALF_OPEN") {
      const isScopedToProbation =
        toolName === this.lastFailedTool ||
        category === "INVESTIGATION" ||
        category === "BULK_READ";

      if (isScopedToProbation) {
        // First call: Intercept with pre-execution warning checkpoint
        if (this.acknowledgedInProbation !== toolName) {
          this.acknowledgedInProbation = toolName;

          if (category === "INVESTIGATION" || category === "BULK_READ") {
            const failureNote = this.lastFailureReason
              ? `Recent Failure Context: "${this.lastFailureReason}".\n\n`
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
              `Tool '${toolName}' is in a probation state following a recent failure: "${this.lastFailureReason}".\n\n` +
              `BRANCH A (Caller provided new input or instructed retry):\n` +
              `Re-invoke this tool call immediately to proceed with execution.\n\n` +
              `BRANCH B (Autonomous retry without caller instruction):\n` +
              `Do not retry automatically. Report the failure reason to the caller and request guidance.`,
          };
        }

        // Second call: Acknowledged! Permit execution.
        this.acknowledgedInProbation = null;
      }
    }

    // 3. INVESTIGATION & BULK_READ TOOLS IN HEALTHY (Initial Airlock Probation)
    if (this.state === "HEALTHY" && (category === "INVESTIGATION" || category === "BULK_READ")) {
      if (this.acknowledgedInProbation !== toolName) {
        this.acknowledgedInProbation = toolName;
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
      this.acknowledgedInProbation = null;
    }

    // 4. DESTRUCTIVE TOOLS: Always require confirmation token
    if (category === "DESTRUCTIVE") {
      const challenge = this.activeChallenges.get(toolName);
      const isAuthorized =
        providedToken &&
        challenge &&
        challenge.token === providedToken &&
        now < challenge.expiresAt;

      if (!isAuthorized) {
        const token = `AUTH-${Math.floor(1000 + Math.random() * 9000)}`;
        this.activeChallenges.set(toolName, { token, expiresAt: now + 60_000 });
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
      this.activeChallenges.delete(toolName);
    }

    return { allowed: true };
  }

  public resetToHealthy(): void {
    this.state = "HEALTHY";
    this.lastFailedTool = null;
    this.lastFailureReason = "";
    this.acknowledgedInProbation = null;

    if (this.lockTimeout) {
      clearTimeout(this.lockTimeout);
      this.lockTimeout = null;
    }
    if (this.probationTimeout) {
      clearTimeout(this.probationTimeout);
      this.probationTimeout = null;
    }
  }

  public clear(): void {
    this.resetToHealthy();
    this.activeChallenges.clear();
  }
}
