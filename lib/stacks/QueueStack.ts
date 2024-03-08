/**
 * @license
 * Copyright (c) 2024 Zach Arbon. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

import { Duration } from 'aws-cdk-lib'
import { SqsSubscription } from 'aws-cdk-lib/aws-sns-subscriptions'
import { IQueue, Queue, QueueEncryption, QueueProps } from 'aws-cdk-lib/aws-sqs'
import { Construct } from 'constructs'

import { TopicStack, TopicStackProps } from './TopicStack'

/**
 * Defines properties for an SQS queue stack based on {@link TopicStackProps}.
 */
export interface QueueStackProps extends TopicStackProps {
  /**
   * Create a dead-letter queue?
   */
  deadLetterQueueEnabled: boolean
  /**
   * Propteries for dead-letter queue creation.
   */
  deadLetterQueueProps?: QueueProps
  /**
   * The ARN of an existing queue to use.
   */
  queueArn?: string
  /**
   * Propteries for queue creation.
   */
  queueProps?: QueueProps
}

/**
 * Creates SQS queues subscribed to a topic.
 * Extends {@link TopicStack} to provide SQS queue features to subclasses.
 */
export class QueueStack extends TopicStack {
  /**
   * The SQS queue.
   */
  readonly queue: IQueue

  /**
   * The SQS dead-letter queue.
   */
  readonly deadLetterQueue: IQueue

  /**
   * Creates a new SQS queue subscribed to a topic based on {@link TopicStack}.
   * Uses KMS for encryption. Adds a dead-letter queue.
   * Sets the the message retention period and the resource removal policy.
   *
   * @param scope Parent of this stack, usually an `App`.
   * @param id The construct ID of this stack.
   * @param props Stack properties as defined by `TopicStackProps`.
   */
  constructor(
    scope: Construct,
    id: string,
    props: Partial<QueueStackProps> = {}
  ) {
    super(scope, id, props)

    const queue = 'Queue'

    if (props.queueArn) {
      this.queue = Queue.fromQueueArn(this, queue, props.queueArn)
    } else {
      props.deadLetterQueueEnabled = props.deadLetterQueueEnabled || true

      if (props.deadLetterQueueEnabled) {
        this.deadLetterQueue = new Queue(this, 'DeadLetterQueue', {
          encryption: QueueEncryption.KMS,
          encryptionMasterKey: this.key,
          retentionPeriod: Duration.days(14),
          ...props.deadLetterQueueProps,
        })

        this.deadLetterQueue.applyRemovalPolicy(this.dataRemovalPolicy)

        this.export('DeadLetterQueueName', this.deadLetterQueue.queueName)
        this.export('DeadLetterQueueArn', this.deadLetterQueue.queueArn)
        this.export('DeadLetterQueueUrl', this.deadLetterQueue.queueUrl)
      }

      this.queue = new Queue(this, queue, {
        encryption: QueueEncryption.KMS,
        encryptionMasterKey: this.key,
        deadLetterQueue: props.deadLetterQueueEnabled
          ? {
              maxReceiveCount: 5,
              queue: this.deadLetterQueue,
            }
          : undefined,
        retentionPeriod: Duration.days(14),
        ...props.queueProps,
      })
    }

    this.queue.applyRemovalPolicy(this.dataRemovalPolicy)
    this.topic.addSubscription(new SqsSubscription(this.queue))

    this.export('QueueName', this.queue.queueName)
    this.export('QueueArn', this.queue.queueArn)
    this.export('QueueUrl', this.queue.queueUrl)
  }
}
