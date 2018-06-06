import { ExtensionPack } from "@atomist/sdm";
import { SuggestAddingCloudFoundryManifest } from "./suggestAddingCloudFoundryManifest";
import { AddCloudFoundryManifest } from "./addCloudFoundryManifest";

export const CloudFoundrySupport: ExtensionPack = {
    name: "CloudFoundry",
    vendor: "Atomist",
    version: "0.1.0",
    configure: sdm => {
        sdm
            .addEditors(AddCloudFoundryManifest)
            .addChannelLinkListeners(SuggestAddingCloudFoundryManifest);
    },
};
