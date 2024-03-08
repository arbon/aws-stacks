/**
 * @license
 * Copyright (c) 2024 Zach Arbon. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

import { App } from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'

import { Resource, testResourceCounts } from '.'
import { TopicStack } from '../lib'

describe(TopicStack.name, () => {
  const app = new App(),
    stack = new TopicStack(app, 'ts'),
    template = Template.fromStack(stack)

  testResourceCounts(template, {
    [Resource.CLOUDWATCH_DASHBOARD]: 1,
    [Resource.KMS_KEY]: 1,
    [Resource.SNS_TOPIC]: 1,
  })
})
