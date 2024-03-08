/**
 * @license
 * Copyright (c) 2024 Zach Arbon. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

import { App } from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'

import { Resource, testResourceCounts } from '.'
import { EmailTopicStack, ErrorMessage, getEnv } from '../lib'

describe(EmailTopicStack.name, () => {
  const app = new App()
  const env = getEnv(app)
  const id = 'et'

  test('without domain name', () => {
    expect(() => {
      new EmailTopicStack(app, id)
    }).toThrow(ErrorMessage.DOMAIN_NAME_REQUIRED)
  })

  test('without recipients', () => {
    expect(() => {
      new EmailTopicStack(app, id, {
        domainName,
      })
    }).toThrow(ErrorMessage.RECIPIENTS_REQUIRED)
  })

  console.log(env)

  const domainName = 'test.com',
    stack = new EmailTopicStack(app, id, {
      domainName,
      env,
      recipients: ['info', 'admin'],
    }),
    template = Template.fromStack(stack)

  testResourceCounts(template, {
    [Resource.CLOUDWATCH_DASHBOARD]: 1,
    [Resource.KMS_KEY]: 1,
    [Resource.SNS_TOPIC]: 1,
    [Resource.SNS_TOPIC_POLICY]: 1,
    [Resource.SES_EMAIL_IDENTITY]: 1,
    [Resource.SES_RECEIPT_RULE]: 1,
    [Resource.SES_RECEIPT_RULE_SET]: 1,
  })
})
