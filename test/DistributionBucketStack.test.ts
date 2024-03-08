/**
 * @license
 * Copyright (c) 2024 Zach Arbon. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

import { App } from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'

import { Resource, testResourceCounts } from '.'
import { DistributionBucketStack } from '../lib'

describe(DistributionBucketStack.name, () => {
  const app = new App(),
    stack = new DistributionBucketStack(app, 's'),
    template = Template.fromStack(stack)

  testResourceCounts(template, {
    [Resource.CLOUDFRONT_DISTRIBUTION]: 1,
    [Resource.CLOUDFRONT_OAC]: 1,
    [Resource.CLOUDWATCH_DASHBOARD]: 1,
    [Resource.S3_BUCKET]: 2,
    [Resource.S3_BUCKET_POLICY]: 3,
  })
})
