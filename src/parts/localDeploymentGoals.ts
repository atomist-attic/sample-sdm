import { CodeReactionGoal, Goals, LocalDeploymentGoal, LocalEndpointGoal, ReviewGoal } from "@atomist/sdm";

export const LocalDeploymentGoals = new Goals(
    "Local Deployment",
    CodeReactionGoal,
    ReviewGoal,
    LocalDeploymentGoal,
    LocalEndpointGoal);
