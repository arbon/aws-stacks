/**
 * @license
 * Copyright (c) 2024 Zach Arbon. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  StackProps,
  Tags,
} from 'aws-cdk-lib'
import {
  Dashboard,
  DimensionsMap,
  GraphWidget,
  Metric,
  TextWidget,
} from 'aws-cdk-lib/aws-cloudwatch'
import { ILogGroup } from 'aws-cdk-lib/aws-logs'
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  BucketProps,
  ObjectOwnership,
  StorageClass,
} from 'aws-cdk-lib/aws-s3'
import { Construct } from 'constructs'
import { DataClassification, Package, Stage } from '..'

/**
 * Defines stack creation properties.
 * These include options for resource removal policy, data classification, development stage, etc.
 */
export interface AppStackProps extends StackProps {
  /**
   * The resource removal policy as a function of `cdk.RemovalPolicy`.
   * By default, when a resource is removed, it will be physically destroyed.
   */
  dataRemovalPolicy?: RemovalPolicy
  /**
   * The classification of application data.
   */

  dataClassification?: DataClassification
  /**
   * The SDLC development stage of the application as defined by `Stage`.
   */
  stage?: Stage
}

/**
 * Extends the base cdk.Stack class to provide common features across Stack subclasses.
 */
export abstract class AppStack extends Stack {
  /**
   * The SDLC development stage of the application as defined by `Stage`.
   */
  readonly stage: Stage
  /**
   * The resource removal policy.
   */
  readonly dataRemovalPolicy: RemovalPolicy
  /**
   * The classification of application data.
   */
  readonly dataClassification: DataClassification
  /**
   * The Cloudwatch dashboard for the stack.
   */
  dashboard: Dashboard
  /**
   * Creates a new stack, setting properties defined in {@link AppStackProps} for subclasses.
   * Sets the resource data removal policy, data classification, tags, etc.
   *
   * @param {Construct} scope Parent construct of this stack, usually an app.
   * @param {string} id The construct id or name of this stack.
   * @param {AppStackProps} [props] - Stack properties as defined by {@link AppStackProps}.
   */
  constructor(scope: Construct, id?: string, props?: AppStackProps) {
    super(scope, id, props)

    this.dataClassification =
      props?.dataClassification || DataClassification.PRIVATE
    this.dataRemovalPolicy = props?.dataRemovalPolicy || RemovalPolicy.DESTROY
    this.stage = props?.stage || Stage.DEVELOPMENT

    // Add package metadata.

    this.addMetadata('Package', {
      Name: Package.name,
      Author: Package.author,
      Version: Package.version,
      RepositoryUrl: Package?.repository?.url,
    })

    // For now, use our utility method to add tags. Ideally, these are set via props.
    // See: https://github.com/aws/aws-cdk/issues/20549

    this.addTags({
      'app:data:classification': this.dataClassification,
      'app:data:removal-policy': this.dataRemovalPolicy,
      'app:package:author': Package.author,
      'app:package:name': Package.name,
      'app:package:version': Package.version,
      'app:stage': this.stage,
    })

    this.dashboard = new Dashboard(this, 'Dashboard')
    this.dashboard.addWidgets(
      new TextWidget({
        markdown: `# ${Package.name}-${Package.version}
**Stack** ${this.stackId} / **Region** ${this.region} / **Stage** ${this.stage} / **Data Classification** ${this.dataClassification} / **Removal Policy** ${this.dataRemovalPolicy}`,
        height: 2,
        width: 24,
      })
    )
    this.dashboard.applyRemovalPolicy(this.dataRemovalPolicy)
  }

