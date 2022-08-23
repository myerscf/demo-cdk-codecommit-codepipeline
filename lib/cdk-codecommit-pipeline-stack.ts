import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Repository } from 'aws-cdk-lib/aws-codecommit';
import { Artifact, Pipeline } from "aws-cdk-lib/aws-codepipeline";
import { BuildSpec, PipelineProject } from "aws-cdk-lib/aws-codebuild";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as iam from 'aws-cdk-lib/aws-iam';

interface CodecommitPipelineProps extends cdk.StackProps {
    readonly repositoryName: string;
    readonly pipelineName?: string;
}

export class CdkCodecommitPipelineStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: CodecommitPipelineProps) {
        super(scope, id, props);

        const repo = new Repository(this, 'CodeCommitRepository', {
            repositoryName: props.repositoryName
        });

        const pipeline = new Pipeline(this, 'CodePipeline', {
            pipelineName: props.pipelineName ?? 'CdkDeploymentPipeline',
        });

        const sourceOutput = new Artifact();

        const sourceAction = new codepipeline_actions.CodeCommitSourceAction({
            actionName: 'CodeCommit',
            repository: repo,
            output: sourceOutput,
            branch: 'main',
        });

        pipeline.addStage({
            stageName: 'Source',
            actions: [sourceAction],
        });

        const buildProject = new PipelineProject(this, 'BuildProject', {
            environment: {
                buildImage: codebuild.LinuxBuildImage.STANDARD_6_0,
                computeType: codebuild.ComputeType.MEDIUM,
            },
            buildSpec: BuildSpec.fromObjectToYaml({
                version: 0.2,
                phases: {
                    install: {
                        "runtime-versions": {
                            nodejs: "16"
                        },
                        commands: [
                            'npm install -g aws-cdk',
                            'npm install -g typescript',
                        ]
                    },
                    build: {
                        commands: [
                            'cdk --version',
                            'npm ci',
                            'npm run build',
                            'cdk bootstrap',
                            'cdk deploy --all --force --require-approval=never',
                        ]
                    },
                },
            }),
        });

        const buildAction = new codepipeline_actions.CodeBuildAction({
            actionName: 'CDK_Build_and_Deploy',
            project: buildProject,
            input: sourceOutput,
            outputs: [new Artifact()], // optional
        });

        const buildStage = pipeline.addStage({
            stageName: 'Build',
            actions: [
                buildAction
            ]
        });

        buildProject.addToRolePolicy(this.getDeployCommonPolicy());

        // this is bad, but use to test deployments when requirements of stack are unknown
        // buildProject.role?.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'));
    }

    private getDeployCommonPolicy(): iam.PolicyStatement {
        const statement = new iam.PolicyStatement();
        statement.addActions(
            "cloudformation:*",
            "lambda:*",
            "s3:*",
            "ssm:*",
            "iam:PassRole",
            "kms:*",
            "events:*",
            "sts:AssumeRole"
        );
        statement.addResources("*");
        return statement;
    }
}
