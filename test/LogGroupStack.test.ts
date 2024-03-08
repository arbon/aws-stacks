/**
 * @license
 * Copyright (c) 2024 Zach Arbon. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

import { App } from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'

import { Resource, testResourceCounts } from '.'
import { LogGroupStack } from '../lib'

const defaultRemovalPolicy = 'Delete'

describe(LogGroupStack.name, () => {
  const app = new App(),
    stack = new LogGroupStack(app, 'lgs'),
    template = Template.fromStack(stack)

  testResourceCounts(template, {
    [Resource.CLOUDWATCH_DASHBOARD]: 1,
    [Resource.KMS_KEY]: 1,
    [Resource.LOGS_LOG_GROUP]: 1,
  })

  test('key has deletion and update/replace policies', () => {
    template.hasResource(Resource.KMS_KEY, {
      DeletionPolicy: defaultRemovalPolicy,
      UpdateReplacePolicy: defaultRemovalPolicy,
    })
  })

  test('dashboard has deletion and update/replace policies', () => {
    template.hasResource(Resource.CLOUDWATCH_DASHBOARD, {
      DeletionPolicy: defaultRemovalPolicy,
      UpdateReplacePolicy: defaultRemovalPolicy,
    })
  })

  test('log group has deletion and update/replace policies', () => {
    template.hasResource(Resource.LOGS_LOG_GROUP, {
      DeletionPolicy: defaultRemovalPolicy,
      UpdateReplacePolicy: defaultRemovalPolicy,
    })
  })
})
