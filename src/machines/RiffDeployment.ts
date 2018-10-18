/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
    asSpawnCommand,
    ExecuteGoal,
    Fulfillment,
    GoalWithFulfillment,
    IndependentOfEnvironment,
    LoggingProgressLog,
    ProjectListener,
    spawnAndWatch,
} from "@atomist/sdm";

// tslint:disable-next-line:no-empty-interface
export interface RiffDeploymentOptions {

    // Empty
}

/**
 * Goal for Riff deployment. Relies on Kube Control pointing at a Kube cluster
 * with Knative, and the Riff command line.
 */
export class RiffDeployment extends GoalWithFulfillment {

    /**
     * Specify Riff deployment
     */
    constructor(opts: Partial<RiffDeploymentOptions> = {}) {
        super({
            // TODO calculate it
            uniqueName: `RiffDeployment`,
            environment: IndependentOfEnvironment,
            displayName: "Riff deployment",
        });

        const fulfillment: Fulfillment = {
            name: `RiffDeployment`,
            goalExecutor: executeRiffDeploy(opts),
        };
        super.with(fulfillment);
    }

}

/**
 * Execute "riff function build" in response to any push to a Riff project
 * @param {Partial<RiffDeploymentOptions>} opts
 * @return {ExecuteGoal}
 */
function executeRiffDeploy(opts: Partial<RiffDeploymentOptions>): ExecuteGoal {
    return async goalInvocation => {
        const { credentials, id } = goalInvocation;
        try {
            await goalInvocation.configuration.sdm.projectLoader.doWithProject(
                { credentials, id, readOnly: true },
                async project => {
                    const riffBuildCommand = `riff function build ${goalInvocation.id.repo} --local-path ${project.baseDir}`;
                    await spawnAndWatch(asSpawnCommand(riffBuildCommand), {}, goalInvocation.progressLog);
                    await goalInvocation.addressChannels(`Riff deployment of ${id.url} complete`);
                });
        } catch (err) {
            return { code: 1, message: err.stack };
        }
        await goalInvocation.addressChannels("Do Riff deployment with fields on GoalInvocation");
    };
}

/**
 * ProjectListener that reacts to new Riff repos and tries to register it
 * @param {ProjectListenerInvocation} i
 * @return {Promise<any>}
 * @constructor
 */
export const RegisterNewRiffRepos: ProjectListener = async i => {
    process.stdout.write(`Examining project at ${i.id.url}`);
    // TODO this nasty cast will go when we narrow the type in spring pack
    // TODO why is this not working?

    //const isRiff = await (IsRiff as PredicatePushTest).predicate(i.project);
    const isRiff = await i.project.hasFile("riff.toml");
    if (isRiff) {
        await i.addressChannels(`Registering Riff project at ${i.id.url}`);
        // TODO may want to use spawn
        const riffCreateCommand = `riff function create java ${i.id.repo} --local-path ${i.project.baseDir} --image dev.local/${i.id.repo}:v1`;
        //"riff function create java --git-repo";
        process.stdout.write("My riff command is " + riffCreateCommand);
        await spawnAndWatch(asSpawnCommand(riffCreateCommand), {}, new LoggingProgressLog("riff create"))
    }
};