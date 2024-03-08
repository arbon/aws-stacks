/**
 * @license
 * Copyright (c) 2024 Zach Arbon. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

import * as cdk from 'aws-cdk-lib'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as kms from 'aws-cdk-lib/aws-kms'
import * as s3 from 'aws-cdk-lib/aws-s3'
import { Construct } from 'constructs'
import { GraphWidget, Metric } from 'aws-cdk-lib/aws-cloudwatch'

import { CloudWatchStorageType } from '..'
import { AppStack, AppStackProps } from './AppStack'

/**
 * Defines properties for a bucket stack based on {@link AppStackProps}.
 */
export interface WebBucketStackProps extends AppStackProps {
  /**
   * Defines the S3 bucket for regional replication.
   */
  replicaBucket?: s3.Bucket
  /**
   * Defines the KMS key used for replication bucket encryption.
   */
  replicaBucketKey?: kms.IKey
  /**
   * Defines the object expiration period.
   */
  dataExpiration?: cdk.Duration
  /**
   * Defines the object transition period.
   */
  dataTransition?: cdk.Duration
  /**
   * Defines the storage class to transition to.
   */
  dataTransitionClass?: s3.StorageClass
  /**
   * Defines the expiration period for older versions of objects.
   */
  dataVersionExpiration?: cdk.Duration
}

/**
 * Provides a stack that creates S3 buckets for web content. Features include:
 * - Bucket objects are private and encrypted via SSE with a master key managed by S3.
 * - Lifecycle rules to transition and expire older objects are defined.
 * - Cross-region replication is supported given a `replicaBucket` and `replicaBucketKey`.
 * - Resources implement a standard removal policy.
 */
export class WebBucketStack extends AppStack {
  /**
   * Provides a bucket for logs.
   */
  logsBucket: s3.Bucket

  /**
   * Provides a bucket for content.
   */
  contentBucket: s3.Bucket

  /**
   * The KMS key used for bucket encryption.
   */
  bucketKey: kms.IKey

  crossRegionReferences: true
  dataExpiration: cdk.Duration
  dataTransition: cdk.Duration
  dataTransitionClass: s3.StorageClass
  dataVersionExpiration: cdk.Duration
  replicaBucket?: s3.Bucket | undefined
  replicaBucketKey?: kms.IKey | undefined

