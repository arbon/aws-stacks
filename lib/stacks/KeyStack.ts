/**
 * @license
 * Copyright (c) 2024 Zach Arbon. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

import { IKey, Key, KeyProps } from 'aws-cdk-lib/aws-kms'
import { Construct } from 'constructs'

import { AppStack, AppStackProps } from './AppStack'

/**
 * Defines properties for a KMS key stack based on {@link AppStackProps}.
 */
export interface KeyStackProps extends AppStackProps {
  /**
   * The ARN of an existing KMS key.
   */
  keyArn?: string

  /**
   * The properties for creation of a new KMS key.
   */
  keyProps?: KeyProps
}

/**
 * Creates a new KMS key with rotation and a removal policy.
 * Extends {@link AppStack} to provide key-related features to subclasses.
 */
export class KeyStack extends AppStack {
  /** The KMS key. */
  readonly key: IKey

  /**
   * Creates a new KMS key with rotation and a removal policy
   * Alternatively, uses an existing key based on ARN.
   *
   * @param scope Parent of this stack, usually an `App`.
   * @param id The construct ID of this stack.
   * @param props Stack properties as defined by `KeyStackProps`.
   */
  constructor(
    scope: Construct,
    id: string,
    props: Partial<KeyStackProps> = {}
  ) {
    super(scope, id, props)

    // Use an existing key as needed.

    const key = 'Key'

    if (props.keyArn) {
      this.key = Key.fromKeyArn(this, key, props.keyArn)
    } else {
      this.key = new Key(this, key, {
        enableKeyRotation: true,
        removalPolicy: this.dataRemovalPolicy,
        ...props.keyProps,
      })
    }

    this.export('KeyArn', this.key.keyArn)
  }
}
