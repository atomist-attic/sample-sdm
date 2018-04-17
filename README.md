# sample-sdm

Instance of an Atomist Software Delivery Machine that can be used as a sample or run for real on your Java and TypeScript projects.

## What is a Software Delivery Machine?

>A **software delivery machine** is a development process in a box.

It automates all steps in the flow from commit to production (potentially via staging environments), and many other actions, using the consistent model provided by the Atomist *API for software*.

> Many teams have a blueprint in their mind for how they'd like to deliver software and ease their day to day work, but find it hard to realize. A Software Delivery Machine makes it possible.

The concept is explained in detail in Rod Johnson's blog [Why you need a Software Delivery Machine](https://the-composition.com/why-you-need-a-software-delivery-machine-85e8399cdfc0). This [video](https://vimeo.com/260496136) shows it in action.

Please see the [Atomist SDM library](https://github.com/atomist-github-sdm) for explanation on what an SDM can do. The present document describes how to get yours running.


## Get Started

This delivery machine feeds on the Atomist API. You'll need to be a
member of an Atomist workspace to run it. <!-- TODO: reference auth
story --> Create your own by
[enrolling](https://github.com/atomist/welcome/blob/master/enroll.md)
at [atomist.com](https://atomist.com/).

Things work best if you install an org webhook, so that Atomist receives events for all your GitHub repos.

## Get your Software Delivery Machine

If the Atomist bot is in your Slack team, type `@atomist create sdm`
to have Atomist create a personalized version of this repository for
you.

Alternatively, you can fork and clone this repository.

## Running

Below are instructions for running locally and on Kubernetes.  See
[integrations](#Integrations) for additional prerequisites according
to the projects you're building.

### Locally

This is an Atomist automation client. See [run an automation
client](https://github.com/atomist/welcome/blob/master/runClient.md)
for instructions on how to set up your environment and run it under
Node.js.

The client logs to the console so you can see it go.

### Kubernetes

You can use the Kubernetes resource files in the [kube
directory][kube] as a starting point for deploying this automation in
your Kubernetes cluster.

This SDM needs write access to jobs and read-access to deployments in
its namespaces.  It uses the Kubernetes "in-cluster client" to
authenticate against the Kubernetes API.  Depending on whether your
cluster is using [role-based access control (RBAC)][rbac] or not, you
must deploy slightly differently.  RBAC is a feature of more recent
versions of Kubernetes, for example it is enabled by default on [GKE
clusters][gke-rbac] using Kubernetes 1.6 and higher.  If your cluster
is older or is not using RBAC, the default system account provided to
all pods should have sufficient permissions to run this SDM.

Before deploying either with or without RBAC, you will need to create
a namespace for the resources and a secret with the configuration.
The only required configuration values are the `teamIds` and `token`.
The `teamIds` should be your Atomist team ID(s), which you can get
from the settings page for your Atomist workspace or by sending `team`
as a message to the Atomist bot, e.g., `@atomist team`, in Slack.  The
`token` should be a [GitHub personal access token][ghpat] with
`read:org` and `repo` scopes.

```console
$ kubectl apply -f https://raw.githubusercontent.com/atomist/sample-sdm/master/assets/kube/namespace.yaml
$ kubectl create secret --namespace=sdm generic automation \
    --from-literal=config='{"teamIds":["TEAM_ID"],"token":"TOKEN"}'
```

In the above commands, replace `TEAM_ID` with your Atomist team ID,
and `TOKEN` with your GitHub token.

[kube]: ./assets/kube/ (Kubernetes Resources)
[rbac]: https://kubernetes.io/docs/admin/authorization/rbac/ (Kubernetes RBAC)
[gke-rbac]: https://cloud.google.com/kubernetes-engine/docs/how-to/role-based-access-control (GKE RBAC)
[ghpat]: https://github.com/settings/tokens (GitHub Personal Access Tokens)

### RBAC

If your Kubernetes cluster uses RBAC (minikube does), you can deploy with the
following commands

```console
$ kubectl apply -f https://raw.githubusercontent.com/atomist/sample-sdm/master/assets/kube/rbac.yaml
$ kubectl apply -f https://raw.githubusercontent.com/atomist/sample-sdm/master/assets/kube/deployment-rbac.yaml
```

If you get the following error when running the first command,

```
Error from server (Forbidden): error when creating "rbac.yaml": clusterroles.rbac.authorization.k8s.io "sample-sdm-clusterrole" is forbidden: attempt to grant extra privileges: [...] user=&{YOUR_USER  [system:authenticated] map[]} ownerrules=[PolicyRule{Resources:["selfsubjectaccessreviews"], APIGroups:["authorization.k8s.io"], Verbs:["create"]} PolicyRule{NonResourceURLs:["/api" "/api/*" "/apis" "/apis/*" "/healthz" "/swagger-2.0.0.pb-v1" "/swagger.json" "/swaggerapi" "/swaggerapi/*" "/version"], Verbs:["get"]}] ruleResolutionErrors=[]
```

then your Kubernetes user does not have administrative privileges on
your cluster.  You will either need to ask someone who has admin
privileges on the cluster to create the RBAC resources or try to
escalate your privileges with the following command.

```console
$ kubectl create clusterrolebinding cluster-admin-binding --clusterrole cluster-admin \
    --user YOUR_USER
```

If you are running on GKE, you can supply your user name using the
`gcloud` utility.

```console
$ kubectl create clusterrolebinding cluster-admin-binding --clusterrole cluster-admin \
    --user $(gcloud config get-value account)
```

Then run the command to create the `kube/rbac.yaml` resources again.

### Without RBAC

To deploy on clusters without RBAC, run the following commands

```console
$ kubectl apply -f https://raw.githubusercontent.com/atomist/sample-sdm/master/assets/kube/deployment-no-rbac.yaml
```

If the logs from the pod have lines indicating a failure to access the
Kubernetes API, then the default service account does not have read
permissions to pods and you likely need to deploy using RBAC.

## Using the SDM

Once this SDM is running, here are some things to do:

### Start a new project

In Slack, `@atomist create spring`. This will create a Spring Boot repository. The SDM will build it!

To enable deployment beyond the local one, `@atomist enable deploy`.

### Push to an existing repository

If you have any Java or Node projects in your GitHub org, try linking one to a Slack channel (`@atomist link repo`), and then push to it.
You'll see Atomist react to the push, and the SDM might have some Goals it can complete.

### Customize

Every organization has a different environment and different needs. Your software delivery machine is yours: change the code and do what helps you.

In `atomist.config.ts`, you can choose the `machine` to start with. `cloudFoundryMachine` and `k8sMachine` take care of the whole delivery process from project creation through deployment, while other machines focus only on one aspect, such as project creation, static analysis or autofixing problems in repositories.

> Atomist is about developing your development experience by using your coding skills. Change the code, restart, and see your new automations and changed behavior across all your projects, within seconds.

The rest of this README describes some changes you might make.

## About this Software Delivery Machine

### Implementations of Atomist

Atomist is a flexible system, enabling you to build your own automations or use those provided by Atomist or third parties.

This repository is a *reference implementation* of Atomist, which focuses on the goals of a typical delivery
 flow. You can fork it and modify it as the starting point for your own Atomist implementation,
 or use it purely as a reference.

### Concepts

This repository shows how Atomist can automate important tasks and improve your delivery flow. Specifically:

-   How Atomist **command handlers** can be used to create services
    the right way every time, and help keep them up to date
-   How Atomist **event handlers** can drive and improve a custom delivery experience, from commit through
    to deployment and testing

It demonstrates Atomist as the *API for software*, exposing

-   *What we know*: The Atomist cortex, accessible through GraphQL queries and subscription joins
-   *What just happened*: An event, triggered by a GraphQL subscription, which is contextualized with the existing knowledge
-   *What you're working on*: A library that enables you to comprehend and manipulate the source code you're working on.

Atomist is not tied to GitHub, but this repository focuses on using Atomist with GitHub.com or
GitHub Enterprise.

### Key Functionality

The following key functionality of this project will be available when
you run this automation client in your team:

-   *Project creation for Spring*. Atomist is not Spring specific, but
    we use Spring boot as an illustration here. Try `@atomist create
    spring`. The seed project used by default will be
    `spring-team/spring-rest-seed`.
    -   If you want to add or modify the content of generated
        projects, modify `CustomSpringBootGeneratorParameters.ts` to
        specify your own seed. Just about any Spring Boot project will
        work as the transformation of a seed project is quite
        forgiving, and parses the seed to find the location and name
        of the `@SpringBootApplication` class, rather than relying on
        hard coding.
    -   To perform sophisticated changes, such as dynamically
        computing content, modify the code in
        `springBootGenerator.ts`.
-   *Delivery pipeline to either Kubernetes or Pivotal Cloud Foundry
    for Spring Boot projects*. This includes automatic local
    deployment of non-default branches on the same node as the
    automation client. The delivery pipeline is automatically
    triggered on pushes.
-   *Upgrading Spring Boot version* across one or many
    repositories. Try `@atomist try to upgrade spring boot`. This will
    create a branch upgrading to Spring Boot `1.5.9` and wait for the
    build to complete. If the build succeeds, a PR will be created; if
    it fails, an issue will be created linking to the failed build log
    and offending branch. To choose a specific Spring Boot version, or
    see what happens when a bogus version triggers a failure, try
    `@atomist try to upgrade spring boot
    desiredBootVersion=<version>`. If you run such a command in a
    channel linked to an Atomist repository, it will affect only that
    repository. If you run it in a channel that is not linked, it will
    affect all repositories by default. You can add a
    `targets.repos=<regex>` parameter to specify a regular expression
    to target a subset of repo names. For example: `@atomist try to
    upgrade spring boot targets.repos=test.*`.


## Plugging in Third Party Tools

This repo shows the use of Atomist to perform many steps itself.
 However, each of the goals used by Atomist here is pluggable.

It's also easy to integrate third party tools like Checkstyle.

### Integrating CI tools

One of the tools you are most likely to integrate is CI. For example,
you can integrate Jenkins, Travis or Circle CI with Atomist so that
these tools are responsible for build. This has potential advantages
in terms of scheduling and repeatability of environments.

Integrating a CI tool with Atomist is simple. Simply invoke Atomist hooks to send events around build and artifact creation.

If integrating CI tools, we recommend the following:

-   CI tools are great for building and generating artifacts. They are
    often abused as a PaaS for `bash`. If you find your CI usage has
    you programming in `bash` or YML, consider whether invoking such
    operations from Atomist event handlers might be a better model.
-   Use Atomist generators to create your CI files, and Atomist
    editors to keep them in synch, minimizing inconsistency.

#### Example: Integrating Travis

tbd

### Integrating APM tools

### Integrating with Static Analysis Tools

Any tool that runs on code, such as Checkstyle, can easily be integrated.
Just call the tools CLI.

## Integrations

### Choose a machine

You must set environment variables to choose a machine, if you override the default.

```
export MACHINE_PATH="./software-delivery-machine/machines"
export MACHINE_NAME="cloudFoundrySoftwareDeliveryMachine"
```

### Local HTTP server

To run a local HTTP server to invoke via `curl` or for smoke testing, please set the following environment variable:

```
export LOCAL_ATOMIST_ADMIN_PASSWORD="<value>"

```

### Java

To build Java projects on the automation client node, you'll need:

-   JDK, for Maven and Checkstyle
-   Maven, with `mvn` on the path

### Node

To build Node projects on the automation client node, you'll need:

-   `npm` - v 5.8.0 or above
-   `node`

### Cloud Foundry

In order to enable Pivotal Cloud Foundry deployment, the following
environment variables are used.

Required:

-   `PIVOTAL_USER`: your Pivotal Cloud Foundry user name
-   `PIVOTAL_PASSWORD`: your Pivotal Cloud Foundry password
-   `PCF_ORG`: your Pivotal Cloud Foundry organization name
-   `PCF_SPACE_STAGING`: your Pivotal Cloud Foundry staging space name within `$PCF_ORG`
-   `PCF_SPACE_PRODUCTION`: your Pivotal Cloud Foundry production space name within `$PCF_ORG`

Optional:

-   `PIVOTAL_API`: PCF API to hit. Default if this key is not provided
    is Pivotal Web Services at `https://api.run.pivotal.io`. Specify a
    different value to deploy to your own Cloud Foundry instance.


### Kubernetes

The kubernetesSoftwareDevelopmentMachine included here deploys to your
Kubernetes cluster, using
[k8-automation](https://github.com/atomist/k8-automation), which you
must run in your cluster.  To deploy to Kubernetes using this SDM and
k8-automation, set the `MACHINE_NAME` environment variable to
`k8sMachine` before starting the SDM.

### Checkstyle

Checkstyle is a style-checker for Java.
For the optional Checkstyle integration to work, set up two Checkstyle environment variables as follows:

```
# Toggle Checkstyle usage
export USE_CHECKSTYLE=true

# Path to checkstyle JAR
export CHECKSTYLE_PATH="/Users/rodjohnson/tools/checkstyle-8.8/checkstyle-8.8-all.jar"
```

Get `checkstyle-8.8-all.jar` from [Checkstyle's download page](https://sourceforge.net/projects/checkstyle/files/checkstyle/8.8/).
