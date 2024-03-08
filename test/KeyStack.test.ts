/**
 * @license
 * Copyright (c) 2024 Zach Arbon. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

import { App } from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'

import { Resource, testResourceCounts } from '.'
import { KeyStack } from '../lib'

const defaultRemovalPolicy = 'Delete'

describe(KeyStack.name, () => {
  const app = new App(),
    stack = new KeyStack(app, 'ks'),
    template = Template.fromStack(stack)

  testResourceCounts(template, {
    [Resource.CLOUDWATCH_DASHBOARD]: 1,
    [Resource.KMS_KEY]: 1,
  })

  test('key has deletion and update/replace policies', () => {
    template.hasResource(Resource.KMS_KEY, {
      DeletionPolicy: defaultRemovalPolicy,
      UpdateReplacePolicy: defaultRemovalPolicy,
    })
  })

  test('log group has deletion and update/replace policies', () => {
    template.hasResource(Resource.CLOUDWATCH_DASHBOARD, {
      DeletionPolicy: defaultRemovalPolicy,
      UpdateReplacePolicy: defaultRemovalPolicy,
    })
  })

  test('has the correct properties', () => {
    template.hasResourceProperties(Resource.KMS_KEY, {
      EnableKeyRotation: true,
      KeyPolicy: {
        Statement: [
          {
            Action: 'kms:*',
            Effect: 'Allow',
            Principal: {
              AWS: {
                'Fn::Join': [
                  '',
                  [
                    'arn:',
                    {
                      Ref: 'AWS::Partition',
                    },
                    ':iam::',
                    {
                      Ref: 'AWS::AccountId',
                    },
                    ':root',
                  ],
                ],
              },
            },
            Resource: '*',
          },
        ],
        Version: '2012-10-17',
      },
    })
  })
})
