#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CdkCodecommitPipelineStack } from '../lib/cdk-codecommit-pipeline-stack';

const app = new cdk.App();
new CdkCodecommitPipelineStack(app, 'CdkCodeCommitPipelineStack', {
    repositoryName: "DemoRepo"
});