  /**
   * Creates and adds CloudWatch metrics for a specified log group to the stack's dashboard.
   *
   * This method configures metrics such as incoming bytes and log events,
   * then displays them on the CloudWatch dashboard associated with this stack.
   *
   * @param {ILogGroup} logGroup - The log group for which to create and display metrics.
   */
  createLogMetrics(logGroup: ILogGroup): void {
    const dimensionsMap: DimensionsMap = {
      LogGroupName: logGroup.logGroupName,
    }

    const incomingBytes = new Metric({
      dimensionsMap,
      namespace: 'AWS/Logs',
      metricName: 'IncomingBytes',
      statistic: 'min',
    })

    const incomingLogEvents = new Metric({
      dimensionsMap,
      namespace: 'AWS/Logs',
      metricName: 'IncomingLogEvents',
      statistic: 'sum',
    })

    this.dashboard.addWidgets(
      new GraphWidget({
        title: `Cloudwatch / Events (${logGroup.logGroupName})`,
        width: 12,
        height: 5,
        left: [incomingLogEvents],
      }),
      new GraphWidget({
        title: `Cloudwatch / Bytes (${logGroup.logGroupName})`,
        width: 12,
        height: 5,
        left: [
          incomingBytes,
          incomingBytes.with({
            statistic: 'avg',
          }),
          incomingBytes.with({
            statistic: 'max',
          }),
        ],
      })
    )
  }

  /**
   * Applies tags to the resource from key-value pairs.
   *
   * @param {Record<string, string>} tags - Key-value pairs for tags.
   * @returns {void}
   */
  addTags(tags: Record<string, string> = {}): void {
    for (const [key, value] of Object.entries(tags)) {
      Tags.of(this).add(key, value)
    }
  }

  /**
   * Creates a new encrypted S3 bucket with optional custom configurations.
   *
   * @param {string} id - The unique identifier for the bucket.
   * @param {BucketProps} [bucketProps] - Optional. Additional properties to
   * customize the bucket configuration.
   *
   * @returns {Bucket} An instance of the newly created S3 bucket.
   */
  createBucket(id: string, bucketProps?: BucketProps): Bucket {
    const bucket = new Bucket(this, id, {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_PREFERRED,
      removalPolicy: this.dataRemovalPolicy,
      ...bucketProps,
    })

    this.export(`${id}Arn`, bucket.bucketArn)
    this.export(`${id}Name`, bucket.bucketName)

    return bucket
  }

  /**
   * Creates a private, encrypted S3 bucket configured for log storage.
   *
   * This method configures the bucket with encryption and sets up lifecycle
   * rules to manage log objects efficiently.
   *
   * @param {string} id - A unique identifier for the bucket.
   * @param {BucketProps} [bucketProps] - Optional. Additional properties to
   * customize the bucket configuration. These properties will be merged with
   * the default log bucket configuration provided by this method.
   *
   * @returns {Bucket} An instance of the newly created S3 bucket.
   */
  createLogsBucket(id: string, bucketProps?: BucketProps): Bucket {
    return this.createBucket(id, {
      lifecycleRules: [
        {
          expiration: Duration.days(365),
        },
        {
          transitions: [
            {
              storageClass: StorageClass.INFREQUENT_ACCESS,
              transitionAfter: Duration.days(60),
            },
          ],
        },
      ],
      ...bucketProps,
    })
  }

  /**
   * Appends a suffix that contains, account, stage and region.
   *
   * @param value The base value to use.
   * @returns The value with a
   */
  appendSuffix(value: string) {
    return `${value}-${this.account}-${this.stage}-${this.region}`
  }

  /**
   * Gets a value for the key from the current context, potentially returning a default value.
   *
   * @param key The context key to try.
   * @param defaultValue The default value.
   * @returns The value for the key or default value, undefined.
   */
  getContextValue(key: string, defaultValue: string) {
    return this.node.tryGetContext(key) || defaultValue
  }

  /**
   * Creates a `CfnOutput` value for the stack.
   *
   * @param name The name of the output value.
   * @param value The value to export.
   * @returns The resulting `CfnOutput`
   */
  export(name: string, value: string): CfnOutput {
    return new CfnOutput(this, name, {
      exportName: `${this.stackName}:${name}`,
      value,
    })
  }
}
