/**
 * @license
 * Copyright (c) 2024 Zach Arbon. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

import { App } from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'

import { Resource, testResourceCounts } from '.'
import { WebBucketStack, getEnv } from '../lib'

describe(WebBucketStack.name, () => {
  const app = new App()

  const stack = new WebBucketStack(app, 'bs', {
      env: getEnv(app),
    }),
    template = Template.fromStack(stack)

  testResourceCounts(template, {
    [Resource.CLOUDWATCH_DASHBOARD]: 1,
    [Resource.KMS_KEY]: 1,
    [Resource.S3_BUCKET]: 2,
    [Resource.S3_BUCKET_POLICY]: 3,
  })
})
