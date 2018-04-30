import * as assert from "power-assert";
import { SpringBootSuccessPatterns } from "../../../src/blueprint/deploy/localSpringBootDeployers";

describe("SpringBootSuccessPattern", () => {

    it("should match", () => {
        const s = "Started SpringRestSeedApplication in 3.931 seconds";
        assert(SpringBootSuccessPatterns[1].test(s));
    });

    it("should match slow deployment", () => {
        const s = "Started SpringRestSeedApplication25 in 36.931 seconds";
        assert(SpringBootSuccessPatterns[1].test(s));
    });

});
