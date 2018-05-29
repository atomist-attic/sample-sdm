import { SoftwareDeliveryMachineConfigurer } from "@atomist/sdm";
import { addSentry } from "./addSentryEditor";

export const SentrySupport: SoftwareDeliveryMachineConfigurer = {
    name: "Sentry",
    configure:
        sdm => {
            sdm.addEditors(() => addSentry);
        },
};
