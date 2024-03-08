/**
 * @license
 * Copyright (c) 2024 Zach Arbon. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

import { DimensionsMap, GraphWidget, Metric } from 'aws-cdk-lib/aws-cloudwatch'
import { ITopic, Topic, TopicProps } from 'aws-cdk-lib/aws-sns'
import { EmailSubscription } from 'aws-cdk-lib/aws-sns-subscriptions'
import { Construct } from 'constructs'

import { KeyStack, KeyStackProps } from './KeyStack'

/**
 * Defines properties for an SNS topic stack based on {@link KeyStackProps}.
 */
export interface TopicStackProps extends KeyStackProps {
  /**
   * The ARN of an existing topic to use.
   */
  topicArn?: string

  /**
   * Propteries for new topic creation.
   */
  topicProps?: TopicProps

  /**
   * Defines one or more email addresses for topic subscription(s).
   */
  emailSubscribers?: string[]
}

/**
 * Creates new SNS topics encrypted via KMS keys based on {@link KeyStack}.
 */
export class TopicStack extends KeyStack {
  /**
   * The SNS topic.
   */
  readonly topic: ITopic

  /**
   * Creates new SNS topics encrypted via KMS keys based on {@link KeyStack}
   * Alternatively, uses an existing topic based on ARN.
   * Adds resrouce removal policies and cloudwatch metrics for new topics.
   * Optionally, adds email subscriptions.
   *
   * @param scope Parent of this stack, usually an `App`.
   * @param id The construct ID of this stack.
   * @param props Stack properties as defined by `LogGroupStackProps`.
   */
  constructor(
    scope: Construct,
    id: string,
    props: Partial<TopicStackProps> = {}
  ) {
    super(scope, id, props)

    const topic = 'Topic'

    if (props.topicArn) {
      this.topic = Topic.fromTopicArn(this, topic, props.topicArn)
    } else {
      this.topic = new Topic(this, topic, {
        masterKey: this.key,
        ...props.topicProps,
      })

      this.topic.node.addDependency(this.key)
      this.topic.applyRemovalPolicy(this.dataRemovalPolicy)
    }

    props.emailSubscribers &&
      props.emailSubscribers.forEach((emailAddress) => {
        this.topic.addSubscription(new EmailSubscription(emailAddress))
      })

    this.export('TopicArn', this.topic.topicArn)
    this.createTopicMetrics(this.topic)
  }

  /**
   * Creates Cloudwatch dashboard widgets.
   */
  createTopicMetrics(topic: ITopic): void {
    const dimensionMap: DimensionsMap = {
      TopicName: topic.topicName,
    }

    const publishSize = new Metric({
      dimensionsMap: dimensionMap,
      namespace: 'AWS/SNS',
      metricName: 'PublishSize',
      statistic: 'min',
    })

    this.dashboard.addWidgets(
      new GraphWidget({
        title: `SNS / Messages (${topic.topicName})`,
        width: 12,
        height: 5,
        left: [
          new Metric({
            dimensionsMap: dimensionMap,
            namespace: 'AWS/SNS',
            metricName: 'NumberOfMessagesPublished',
            statistic: 'sum',
            label: 'Published',
          }),
          new Metric({
            dimensionsMap: dimensionMap,
            namespace: 'AWS/SNS',
            metricName: 'NumberOfNotificationsDelivered',
            statistic: 'sum',
            label: 'Delivered',
          }),
        ],
        right: [
          new Metric({
            dimensionsMap: dimensionMap,
            namespace: 'AWS/SNS',
            metricName: 'NumberOfNotificationsFailed',
            statistic: 'sum',
            label: 'Failed',
          }),
        ],
      }),
      new GraphWidget({
        title: `SNS / Message Size (${topic.topicName})`,
        width: 12,
        height: 5,
        left: [
          publishSize,
          publishSize.with({
            statistic: 'avg',
          }),
          publishSize.with({
            statistic: 'max',
          }),
        ],
        right: [
          publishSize.with({
            statistic: 'sum',
          }),
        ],
      })
    )
  }
}
