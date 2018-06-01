import { Configuration, HandleCommand, HandleEvent, logger } from "@atomist/automation-client";
import { Maker } from "@atomist/automation-client/util/constructionUtils";
import {
    Builder,
    CommandHandlerRegistration, DeploymentListener,
    EditorRegistration,
    enrichGoalSetters,
    ExecuteGoalWithLog,
    ExtensionPack,
    GeneratorRegistration,
    Goal,
    Goals,
    GoalSetter,
    InterpretLog,
    PushMapping,
    PushRule, PushRules,
    PushTest,
    SdmGoalImplementationMapper,
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineOptions,
    StaticPushMapping,
    Target,
} from "@atomist/sdm";
import { ListenerRegistrationManagerSupport } from "@atomist/sdm/api-helper/machine/ListenerRegistrationManagerSupport";
import { RegistrationManagerSupport } from "@atomist/sdm/api-helper/machine/RegistrationManagerSupport";
import * as _ from "lodash";

export class LocalSoftwareDeliveryMachine extends ListenerRegistrationManagerSupport implements SoftwareDeliveryMachine {

    protected readonly deploymentListeners: DeploymentListener[];

    public readonly goalFulfillmentMapper: SdmGoalImplementationMapper;

    public observesOnly: boolean;

    private pushMap: PushMapping<Goals>;

    public readonly extensionPacks: ExtensionPack[];

    private readonly registrationManager = new RegistrationManagerSupport(this);

    get pushMapping(): PushMapping<Goals> {
        return this.pushMap;
    }

    public addCommands(...cmds: Array<CommandHandlerRegistration<any>>): this {
        this.registrationManager.addCommands(...cmds);
        return this;
    }

    public addGenerators(...gens: Array<GeneratorRegistration<any>>): this {
        this.registrationManager.addGenerators(...gens);
        return this;
    }

    get commandHandlers(): Array<Maker<HandleCommand>> {
        return this.registrationManager.commandHandlers;
    }

    get eventHandlers(): Array<Maker<HandleEvent<any>>> {
        return this.registrationManager.eventHandlers;
    }

    public addEditors(...eds: EditorRegistration[]): this {
        this.registrationManager.addEditors(...eds);
        return this;
    }

    public addSupportingCommands(...e: Array<Maker<HandleCommand>>): this {
        this.registrationManager.addSupportingCommands(...e);
        return this;
    }

    public addSupportingEvents(...e: Array<Maker<HandleEvent<any>>>): this {
        this.registrationManager.addSupportingEvents(...e);
        return this;
    }

    public addBuildRules(...rules: Array<PushRule<Builder> | Array<PushRule<Builder>>>): this {
        throw new Error("BuildRules are deprecated");
    }

    public addDeployRules(...rules: Array<StaticPushMapping<Target> | Array<StaticPushMapping<Target>>>): this {
        throw new Error("DeployRules are deprecated");
    }

    public addDisposalRules(...goalSetters: GoalSetter[]): this {
        throw new Error("addDispsalRules not implemented");
    }

    public addExtensionPacks(...packs: ExtensionPack[]): this {
        for (const configurer of packs) {
            this.addExtensionPack(configurer);
            if (!!configurer.goalContributions) {
                this.pushMap = enrichGoalSetters(this.pushMap, configurer.goalContributions);
            }
        }
        return this;
    }

    private addExtensionPack(pack: ExtensionPack): this {
        logger.info("Adding extension pack '%s'", pack.name);
        pack.configure(this);
        this.extensionPacks.push(pack);
        return this;
    }

    public addGoalImplementation(implementationName: string,
                                 goal: Goal,
                                 goalExecutor: ExecuteGoalWithLog,
                                 options?: Partial<{ pushTest: PushTest; logInterpreter: InterpretLog }>): this {
        throw new Error("addGoalImplementation: not implemented");
    }

    public addVerifyImplementation(): this {
        throw new Error("addVerifyImplementation: not implemented");
    }

    public addKnownSideEffect(goal: Goal, sideEffectName: string, pushTest: PushTest): this {
        throw new Error("knownSideEffect: not implemented");
    }

    constructor(public readonly name: string,
                public readonly options: SoftwareDeliveryMachineOptions,
                public readonly configuration: Configuration,
                goalSetters: Array<GoalSetter | GoalSetter[]>) {
        super();
        this.pushMap = new PushRules("Goal setters", _.flatten(goalSetters));
    }

}
