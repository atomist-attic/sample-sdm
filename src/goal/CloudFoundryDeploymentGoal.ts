import {
    Deployer,
    ExecuteGoal,
    Fulfillment,
    GoalWithFulfillment,
    IndependentOfEnvironment,
    SoftwareDeliveryMachine
} from "@atomist/sdm";
import { CloudFoundryBlueGreenDeployer, CloudFoundryInfo } from "@atomist/sdm-pack-cloudfoundry";
import { CloudFoundryDeployment } from "@atomist/sdm-pack-cloudfoundry/lib/api/CloudFoundryTarget";

/**
 * Simple Cloud Foundry Deployment goal
 */
export class CloudFoundryDeploymentGoal extends GoalWithFulfillment {

    constructor(sdm: SoftwareDeliveryMachine, where: CloudFoundryInfo,
                deployer: Deployer<CloudFoundryInfo, CloudFoundryDeployment> = new CloudFoundryBlueGreenDeployer(sdm.configuration.sdm.projectLoader)) {
        super({
            uniqueName: `pcf-${where.api}-${where.org}-${where.space}`,
            environment: IndependentOfEnvironment
        });

        const fulfillment: Fulfillment = {
            name: `pcf-${where.api}-${where.org}-${where.space}`,
            goalExecutor: pcfDeploy(sdm, where, deployer),
        };
        super.with(fulfillment);
    }

}

function pcfDeploy(sdm: SoftwareDeliveryMachine, cfi: CloudFoundryInfo, deployer: Deployer<CloudFoundryInfo, CloudFoundryDeployment>): ExecuteGoal {
    return async gi => {
        const deployableArtifact = await sdm.configuration.sdm.artifactStore.checkout(
            gi.sdmGoal.push.after.image.imageName,
            gi.id, gi.credentials);
        await deployer.deploy(deployableArtifact, cfi, gi.progressLog, gi.credentials, gi.context.workspaceId);
        return { code: 0, message: "" };
    };
}