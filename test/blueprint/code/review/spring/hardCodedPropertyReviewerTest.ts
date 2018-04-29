/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { InMemoryProject } from "@atomist/automation-client/project/mem/InMemoryProject";
import { GitHubRepoRef } from "@atomist/automation-client/operations/common/GitHubRepoRef";
import { HardCodedPropertyReviewer } from "../../../../../src/blueprint/code/review/spring/hardcodedPropertyReviewer";
import { PushListenerInvocation } from "@atomist/sdm";
import { Project } from "@atomist/automation-client/project/Project";
import { RemoteRepoRef } from "@atomist/automation-client/operations/common/RepoId";
import { GitProject } from "@atomist/automation-client/project/git/GitProject";

import * as assert from "power-assert";

describe("HardCodePropertyReviewer", () => {

    it("should not find any problems in empty project", async () => {
        const id = new GitHubRepoRef("a", "b");
        const p = InMemoryProject.from(id);
        const r = await HardCodedPropertyReviewer.action(fakeListenerInvocation(p) as any);
        assert.equal(r.comments.length, 0);
    });

});

export function fakeListenerInvocation(project: Project): PushListenerInvocation {
    return {
        push: {id: new Date().getTime() + "_", branch: "master"},
        project: project as any as GitProject,
        id: project.id as RemoteRepoRef,
        context: null,
        addressChannels: null,
        credentials: null,
    };
}
