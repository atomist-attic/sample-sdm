import {
    AnyPush,
    executeDeploy, ExecuteGoal,
    Fulfillment,
    GoalWithFulfillment,
    IndependentOfEnvironment,
    ProductionDeploymentGoal,
    ProductionEndpointGoal,
    ProductionUndeploymentGoal,
    SoftwareDeliveryMachine, Target
} from "@atomist/sdm";
import { CloudFoundryBlueGreenDeployer, EnvironmentCloudFoundryTarget } from "@atomist/sdm-pack-cloudfoundry";

export interface CloudFoundryTarget {
    space: string;
    org: string;
    api?: string;

    reference?: "production" | "staging";
}

/**
 * Simple Cloud Foundry Deployment goal
 */
export class CloudFoundryDeployment extends GoalWithFulfillment {

    constructor(sdm: SoftwareDeliveryMachine, where: CloudFoundryTarget) {
        super({
            uniqueName: `pcf-${where.api}-${where.org}-${where.space}`,
            environment: IndependentOfEnvironment
        });

        const deployToProduction: Target = {
            deployer: new CloudFoundryBlueGreenDeployer(sdm.configuration.sdm.projectLoader),
            targeter: () => ({
                ...(new EnvironmentCloudFoundryTarget(where.reference || "production")),
                ...where,
            }),
            deployGoal: ProductionDeploymentGoal,
            endpointGoal: ProductionEndpointGoal,
            undeployGoal: ProductionUndeploymentGoal,
        };
        const fulfillment: Fulfillment = {
            name: `pcf-${where.api}-${where.org}-${where.space}`,
            goalExecutor: executeDeploy(
                sdm.configuration.sdm.artifactStore,
                sdm.configuration.sdm.repoRefResolver,
                deployToProduction.endpointGoal,
                deployToProduction),
        };
        sdm.addGoalSideEffect(
            deployToProduction.endpointGoal,
            deployToProduction.deployGoal.definition.displayName,
            AnyPush);
        super.with(fulfillment);
    }

}

const pcfDeploy: ExecuteGoal = async gi => {
    return { code: 0, message: "" };
};