/**
 * @license
 * Copyright (c) 2024 Zach Arbon. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

import { App } from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'

import { Resource, testResourceCounts } from '.'
import { QueueStack } from '../lib'

describe(QueueStack.name, () => {
  const app = new App(),
    stack = new QueueStack(app, 'qs'),
    template = Template.fromStack(stack)

  testResourceCounts(template, {
    [Resource.CLOUDWATCH_DASHBOARD]: 1,
    [Resource.KMS_KEY]: 1,
    [Resource.SNS_TOPIC]: 1,
    [Resource.SQS_QUEUE]: 2,
    [Resource.SQS_QUEUE_POLICY]: 1,
  })

  // template.hasResourceProperties('AWS::CloudWatch::Alarm', {
  //   Namespace: 'AWS/SQS',
  //   MetricName: 'ApproximateNumberOfMessagesVisible',
  //   Dimensions: [
  //     {
  //       Name: 'QueueName',
  //       Value: Match.anyValue(),
  //     },
  //   ],
  // })
})
