/**
 * @license
 * Copyright (c) 2024 Zach Arbon. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

import { App, Environment } from 'aws-cdk-lib'
import { StackResult } from '..'
import {
  DistributionBucketStack,
  EmailTopicStack,
  KeyStack,
  LogGroupStack,
  QueueStack,
  RestApiTopicStack,
  TopicStack,
  VpcStack,
  WebBucketStack,
} from '../stacks'

/**
 * Creates a sample {@link TopicStack} app.
 * @param {App} app - The application scope or construct.
 * @returns {StackResult} Returns references to stacks and a description.
 */
export function topicApp(app: App): StackResult {
  return {
    stacks: [new TopicStack(app, 'ts')],
    description:
      'Creates an SNS topic encrypted via KMS. Adds topic metrics to a Cloudwatch dashboard.',
  }
}

/**
 * Creates a sample {@link KeyStack} app.
 * @param {App} app - The application scope or construct.
 * @returns {StackResult} Returns references to stacks and a description.
 */
export function keyApp(app: App): StackResult {
  return {
    stacks: [new KeyStack(app, 'ks')],
    description: 'Creates a KMS key with rotation and a removal policy.',
  }
}

/**
 * Creates a sample {@link LogGroupStack} app.
 * @param {App} app - The application scope or construct.
 * @returns {StackResult} Returns references to stacks and a description.
 */
export function logGroupApp(app: App): StackResult {
  return {
    stacks: [new LogGroupStack(app, 'lgs')],
    description: 'Creates a log group encrypted via KMS.',
  }
}

/**
 * Creates a sample {@link QueueStack} app.
 * @param {App} app - The application scope or construct.
 * @returns {StackResult} Returns references to stacks and a description.
 */
export function queueApp(app: App): StackResult {
  return {
    stacks: [new QueueStack(app, 'qs')],
    description:
      'Creates an encrypted SQS queue with a supporting dead-letter queue.',
  }
}

/**
 * Creates a sample {@link QueueStack} and {@link TopicStack} app.
 * @param {App} app - The application scope or construct.
 * @returns {StackResult} Returns references to stacks and a description.
 */
export function queuesApp(app: App): StackResult {
  const topicStack = new TopicStack(app, 'ts1'),
    queueStack1 = new QueueStack(app, 'qs1', {
      keyArn: topicStack.key.keyArn,
      topicArn: topicStack.topic.topicArn,
    }),
    queueStack2 = new QueueStack(app, 'qs2', {
      keyArn: topicStack.key.keyArn,
      topicArn: topicStack.topic.topicArn,
    })

  return {
    stacks: [topicStack, queueStack1, queueStack2],
    description: 'Creates an SNS topic stack with two S3 queues attached.',
  }
}

/**
 * Creates a sample {@link VpcStack} app.
 * @param {App} app - The application scope or construct.
 * @returns {StackResult} Returns references to stacks and a description.
 */
export function vpcApp(app: App): StackResult {
  return {
    stacks: [new VpcStack(app, 'vs')],
    description: 'Creates a VPC with S3-based flow logs.',
  }
}

/**
 * Creates a sample {@link WebBucketStack} app.
 * @param {App} app - The application scope or construct.
 * @param {Environment} [env] - The environment for the app.
 * @returns {StackResult} Returns references to stacks and a description.
 */
export function bucketApp(app: App, env?: Environment): StackResult {
  return {
    stacks: [
      new WebBucketStack(app, 'bs', {
        env,
      }),
    ],
    description: 'Creates S3 buckets for static web hosting.',
  }
}

/**
 * Creates a sample {@link DistributionBucketStack} app.
 * @param {App} app - The application scope or construct.
 * @returns {StackResult} Returns references to stacks and a description.
 */
export function distributionApp(app: App): StackResult {
  const domainName = 'cdn.domain.com'
  return {
    stacks: [
      new DistributionBucketStack(app, 'ds', {
        domainName: domainName,
      }),
    ],
    description: 'Creates a Cloudfront distribution with a DNS address record.',
  }
}

/**
 * Creates a sample {@link EmailTopicStack} app.
 * @param {App} app - The application scope or construct.
 * @param {Environment} [env] - The environment for the app.
 * @returns {StackResult} Returns references to stacks and a description.
 */
export function emailTopicApp(app: App, env?: Environment): StackResult {
  const domainName = 'domain.com'
  return {
    stacks: [
      new EmailTopicStack(app, 'e1', {
        domainName: domainName,
        recipients: ['events', 'messages'],
        env,
      }),
    ],
    description: 'Creates email identities and receipt rules directed to SNS.',
  }
}

/**
 * Creates a sample {@link RestApiTopicStack} app.
 * @param {App} app - The application scope or construct.
 * @returns {StackResult} Returns references to stacks and a description.
 */
export function restApiTopicApp(app: App, env?: Environment): StackResult {
  const domainName = 'messages.domain.com'
  return {
    stacks: [
      new RestApiTopicStack(app, 'rt1', {
        domainName: domainName,
        env,
      }),
    ],
    description: 'Creates a REST API that routes messages to an SNS topic.',
  }
}
