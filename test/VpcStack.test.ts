/**
 * @license
 * Copyright (c) 2024 Zach Arbon. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

import { App } from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'

import { Resource, testResourceCounts } from '.'
import { VpcStack } from '../lib'

describe(VpcStack.name, () => {
  const app = new App(),
    stack = new VpcStack(app, 'vs'),
    template = Template.fromStack(stack)

  testResourceCounts(template, {
    [Resource.EC2_EIP]: 2,
    [Resource.EC2_INTERNET_GATEWAY]: 1,
    [Resource.EC2_VPC]: 1,
  })
})
