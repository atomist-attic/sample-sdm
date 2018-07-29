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

import { logger, } from "@atomist/automation-client";
import { LocalProject } from "@atomist/automation-client/project/local/LocalProject";
import { SpawnedDeployment, } from "@atomist/sdm-core";
import { DelimitedWriteProgressLogDecorator } from "@atomist/sdm/api-helper/log/DelimitedWriteProgressLogDecorator";
import { InterpretLog, } from "@atomist/sdm/spi/log/InterpretedLog";
import { ProgressLog } from "@atomist/sdm/spi/log/ProgressLog";
import { ProjectLoader } from "@atomist/sdm/spi/project/ProjectLoader";
import { ChildProcess, spawn } from "child_process";
import { ExecuteGoal, GenericGoal } from "@atomist/sdm";
import { LoggingProgressLog } from "@atomist/sdm/api-helper/log/LoggingProgressLog";
import { poisonAndWait } from "@atomist/sdm/api-helper/misc/spawned";

export const MavenDeploymentGoal = new GenericGoal({ uniqueName: "mavenDep" },
    "Deploy to Maven");

export interface MavenDeployerOptions {

    portForBranch: (branch: string) => number;

    baseUrl: string;

    /**
     * Pattern to find in output to indicate that the server has come up successfully.
     * For example, matching something like "Started SpringRestSeedApplication in 3.931 seconds"
     */
    successPatterns: RegExp[];

    /**
     * Command line arguments for the startup process to
     * expose our port and Atomist team if possible
     */
    commandLineArgumentsFor: (port: number, contextRoot: string) => string[];

}

/** Successs patterns when Spring Boot starts
 * @type {RegExp}
 */
export const SpringBootSuccessPatterns = [
    /Tomcat started on port/,
    /Started [A-Za-z0-9_$]+ in [0-9]+.[0-9]+ seconds/,
];

/**
 * Use Maven to deploy
 * @param projectLoader use to load projects
 * @param opts options
 */
export function executeMavenDeploy(projectLoader: ProjectLoader,
                                   opts: Partial<MavenDeployerOptions>): ExecuteGoal {
    const optsToUse: MavenDeployerOptions = {
        ...opts,
        portForBranch: branch => 9090,
        successPatterns: SpringBootSuccessPatterns,
        commandLineArgumentsFor: springBootMavenArgs,
        baseUrl: "http://127.0.0.1",
    };
    const deployer = new MavenDeployer(optsToUse);

    return async goalInvocation => {
        //await goalInvocation.addressChannels("should do Maven deploy");
        const { credentials, id } = goalInvocation;

        try {
            const deployment = await projectLoader.doWithProject({ credentials, id, readOnly: true },
                project => deployer.deployProject(new LoggingProgressLog("info"), project, goalInvocation.sdmGoal.branch));
            await goalInvocation.addressChannels(`Deployed \`${id.owner}/${id.repo}\` at ${deployment.endpoint}`);
            return { code: 0 };
        }
        catch (err) {
            return { code: 1, message: err.stack };
        }
    };
}

/**
 * Holds state
 */
class MavenDeployer {

    // Keys are ports: values are child processes
    private portToChildProcess: { [port: number] : ChildProcess } = {};

    constructor(private readonly options: MavenDeployerOptions) {
    }

    public async deployProject(
        log: ProgressLog,
        project: LocalProject,
        branch: string): Promise<SpawnedDeployment> {
        const contextRoot = `/${project.id.owner}/${project.id.repo}/${project.id.branch}`;

        const port = this.options.portForBranch(branch);
        const existingChildProcess = this.portToChildProcess[port];
        if (!!existingChildProcess) {
            logger.info("Killing existing process for branch '%s' with pid %s", branch, existingChildProcess.pid);
            await poisonAndWait(existingChildProcess);
        } else {
            logger.info("No existing process for branch '%s'", branch);
        }

        const childProcess = spawn("mvn",
            [
                "spring-boot:run",
            ].concat(this.options.commandLineArgumentsFor(port, contextRoot)),
            {
                cwd: project.baseDir,
            });
        if (!childProcess.pid) {
            throw new Error("Fatal error deploying using Maven--is `mvn` on your automation node path?\n" +
                "Attempted to execute `mvn: spring-boot:run`");
        }
        const deployment = {
            childProcess,
            endpoint: `${this.options.baseUrl}:${port}/${contextRoot}`,
        };

        this.portToChildProcess[port] = childProcess;

        // TODO record
        const newLineDelimitedLog = new DelimitedWriteProgressLogDecorator(log, "\n");
        childProcess.stdout.on("data", what => newLineDelimitedLog.write(what.toString()));
        childProcess.stderr.on("data", what => newLineDelimitedLog.write(what.toString()));
        return new Promise<SpawnedDeployment>((resolve, reject) => {
            childProcess.stdout.addListener("data", what => {
                if (!!what && this.options.successPatterns.some(successPattern => successPattern.test(what.toString()))) {
                    resolve(deployment);
                }
            });
            childProcess.addListener("exit", () => {
                reject(new Error("We should have found success message pattern by now!!"));
            });
            childProcess.addListener("error", reject);
        });
    }
}

const shortLogInterpreter: InterpretLog = (log: string) => {
    if (log.length < 200) {
        return {
            relevantPart: log,
            message: "This is the whole log.",
            includeFullLog: false,
        };
    }
};

const springBootRunLogInterpreter: InterpretLog = (log: string) => {
    logger.debug("Interpreting log");

    if (!log) {
        logger.warn("log was empty");
        return undefined;
    }

    const maybeFailedToStart = appFailedToStart(log);
    if (maybeFailedToStart) {
        return {
            relevantPart: maybeFailedToStart,
            message: "Application failed to start",
            includeFullLog: false,
        };
    }

    // default to maven errors
    const maybeMavenErrors = mavenErrors(log);
    if (maybeMavenErrors) {
        logger.info("recognized maven error");
        return {
            relevantPart: maybeMavenErrors,
            message: "Maven errors",
        };
    }

    // or it could be this problem here
    if (log.match(/Error checking out artifact/)) {
        logger.info("Recognized artifact error");
        return {
            relevantPart: log,
            message: "I lost the local cache. Please rebuild",
            includeFullLog: false,
        };
    }

    logger.info("Did not find anything to recognize in the log");
};

function appFailedToStart(log: string) {
    const lines = log.split("\n");
    const failedToStartLine = lines.indexOf("APPLICATION FAILED TO START");
    if (failedToStartLine < 1) {
        return undefined;
    }
    const likelyLines = lines.slice(failedToStartLine + 3, failedToStartLine + 10);
    return likelyLines.join("\n");
}

function mavenErrors(log: string) {
    if (log.match(/^\[ERROR]/m)) {
        return log.split("\n")
            .filter(l => l.startsWith("[ERROR]"))
            .join("\n");
    }
}

export function springBootMavenArgs(port: number, contextRoot: string): string[] {
    return [
        `-Dserver.port=${port}`,
        `-Dserver.contextPath=${contextRoot}`,
    ];
}
