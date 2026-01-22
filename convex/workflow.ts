import { WorkflowManager, vWorkflowId } from "@convex-dev/workflow";
import { components, internal } from "./_generated/api";
import { internalAction, internalMutation, mutation } from "./_generated/server";
import { v } from "convex/values";

export const workflow = new WorkflowManager(components.workflow);

// Result validator for onComplete
const vResult = v.union(
  v.object({ kind: v.literal("success"), returnValue: v.any() }),
  v.object({ kind: v.literal("failed"), error: v.string() }),
  v.object({ kind: v.literal("canceled") })
);

// Prep step - just logs
export const prepStep = internalMutation({
  args: {},
  handler: async (_ctx) => {
    console.log("PREP STEP executed!");
  },
});

// Run step - takes 5 seconds, logs every second
export const runStep = internalAction({
  args: {},
  handler: async (_ctx) => {
    console.log("RUN STEP: Starting long-running work...");
    for (let i = 1; i <= 5; i++) {
      console.log(`RUN STEP: Working... second ${i}/5`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    console.log("RUN STEP: Long-running work complete!");
  },
});

// Wrap-up step - just logs
export const wrapUpStep = internalMutation({
  args: {},
  handler: async (_ctx) => {
    console.log("WRAP-UP STEP executed!");
  },
});

// Define the workflow with 3 steps
export const myWorkflow = workflow.define({
  args: {},
  handler: async (step, _args) => {
    // Step 1: Prep
    await step.runMutation(internal.workflow.prepStep, {});

    // Step 2: Run (long-running)
    await step.runAction(internal.workflow.runStep, {});

    // Step 3: Wrap-up
    await step.runMutation(internal.workflow.wrapUpStep, {});
  },
});

// onComplete handler
export const handleOnComplete = internalMutation({
  args: {
    workflowId: vWorkflowId,
    result: vResult,
    context: v.any(),
  },
  handler: async (ctx, args) => {
    console.log(`ON COMPLETE: Result kind = ${args.result.kind}`);

    // Cleanup the workflow
    await workflow.cleanup(ctx, args.workflowId);
    console.log("ON COMPLETE: Workflow cleaned up");
  },
});

// Mutation to start the workflow and cancel it after 2 seconds. Call this from the convex dashboard to repro the bug.
export const startAndCancelWorkflow = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx): Promise<string> => {
    console.log("Starting workflow...");

    const workflowId = await workflow.start(
      ctx,
      internal.workflow.myWorkflow,
      {},
      {
        onComplete: internal.workflow.handleOnComplete,
        context: {},
      },
    );

    console.log(`Workflow started with ID: ${workflowId}`);

    // Schedule cancellation after 3 seconds
    await ctx.scheduler.runAfter(3000, internal.workflow.cancelWorkflow, { workflowId });

    console.log("Scheduled cancellation in 3 seconds");

    return workflowId;
  },
});

// Internal mutation to cancel the workflow
export const cancelWorkflow = internalMutation({
  args: { workflowId: vWorkflowId },
  handler: async (ctx, args) => {
    console.log(`Cancelling workflow: ${args.workflowId}`);
    await workflow.cancel(ctx, args.workflowId);
    console.log("Workflow cancelled");
  },
});
