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
    GitHubRepoRef,
    InMemoryProject,
    NodeFsLocalProject,
    SimpleRepoId,
} from "@atomist/automation-client";

import * as assert from "power-assert";
import {
    AddHeaderParameters,
    addHeaderTransform,
    ApacheHeader,
} from "../../../src/commands/editors/license/addHeader";

import {
    fakeCommandListenerInvocation,
} from "@atomist/sdm";
import * as fs from "fs";
import * as tmp from "tmp-promise";

describe("addHeaderTransform", () => {

    it("should add header to Java when not found", async () => {
        const p = InMemoryProject.from(new GitHubRepoRef("owner", "repoName", "abcd"),
            { path: "src/main/java/RollerOuter.java", content: JavaWithApacheHeader },
            { path: "src/main/java/Thing1.java", content: "public class Thing1 {}" });
        const parameters = new AddHeaderParameters();
        await addHeaderTransform(p, fakeCommandListenerInvocation<AddHeaderParameters>({ parameters }));
        assert(p.fileExistsSync("src/main/java/Thing1.java"));
        const content = p.findFileSync("src/main/java/Thing1.java").getContentSync();
        assert(content.startsWith(ApacheHeader));
    });

    it("should add header to TypeScript when not found", async () => {
        const p = InMemoryProject.from(new GitHubRepoRef("owner", "repoName", "abcd"),
            { path: "src/RollerOuter.ts", content: TsWithApacheHeader },
            { path: "src/Thing1.ts", content: "export class Thing1 {}" });
        const parameters = new AddHeaderParameters();
        await addHeaderTransform(p, fakeCommandListenerInvocation<AddHeaderParameters>({ parameters }));
        assert(p.fileExistsSync("src/Thing1.ts"));
        const content = p.findFileSync("src/Thing1.ts").getContentSync();
        assert(content.startsWith(ApacheHeader));
    });

    it("should respect exclude glob", async () => {
        const content = "export class Thing1 {}";
        const p = InMemoryProject.from(new GitHubRepoRef("owner", "repoName", "abcd"),
            { path: "src/RollerOuter.ts", content: TsWithApacheHeader },
            { path: "src/Thing1.ts", content });
        const parameters = new AddHeaderParameters();
        parameters.excludeGlob = "src/Thing1.ts";
        await addHeaderTransform(p, fakeCommandListenerInvocation<AddHeaderParameters>({ parameters }));
        assert(p.fileExistsSync("src/Thing1.ts"));
        const newContent = p.findFileSync("src/Thing1.ts").getContentSync();
        assert.equal(newContent, content);
    });

    it("should ignore irrelevant exclude glob", async () => {
        const p = InMemoryProject.from(new GitHubRepoRef("owner", "repoName", "abcd"),
            { path: "src/RollerOuter.ts", content: TsWithApacheHeader },
            { path: "src/Thing1.ts", content: "export class Thing1 {}" });
        const parameters = new AddHeaderParameters();
        parameters.excludeGlob = "other.thing";
        await addHeaderTransform(p, fakeCommandListenerInvocation<AddHeaderParameters>({ parameters}));
        assert(p.fileExistsSync("src/Thing1.ts"));
        const content = p.findFileSync("src/Thing1.ts").getContentSync();
        assert(content.startsWith(ApacheHeader));
    });

    it("should add header to JS when not found", async () => {
        const p = InMemoryProject.from(new GitHubRepoRef("owner", "repoName", "abcd"),
            { path: "src/RollerOuter.js", content: TsWithApacheHeader },
            { path: "src/Thing1.js", content: "export class Thing1 {}" });
        const parameters = new AddHeaderParameters();
        await addHeaderTransform(p, fakeCommandListenerInvocation<AddHeaderParameters>({ parameters}));
        assert(p.fileExistsSync("src/Thing1.js"));
        const content = p.findFileSync("src/Thing1.js").getContentSync();
        assert(content.startsWith(ApacheHeader));
    });

    it("should add header to Scala when not found", async () => {
        const p = InMemoryProject.from(new GitHubRepoRef("owner", "repoName", "abcd"),
            { path: "src/Thing1.scala", content: "public class Thing1 {}" });
        const parameters = new AddHeaderParameters();
        await addHeaderTransform(p, fakeCommandListenerInvocation<AddHeaderParameters>({ parameters}));
        assert(p.fileExistsSync("src/Thing1.scala"));
        const content = p.findFileSync("src/Thing1.scala").getContentSync();
        assert(content.startsWith(ApacheHeader));
    });

    it("should add header to C when not found", async () => {
        const p = InMemoryProject.from(new GitHubRepoRef("owner", "repoName", "abcd"),
            { path: "src/Thing1.c", content: "#include <stdio.h>" });
        const parameters = new AddHeaderParameters();
        await addHeaderTransform(p, fakeCommandListenerInvocation<AddHeaderParameters>({ parameters}));
        assert(p.fileExistsSync("src/Thing1.c"));
        const content = p.findFileSync("src/Thing1.c").getContentSync();
        assert(content.startsWith(ApacheHeader));
    });

    it("should add header to C++ when not found", async () => {
        const p = InMemoryProject.from(new GitHubRepoRef("owner", "repoName", "abcd"),
            { path: "src/Thing1.cpp", content: "#include <stdio.h>" });
        const parameters = new AddHeaderParameters();
        await addHeaderTransform(p, fakeCommandListenerInvocation<AddHeaderParameters>({ parameters}));
        assert(p.fileExistsSync("src/Thing1.cpp"));
        const content = p.findFileSync("src/Thing1.cpp").getContentSync();
        assert(content.startsWith(ApacheHeader));
    });

    it("should add header to Kotlin when not found", async () => {
        const p = InMemoryProject.from(new GitHubRepoRef("owner", "repoName", "abcd"),
            { path: "src/Thing1.kt", content: "public class Thing1 {}" });
        const parameters = new AddHeaderParameters();
        await addHeaderTransform(p, fakeCommandListenerInvocation<AddHeaderParameters>({ parameters}));
        assert(p.fileExistsSync("src/Thing1.kt"));
        const content = p.findFileSync("src/Thing1.kt").getContentSync();
        assert(content.startsWith(ApacheHeader));
    });

    it("should add header when not found and persist to disk", async () => {
        const tmpDir = tmp.dirSync({ unsafeCleanup: true }).name;
        const p = new NodeFsLocalProject(new GitHubRepoRef("owner", "repoName", "abcd"), tmpDir);
        p.addFileSync("src/main/java/RollerOuter.java", JavaWithApacheHeader);
        p.addFileSync("src/main/java/Thing1.java", "public class Thing1 {}");
        const c1 = fs.readFileSync(tmpDir + "/src/main/java/Thing1.java");
        assert(!c1.toString().startsWith(ApacheHeader), "Header should not yet be there");
        assert(!!c1);
        const parameters = new AddHeaderParameters();
        await addHeaderTransform(p, fakeCommandListenerInvocation<AddHeaderParameters>({ parameters}));
        assert(p.fileExistsSync("src/main/java/Thing1.java"));
        const content = p.findFileSync("src/main/java/Thing1.java").getContentSync();
        assert(content.startsWith(ApacheHeader));
        const c2 = fs.readFileSync(tmpDir + "/src/main/java/Thing1.java");
        assert(c2.toString().startsWith(ApacheHeader), "Should have persisted to file system");
    });

    it("should not add header when already present", async () => {
        const p = InMemoryProject.from(new SimpleRepoId("owner", "repoName"),
            { path: "src/main/java/RollerOuter.java", content: JavaWithApacheHeader },
            { path: "src/main/java/Thing1.java", content: JavaWithApacheHeader });
        const parameters = new AddHeaderParameters();
        await addHeaderTransform(p, fakeCommandListenerInvocation<AddHeaderParameters>({ parameters}));
        assert(p.fileExistsSync("src/main/java/Thing1.java"));
        const content = p.findFileSync("src/main/java/Thing1.java").getContentSync();
        assert(content === JavaWithApacheHeader);
    });

    it("should not add header when another header is present", async () => {
        const p = InMemoryProject.from(new SimpleRepoId("owner", "repoName"),
            { path: "src/main/java/RollerOuter.java", content: JavaWithApacheHeader },
            { path: "src/main/java/Thing1.java", content: JavaWithGplHeader });
        const parameters = new AddHeaderParameters();
        await addHeaderTransform(p, fakeCommandListenerInvocation<AddHeaderParameters>({ parameters}));
        assert(p.fileExistsSync("src/main/java/Thing1.java"));
        const content = p.findFileSync("src/main/java/Thing1.java").getContentSync();
        assert(content === JavaWithGplHeader);
    });

});

/* tslint:disable */
const GplHeader = `/* 
 * This file is part of the XXX distribution (https://github.com/xxxx or http://xxx.github.io).
 * Copyright (c) 2015 Liviu Ionescu.
 * 
 * This program is free software: you can redistribute it and/or modify  
 * it under the terms of the GNU General Public License as published by  
 * the Free Software Foundation, version 3.
 *
 * This program is distributed in the hope that it will be useful, but 
 * WITHOUT ANY WARRANTY; without even the implied warranty of 
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU 
 * General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License 
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */`;

const JavaWithApacheHeader = `${ApacheHeader}
 
 public class Thing {}`;

const JavaWithGplHeader = `${GplHeader}
 
 public class Thing {}`;

const TsWithApacheHeader = `${ApacheHeader}
 
 export class Thing {}`;