/**
 * @license
 * Copyright (c) 2024 Zach Arbon. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

import {
  CfnRecordSetGroup,
  HostedZone,
  RecordType,
} from 'aws-cdk-lib/aws-route53'
import {
  EmailIdentity,
  EmailIdentityProps,
  Identity,
  ReceiptRuleSet,
  ReceiptRuleSetProps,
  TlsPolicy,
} from 'aws-cdk-lib/aws-ses'
import { Sns } from 'aws-cdk-lib/aws-ses-actions'
import { Construct } from 'constructs'
import { ServicePrincipal } from 'aws-cdk-lib/aws-iam'

import { ErrorMessage } from '..'
import { TopicStack, TopicStackProps } from './TopicStack'

/**
 * Defines properties for an email to SNS topic stack based on {@link TopicStackProps}.
 */
export interface EmailTopicProps extends TopicStackProps {
  /**
   * The subdomain for mail/topic use.
   */
  subdomain: string

  /**
   * An array of names or "local parts" used to build a list of recipients
   * given the `domainName` and `subdomain`.
   */
  recipients: string[]

  /**
   * The TLD associated with a Route53 hosted zone.
   */
  domainName: string

  /**
   * Email identity properties for custom behavior.
   */
  emailIdentityProps?: EmailIdentityProps

  /**
   * Email rule set properties for custom behavior.
   */
  receiptRuleSetProps?: ReceiptRuleSetProps
}

/**
 * Creates email identities with receipt rules that forward to SNS topics.
 */
export class EmailTopicStack extends TopicStack {
  /**
   * The default DNS subdomain for email to topic delivery.
   */
  static SUBDOMAIN: string = 'topics'

  /**
   * Creates resources to forward email to an SNS topic. Specifically:
   *
   * - a new `AWS::SES::EmailIdentity` associated with an existing Route 53 zone.
   * - a new `AWS::Route53::RecordSetGroup` for subdomain DKIM and MX records.
   * - a new `AWS::SES::ReceiptRuleSet` that maps addresses to a topic.
   * - a new or existing `AWS::KMS::Key` for encryption.
   * - a new or existing `AWS::SNS::Topic` to receive messages.
   *
   * NOTE: The SES rule set must be manually activated.
   *
   * @param scope Parent of this stack, usually an `App`.
   * @param id The construct ID of this stack.
   * @param props Stack properties as defined by `EmailTopicProps`.
   */
  constructor(
    scope: Construct,
    id: string,
    props: Partial<EmailTopicProps> = {}
  ) {
    super(scope, id, props)

    props.subdomain = props.subdomain || EmailTopicStack.SUBDOMAIN

    if (!props.domainName) {
      throw new Error(ErrorMessage.DOMAIN_NAME_REQUIRED)
    }

    if (!props.recipients || props.recipients.length < 1) {
      throw new Error(ErrorMessage.RECIPIENTS_REQUIRED)
    }

    // Get the zone from our domain name.

    const hostedZone = HostedZone.fromLookup(this, 'HostedZone', {
      domainName: props.domainName,
    })

    // Create a new identity for our subdomain.

    const mailDomain = `${props.subdomain}.${hostedZone.zoneName}`

    const identity = new EmailIdentity(this, `EmailIdentity`, {
      identity: Identity.domain(mailDomain),
      ...props.emailIdentityProps,
    })

    identity.applyRemovalPolicy(this.dataRemovalPolicy)
    this.export('EmailIdentityName', identity.emailIdentityName)

    // Create CNAME records for DKIM values. Add an MX record for inbound mail.

    const ttl = '600'
    const recordSetGroup = new CfnRecordSetGroup(this, 'RecordSetGroup', {
      hostedZoneId: hostedZone.hostedZoneId,
      recordSets: [
        {
          name: identity.dkimDnsTokenName1,
          resourceRecords: [identity.dkimDnsTokenValue1],
          type: RecordType.CNAME,
          ttl,
        },
        {
          name: identity.dkimDnsTokenName2,
          resourceRecords: [identity.dkimDnsTokenValue2],
          type: RecordType.CNAME,
          ttl,
        },
        {
          name: identity.dkimDnsTokenName3,
          resourceRecords: [identity.dkimDnsTokenValue3],
          type: RecordType.CNAME,
          ttl,
        },
        {
          name: mailDomain,
          resourceRecords: [`10 inbound-smtp.${this.region}.amazonaws.com`],
          type: RecordType.MX,
          ttl,
        },
      ],
    })

    recordSetGroup.applyRemovalPolicy(this.dataRemovalPolicy)
    recordSetGroup.node.addDependency(identity)

    // Create a receipt rule set with an SNS action for our topic.

    const receiptRuleSet = new ReceiptRuleSet(this, 'ReceiptRuleSet', {
      rules: [
        {
          actions: [
            new Sns({
              topic: this.topic,
            }),
          ],
          enabled: true,
          // Add recipients based on our mail subdomain.
          recipients: props.recipients.map((value) => {
            return `${value}@${mailDomain}`
          }),
          tlsPolicy: TlsPolicy.REQUIRE,
        },
      ],
      ...props.receiptRuleSetProps,
    })

    receiptRuleSet.applyRemovalPolicy(this.dataRemovalPolicy)
    receiptRuleSet.node.addDependency(this.topic)
    this.export('ReceiptRuleSetName', receiptRuleSet.receiptRuleSetName)

    // Update key and topic policies.

    const sesService = new ServicePrincipal('ses.amazonaws.com')
    this.topic.grantPublish(sesService)
    this.key.grantEncryptDecrypt(sesService)

    console.warn(
      EmailTopicStack.name,
      'Please activate the SES rule set.',
      `https://${this.region}.console.aws.amazon.com/ses/home?region=${this.region}#/email-receiving`
    )
  }
}
