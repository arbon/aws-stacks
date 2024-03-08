/**
 * @license
 * Copyright (c) 2024 Zach Arbon. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

import {
  Certificate,
  CertificateValidation,
} from 'aws-cdk-lib/aws-certificatemanager'
import {
  CachePolicy,
  CfnDistribution,
  CfnOriginAccessControl,
  CloudFrontAllowedCachedMethods,
  CloudFrontAllowedMethods,
  CloudFrontWebDistribution,
  HttpVersion,
  IDistribution,
  OriginRequestPolicy,
  PriceClass,
  ResponseHeadersPolicy,
  SecurityPolicyProtocol,
  ViewerCertificate,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront'
import {
  AnyPrincipal,
  Effect,
  PolicyStatement,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam'
import {
  ARecord,
  HostedZone,
  IHostedZone,
  RecordTarget,
} from 'aws-cdk-lib/aws-route53'
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets'
import { Bucket, BucketPolicy } from 'aws-cdk-lib/aws-s3'
import { Construct } from 'constructs'

import { WebBucketStack, WebBucketStackProps } from './WebBucketStack'

/**
 * Defines properties for a bucket stack.
 */
export interface DistributionBucketStackProps extends WebBucketStackProps {
  /**
   * Defines the domain name to be used by the distribution.
   * The TLD should be from an existing Route 53 hosted zone.
   */
  domainName?: string
}

/**
 * Creates Cloudfront distributions with S3 origins.
 */
export class DistributionBucketStack extends WebBucketStack {
  /**
   * The ACM certificate.
   */
  certificate: Certificate | undefined

  /**
   * Defines the root path object to serve.
   */
  readonly defaultRootObject = 'index.html'

  /**
   * Defines the prefix for Cloudfront logs.
   */
  readonly distributionLogsPrefix = 'distribution'

  /**
   * The Cloudfront distribution.
   */
  distribution: IDistribution

  /**
   * The Route53 hosted zone.
   */
  hostedZone: IHostedZone | undefined

  /**
   * The viewer certificate configuration.
   */
  viewerCertificate: ViewerCertificate | undefined

  /**
   * Creates a Cloudfront distribution backed by an S3 bucket origin
   * based on {@link WebBucketStack}. Supports TLS via ACM certificates and
   * origin access controls. Provides basic error handling.
   *
   * @param scope Parent of this stack, usually an `App`.
   * @param id The construct ID of this stack.
   * @param props Stack properties as defined by `DistributionBucketStackProps`.
   */
  constructor(
    scope: Construct,
    id: string,
    props?: DistributionBucketStackProps
  ) {
    super(scope, id, props)

    const domainName = props?.domainName

    // Create domain-related resources as needed.

    if (domainName && domainName.split('.').length === 3) {
      this.createCertificate(domainName)
    }

    this.createDistribution()
    this.createBucketPolicy(this.contentBucket, 'ContentBucketPolicy')
    //this.replicaBucket && this.createBucketPolicy(this.replicaBucket, 'ReplicaBucketPolicy')

    // Optionally, create an A (address) record to map the domain name to the distribution.

    if (domainName && this.hostedZone && this.viewerCertificate) {
      new ARecord(this, 'AddressRecord', {
        recordName: domainName.split('.')[0],
        target: RecordTarget.fromAlias(new CloudFrontTarget(this.distribution)),
        zone: this.hostedZone,
      })
    }
  }

