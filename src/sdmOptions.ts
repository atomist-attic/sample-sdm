import { SoftwareDeliveryMachineOptions } from "@atomist/sdm/blueprint/SoftwareDeliveryMachineOptions";
import { DockerOptions } from "@atomist/sdm/common/delivery/docker/executeDockerBuild";
import { CachingProjectLoader } from "@atomist/sdm/common/repo/CachingProjectLoader";
import { GitHubCredentialsResolver } from "@atomist/sdm/handlers/common/GitHubCredentialsResolver";
import { DefaultArtifactStore } from "./blueprint/artifactStore";
import { logFactory } from "./blueprint/log/logFactory";
import { JavaSupportOptions } from "./parts/stacks/javaSupport";

export const SdmOptions: SoftwareDeliveryMachineOptions & JavaSupportOptions & DockerOptions = {

    // SDM Options
    artifactStore: DefaultArtifactStore,
    projectLoader: new CachingProjectLoader(),
    logFactory: logFactory(process.env.ROLAR_BASE_URL),
    credentialsResolver: new GitHubCredentialsResolver(),

    // Java options
    useCheckstyle: process.env.USE_CHECKSTYLE === "true",
    reviewOnlyChangedFiles: true,

    // Docker options
    registry: process.env.ATOMIST_DOCKER_REGISTRY,
    user: process.env.ATOMIST_DOCKER_USER,
    password: process.env.ATOMIST_DOCKER_PASSWORD,
};
