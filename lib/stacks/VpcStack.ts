/**
 * @license
 * Copyright (c) 2024 Zach Arbon. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

import {
  DefaultInstanceTenancy,
  FlowLogDestination,
  FlowLogTrafficType,
  IVpc,
  Vpc,
  VpcProps,
} from 'aws-cdk-lib/aws-ec2'
import { BucketProps } from 'aws-cdk-lib/aws-s3'
import { Construct } from 'constructs'

import { AppStack, AppStackProps } from './AppStack'

/**
 * Defines properties for a VPC stack based on {@link AppStackProps}.
 */
export interface VpcStackProps extends AppStackProps {
  /**
   * The id of an existing VPC.
   */
  vpcId?: string

  /**
   * The properties for creation of a new VPC.
   */
  vpcProps?: VpcProps

  /**
   * Defines properties for the flow logs bucket.
   */
  flowLogsBucketProps?: BucketProps
}

/**
 * Creates a new VPC. Alternatively, uses an existing VPC based on ARN.
 * Extends {@link AppStack} to provide VPC features to subclasses.
 */
export class VpcStack extends AppStack {
  /** The VPC. */
  vpc: IVpc

  /**
   * Creates a new VPC. For new VPCs, create S3-based flow logs (which are cheaper).
   * Alternatively, uses an existing VPC based on ARN.
   *
   * @param scope Parent of this stack, usually an `App`.
   * @param id The construct ID of this stack.
   * @param props Stack properties as defined by `VpcStackProps`.
   */
  constructor(
    scope: Construct,
    id: string,
    props: Partial<VpcStackProps> = {}
  ) {
    super(scope, id, props)

    const vpc = 'Vpc'

    if (props.vpcId) {
      this.vpc = Vpc.fromLookup(this, vpc, {
        vpcId: props.vpcId,
      })
    } else {
      // Create a bucket for flow logs.
      const logsBucket = this.createLogsBucket('FlowLogsBucket', {
        bucketName: this.appendSuffix(`${id}-logs`),
      })

      this.vpc = new Vpc(this, vpc, {
        enableDnsHostnames: true,
        enableDnsSupport: true,
        defaultInstanceTenancy: DefaultInstanceTenancy.DEFAULT,
        flowLogs: {
          s3: {
            destination: FlowLogDestination.toS3(logsBucket, 'flow-logs'),
            trafficType: FlowLogTrafficType.ALL,
          },
        },
        ...props.vpcProps,
      })
      this.vpc.applyRemovalPolicy(this.dataRemovalPolicy)
    }

    this.export('VpcId', this.vpc.vpcArn)
    this.export('VpcArn', this.vpc.vpcId)
    this.export('VpcCidrBlock', this.vpc.vpcCidrBlock)
  }
}
