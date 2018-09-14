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
    CodeInspectionGoal,
    DefaultReviewComment,
    Goals,
    ReviewerRegistration,
    saveFromFiles,
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineConfiguration,
    whenPushSatisfies,
} from "@atomist/sdm";
import { createSoftwareDeliveryMachine } from "@atomist/sdm-core";
import { CheckstyleSupport } from "@atomist/sdm-pack-checkstyle";
import {
    IsJava,
    MaterialChangeToJavaRepo,
} from "@atomist/sdm-pack-spring";
import { DemoEditors } from "../pack/demo-editors/demoEditors";

/**
 * Assemble a machine that performs only static analysis.
 * @return {SoftwareDeliveryMachine}
 */
export function staticAnalysisMachine(
    configuration: SoftwareDeliveryMachineConfiguration): SoftwareDeliveryMachine {
    const sdm = createSoftwareDeliveryMachine(
        {
            name: "Static analysis SDM",
            configuration,
        },
        whenPushSatisfies(IsJava, MaterialChangeToJavaRepo)
            .itMeans("Change to Java")
            .setGoals(new Goals("Code Inspection only", CodeInspectionGoal)));
    sdm.addExtensionPacks(
        CheckstyleSupport,
        DemoEditors,
    )
        .addAutoInspectRegistration(rodHatesYaml)
        .addAutoInspectRegistration(hasNoReadMe);

    return sdm;
}

const rodHatesYaml: ReviewerRegistration = {
    name: "rodHatesYaml",
    inspection: async (project, cri) => ({
        repoId: project.id,
        comments:
            await saveFromFiles(project, "**/*.yml", async f =>
                new DefaultReviewComment("info", "yml-reviewer",
                    `Found YML in \`${f.path}\`: Rod regards the format as an insult to computer science`,
                    {
                        path: f.path,
                        lineFrom1: 1,
                        offset: -1,
                    })),
    }),
};

const hasNoReadMe: ReviewerRegistration = {
    name: "hasNoReadme",
    inspection: async (project, cri) => ({
        repoId: project.id,
        comments: !!(await project.getFile("README.me")) ?
            [] :
            [new DefaultReviewComment("info", "readme",
                "Project has no README",
                {
                    path: "README.md",
                    lineFrom1: 1,
                    offset: -1,
                })],
    }),
};
