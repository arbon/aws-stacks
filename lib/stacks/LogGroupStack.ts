/**
 * @license
 * Copyright (c) 2024 Zach Arbon. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

import { ServicePrincipal } from 'aws-cdk-lib/aws-iam'
import {
  ILogGroup,
  LogGroup,
  LogGroupClass,
  LogGroupProps,
  RetentionDays,
} from 'aws-cdk-lib/aws-logs'
import { Construct } from 'constructs'

import { KeyStack, KeyStackProps } from './KeyStack'

/**
 * Defines properties for a log group stack based on {@link KeyStackProps}.
 */
export interface LogGroupStackProps extends KeyStackProps {
  /**
   * The ARN of an existing log group to use.
   */
  logGroupArn?: string

  /**
   * Propteries for new log group creation.
   */
  logGroupProps?: LogGroupProps
}

/**
 * Creates an encrypted log group. Alternatively, it uses an existing log group based on ARN.
 * Extends {@link KeyStack} to provide log group and key-related features to subclasses.
 */
export class LogGroupStack extends KeyStack {
  /**
   * The log group.
   */
  readonly logGroup: ILogGroup

  /**
   * Creates an encrypted log group based on {@link KeyStack} with
   * Infrequent Access (IA) and a two year retention period.
   * Alternatively, it uses an existing log group based on ARN.
   *
   * @param scope Parent of this stack, usually an `App`.
   * @param id The construct ID of this stack.
   * @param props Stack properties as defined by `LogGroupStackProps`.
   */
  constructor(
    scope: Construct,
    id: string,
    props: Partial<LogGroupStackProps> = {}
  ) {
    super(scope, id, props)

    // Use an existing log group or create a new one.

    const logGroup = 'LogGroup'

    if (props.logGroupArn) {
      this.logGroup = LogGroup.fromLogGroupArn(
        this,
        logGroup,
        props.logGroupArn
      )
    } else {
      this.logGroup = new LogGroup(this, logGroup, {
        encryptionKey: this.key,
        logGroupClass: LogGroupClass.INFREQUENT_ACCESS,
        removalPolicy: this.dataRemovalPolicy,
        retention: RetentionDays.TWO_YEARS,
        ...props.logGroupProps,
      })

      this.logGroup.node.addDependency(this.key)
    }

    this.createLogMetrics(this.logGroup)

    this.key.grantEncryptDecrypt(
      new ServicePrincipal(`logs.${this.region}.amazonaws.com`)
    )

    this.export('LogGroupArn', this.logGroup.logGroupArn)
  }
}
