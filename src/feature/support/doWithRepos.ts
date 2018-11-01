import { logger, RemoteRepoRef } from "@atomist/automation-client";
import { SdmContext, SoftwareDeliveryMachine } from "@atomist/sdm";
import { WithLoadedProject } from "@atomist/sdm/lib/spi/project/ProjectLoader";

/**
 * Perform a readonly action on all accessible repos in parallel
 * @param {SoftwareDeliveryMachine} sdm
 * @param {SdmContext} i
 * @param {WithLoadedProject<any>} action
 * @return {Promise<any>}
 */
export async function doWithRepos(sdm: SoftwareDeliveryMachine,
                                  i: SdmContext,
                                  action: WithLoadedProject<any>): Promise<any> {
    const repos = await sdm.configuration.sdm.repoFinder(i.context);
    logger.info("doWithRepos working on %d repos", repos.length);
    await Promise.all(repos.map(id => {
        return sdm.configuration.sdm.projectLoader.doWithProject(
            { credentials: i.credentials, id: id as RemoteRepoRef, readOnly: true },
            action)
            .catch(err => {
                logger.warn("Project err: %s", err);
            });
    }));
}