  /**
   * Creates a new `BucketPolicy` for S3 content buckets.
   * Allow the Cloudfront distribution access to bucket resources.
   * Restrict access to only encrypted requests.
   *
   * See: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_condition-keys.html#condition-keys-securetransport
   *
   * @param bucket The bucket to use.
   */
  private createBucketPolicy(bucket: Bucket, id: string) {
    const policy = new BucketPolicy(this, id, {
      bucket: bucket,
      removalPolicy: this.dataRemovalPolicy,
    })

    // Update the content bucket policy for Cloudfront access; reqire encryption in transit.

    policy.document.addStatements(
      new PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [`${bucket.bucketArn}/*`],
        principals: [new ServicePrincipal('cloudfront.amazonaws.com')],
        effect: Effect.ALLOW,
        conditions: {
          StringEquals: {
            'AWS:SourceArn': `arn:aws:cloudfront::${this.account}:distribution/${this.distribution.distributionId}`,
          },
        },
      }),
      new PolicyStatement({
        actions: ['s3:GetObject', 's3:PutObject'],
        resources: [`${bucket.bucketArn}/*`],
        principals: [new AnyPrincipal()],
        effect: Effect.DENY,
        conditions: {
          Bool: {
            'aws:SecureTransport': 'false',
          },
        },
      })
    )
  }

  /**
   * Creates a Cloudfront distribution.
   */
  private createDistribution() {
    // Create an origin access control.

    const originAccessControl = new CfnOriginAccessControl(
      this,
      'OriginAccessControl',
      {
        originAccessControlConfig: {
          name: this.contentBucket.bucketName,
          originAccessControlOriginType: 's3',
          signingBehavior: 'always',
          signingProtocol: 'sigv4',
        },
      }
    )

    this.distribution = new CloudFrontWebDistribution(this, 'Distribution', {
      defaultRootObject: this.defaultRootObject,
      errorConfigurations: [
        {
          errorCode: 403,
          responsePagePath: `/${this.defaultRootObject}`,
          responseCode: 200,
        },
        {
          errorCode: 404,
          responsePagePath: `/${this.defaultRootObject}`,
          responseCode: 200,
        },
      ],
      httpVersion: HttpVersion.HTTP2_AND_3,
      loggingConfig: {
        bucket: this.logsBucket,
        prefix: this.distributionLogsPrefix,
        includeCookies: false,
      },
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: this.contentBucket,
          },
          failoverCriteriaStatusCodes: this.replicaBucket
            ? [403, 404, 500, 502, 503, 504]
            : undefined,
          failoverS3OriginSource: this.replicaBucket
            ? {
                s3BucketSource: Bucket.fromBucketArn(
                  this,
                  'Replica',
                  this.replicaBucket.bucketArn
                ),
              }
            : undefined,
          behaviors: [
            {
              allowedMethods: CloudFrontAllowedMethods.GET_HEAD,
              cachedMethods: CloudFrontAllowedCachedMethods.GET_HEAD,
              compress: true,
              isDefaultBehavior: true,
              viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            },
          ],
        },
      ],
      priceClass: PriceClass.PRICE_CLASS_ALL,
      viewerCertificate: this.viewerCertificate,
    })

    this.export('DistributionId', this.distribution.distributionId)
    this.export(
      'DistributionDomainName',
      this.distribution.distributionDomainName
    )

    // Use Override properties to fix OAC/OAI and use managed DefaultCacheBehavior policies.

    const distribution = this.distribution?.node
      ?.defaultChild as CfnDistribution

    if (distribution) {
      distribution.addPropertyOverride(
        'DistributionConfig.Origins.0.OriginAccessControlId',
        originAccessControl.attrId
      )

      //distribution.addPropertyOverride('DistributionConfig.Origins.0.Id', 'primary')

      if (this.replicaBucket) {
        distribution.addPropertyOverride(
          'DistributionConfig.Origins.1.OriginAccessControlId',
          originAccessControl.attrId
        )
        //distribution.addPropertyOverride('DistributionConfig.Origins.Id', 'secondary')
      }

      // Use managed response headers, cacne and origin request policies.

      //distribution.addPropertyOverride('DistributionConfig.DefaultCacheBehavior.TargetOriginId', 'primary')

      distribution.addPropertyOverride(
        'DistributionConfig.DefaultCacheBehavior.ResponseHeadersPolicyId',
        ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_AND_SECURITY_HEADERS
          .responseHeadersPolicyId
      )

      distribution.addPropertyOverride(
        'DistributionConfig.DefaultCacheBehavior.CachePolicyId',
        CachePolicy.CACHING_OPTIMIZED.cachePolicyId
      )

      distribution.addPropertyOverride(
        'DistributionConfig.DefaultCacheBehavior.OriginRequestPolicyId',
        OriginRequestPolicy.CORS_S3_ORIGIN.originRequestPolicyId
      )
    }
  }

  /**
   * Creates an ACM certificate for the given domain name.
   * Creates a `ViewerCertificate` for Cloudfront with a minimum version of TLS 1.2.
   *
   * @param domainName The domain to create a certificate for.
   */
  private createCertificate(domainName: string): Certificate {
    this.hostedZone = HostedZone.fromLookup(this, 'Zones', {
      domainName: domainName.split('.').slice(-2).join('.'),
    })

    // TODO: Use an existinc ACM cert, given an ARN.

    this.certificate = new Certificate(this, 'Certificate', {
      domainName: domainName,
      validation: CertificateValidation.fromDns(this.hostedZone),
    })

    this.viewerCertificate = ViewerCertificate.fromAcmCertificate(
      this.certificate,
      {
        aliases: [domainName],
        securityPolicy: SecurityPolicyProtocol.TLS_V1_2_2021,
      }
    )

    return this.certificate
  }
}
