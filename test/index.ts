/**
 * @license
 * Copyright (c) 2024 Zach Arbon. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

import { Template } from 'aws-cdk-lib/assertions'

/**
 * Defines CloudFormation resources.
 */
export enum Resource {
  CLOUDFRONT_DISTRIBUTION = 'AWS::CloudFront::Distribution',
  CLOUDFRONT_OAC = 'AWS::CloudFront::OriginAccessControl',
  CLOUDWATCH_DASHBOARD = 'AWS::CloudWatch::Dashboard',
  EC2_EIP = 'AWS::EC2::EIP',
  EC2_INTERNET_GATEWAY = 'AWS::EC2::InternetGateway',
  EC2_VPC = 'AWS::EC2::VPC',
  KMS_KEY = 'AWS::KMS::Key',
  LOGS_LOG_GROUP = 'AWS::Logs::LogGroup',
  ROUTE_53_RECORD_SET_GROUP = 'AWS::Route53::RecordSetGroup',
  S3_BUCKET = 'AWS::S3::Bucket',
  S3_BUCKET_POLICY = 'AWS::S3::BucketPolicy',
  SES_EMAIL_IDENTITY = 'AWS::SES::EmailIdentity',
  SES_RECEIPT_RULE = 'AWS::SES::ReceiptRule',
  SES_RECEIPT_RULE_SET = 'AWS::SES::ReceiptRuleSet',
  SNS_TOPIC = 'AWS::SNS::Topic',
  SNS_TOPIC_POLICY = 'AWS::SNS::TopicPolicy',
  SQS_QUEUE = 'AWS::SQS::Queue',
  SQS_QUEUE_POLICY = 'AWS::SQS::QueuePolicy',
}

/**
 * Tests that the template contains the correct number of resources.
 *
 * @param template The CloudFormation template generated from the stack.
 * @param resourceCounts An object mapping resource types to their expected counts.
 */
export function testResourceCounts(
  template: Template,
  resourceCounts: { [resourceType: string]: number }
) {
  Object.entries(resourceCounts).forEach(([resourceType, count]) => {
    test(`has ${count} ${resourceType} resource${count > 1 ? 's' : ''}`, () => {
      template.resourceCountIs(resourceType, count)
    })
  })
}