  /**
   * Creates a new web bucket stack with a handful of resources, by default:
   *
   * - AWS::CloudWatch::Dashboard
   * - AWS::S3::Bucket (x2)
   * - AWS::S3::BucketPolicy (x2)
   *
   * @param scope Parent of this stack, usually an `App`
   * @param id The construct ID of this stack.
   * @param props Stack properties as defined by `WebBucketStackProps`.
   */
  constructor(scope: Construct, id: string, props?: WebBucketStackProps) {
    super(scope, id, props)

    this.dataExpiration = props?.dataExpiration || cdk.Duration.days(365)
    this.dataTransition = props?.dataTransition || cdk.Duration.days(60)
    this.dataTransitionClass =
      props?.dataTransitionClass || s3.StorageClass.INFREQUENT_ACCESS
    this.dataVersionExpiration =
      props?.dataVersionExpiration || cdk.Duration.days(30)
    this.replicaBucket = props?.replicaBucket
    this.replicaBucketKey = props?.replicaBucketKey

    // Establish the key used for bucket encryption.
    // TODO: Support other KMS keys; Cloudfront may have issues.

    this.bucketKey = kms.Key.fromLookup(this, 'Key', {
      aliasName: 'alias/aws/s3',
    })

    // Create a bucket for server logs?

    this.logsBucket = this.createLogsBucket('Logs', {
      bucketName: `${id}-logs-${this.account}-${this.stage}-${this.region}`,
    })

    // Create a bucket for content.

    const serverAccessLogsPrefix = 'server/'

    this.contentBucket = this.createBucket('Content', {
      bucketName: this.appendSuffix(`${id}-content`),
      lifecycleRules: [
        {
          noncurrentVersionExpiration: this.dataVersionExpiration,
        },
      ],
      serverAccessLogsBucket: this.logsBucket,
      serverAccessLogsPrefix: serverAccessLogsPrefix,
      versioned: true,
    })

    this.createBucketMetrics(this.contentBucket)
    this.createBucketMetrics(
      this.logsBucket,
      CloudWatchStorageType.STANDARD_IA_STORAGE
    )

    // Enable regional replication?
    // Create a replication role and add a replication configuration to the content bucket.

    if (!this.replicaBucket || !this.replicaBucketKey) {
      return
    }

    const replicationRole = new iam.Role(this, 'ReplicationRole', {
      assumedBy: new iam.ServicePrincipal('s3.amazonaws.com'),
    })

    replicationRole.applyRemovalPolicy(this.dataRemovalPolicy)

    // Allow retrieval of object lists, tags, ACLs, etc.
    // See: https://docs.aws.amazon.com/service-authorization/latest/reference/list_amazons3.html#amazons3-resources-for-iam-policies

    replicationRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          's3:GetObjectVersionAcl',
          's3:GetObjectVersionForReplication',
          's3:GetObjectVersionTagging',
          's3:GetReplicationConfiguration',
          's3:ListBucket',
        ],
        resources: [
          this.contentBucket.bucketArn,
          `${this.contentBucket.bucketArn}/*`,
        ],
      })
    )

    // Allow decryption via S3 for content bucket objects.
    replicationRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['kms:Decrypt'],
        resources: [this.bucketKey.keyArn],
        conditions: {
          StringLike: {
            'kms:ViaService': `s3.${this.region}.amazonaws.com`,
            'kms:EncryptionContext:aws:s3:arn': [
              `${this.contentBucket.bucketArn}/*`,
            ],
          },
        },
      })
    )

    // Allow encryption via S3 for replica bucket objects.
    replicationRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['kms:Encrypt'],
        resources: [this.replicaBucketKey.keyArn],
        conditions: {
          StringLike: {
            'kms:ViaService': `s3.${this.region}.amazonaws.com`,
            'kms:EncryptionContext:aws:s3:arn': [
              `${this.replicaBucket.bucketArn}/*`,
            ],
          },
        },
      })
    )

    // Allow replication actions for replica bucket objects.
    replicationRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          's3:ReplicateDelete',
          's3:ReplicateObject',
          's3:ReplicateTags',
        ],
        resources: [`${this.replicaBucket.bucketArn}/*`],
      })
    )

    // Add a replication configuration to the bucket.
    const bucket = this.contentBucket.node.defaultChild as s3.CfnBucket

    bucket &&
      bucket.addPropertyOverride('ReplicationConfiguration', {
        Role: replicationRole.roleArn,
        Rules: [
          {
            Destination: {
              Bucket: this.replicaBucket.bucketArn,
            },
            Status: 'Enabled',
          },
        ],
      })
  }

  /**
   * Creates metrics associated with S3 buckets.
   * Adds metrics to the stack dashboard.
   */
  createBucketMetrics(
    bucket: s3.Bucket,
    storageType: CloudWatchStorageType = CloudWatchStorageType.STANDARD_STORAGE
  ): void {
    this.dashboard.addWidgets(
      new GraphWidget({
        title: `S3 / Size & Objects (${bucket.bucketName})`,
        width: 24,
        height: 6,
        left: [
          new Metric({
            dimensionsMap: {
              BucketName: bucket.bucketName,
              StorageType: storageType,
            },
            namespace: 'AWS/S3',
            metricName: 'BucketSizeBytes',
            statistic: 'avg',
          }),
        ],
        right: [
          new Metric({
            dimensionsMap: {
              BucketName: bucket.bucketName,
              StorageType: 'AllStorageTypes',
            },
            namespace: 'AWS/S3',
            metricName: 'NumberOfObjects',
            statistic: 'avg',
          }),
        ],
      })
    )
  }
}
