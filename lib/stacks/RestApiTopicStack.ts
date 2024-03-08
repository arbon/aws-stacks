/**
 * @license
 * Copyright (c) 2024 Zach Arbon. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

import {
  AccessLogFormat,
  ApiKeySourceType,
  AwsIntegration,
  CfnDocumentationPart,
  CfnDocumentationVersion,
  EndpointType,
  GatewayResponseOptions,
  JsonSchema,
  JsonSchemaType,
  JsonSchemaVersion,
  LogGroupLogDestination,
  Model,
  PassthroughBehavior,
  QuotaSettings,
  ResponseType,
  RestApi,
  RestApiProps,
  SecurityPolicy,
  ThrottleSettings,
} from 'aws-cdk-lib/aws-apigateway'
import {
  Certificate,
  CertificateProps,
  CertificateValidation,
} from 'aws-cdk-lib/aws-certificatemanager'
import { DimensionsMap, GraphWidget, Metric } from 'aws-cdk-lib/aws-cloudwatch'
import { Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam'
import { IKey } from 'aws-cdk-lib/aws-kms'
import {
  LogGroup,
  LogGroupClass,
  LogGroupProps,
  RetentionDays,
} from 'aws-cdk-lib/aws-logs'
import { ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53'
import { ApiGateway } from 'aws-cdk-lib/aws-route53-targets'
import { ITopic } from 'aws-cdk-lib/aws-sns'
import { CfnWebACL, CfnWebACLAssociation } from 'aws-cdk-lib/aws-wafv2'
import { Construct } from 'constructs'

import { Package } from '..'
import { TopicStack, TopicStackProps } from './TopicStack'

/**
 * Defines a handful of gateway responses.
 */
const defaultResponses: GatewayResponseOptions[] = [
  {
    type: ResponseType.BAD_REQUEST_BODY,
    templates: {
      'application/json': JSON.stringify({
        status: 'Bad Request',
        message: '$context.error.validationErrorString',
      }),
    },
  },
  {
    type: ResponseType.DEFAULT_5XX,
    templates: {
      'application/json': JSON.stringify({
        status: 'Server Error',
        message: '$context.error.message',
      }),
    },
  },
  {
    type: ResponseType.INVALID_API_KEY,
    templates: {
      'application/json': JSON.stringify({
        status: 'Invalid API Key',
        message: '$context.error.message',
      }),
    },
  },
]

/**
 * Defines schemas for or two example data types.
 */
const defaultSchemas: JsonSchema[] = [
  {
    title: 'Message',
    schema: JsonSchemaVersion.DRAFT4,
    type: JsonSchemaType.OBJECT,
    description: 'A simple message with text and version.',
    properties: {
      name: {
        type: JsonSchemaType.STRING,
      },
      description: {
        type: JsonSchemaType.STRING,
      },
      data: {
        type: JsonSchemaType.OBJECT,
      },
      text: {
        type: JsonSchemaType.STRING,
      },
      version: {
        type: JsonSchemaType.NUMBER,
      },
    },
    required: ['text', 'version'],
  },
  {
    title: 'Event',
    schema: JsonSchemaVersion.DRAFT4,
    type: JsonSchemaType.OBJECT,
    description: 'An simple event with a name.',
    properties: {
      name: {
        type: JsonSchemaType.STRING,
      },
      description: {
        type: JsonSchemaType.STRING,
      },
    },
    required: ['name'],
  },
]

/**
 * Defines properties for a REST API stack based on {@link TopicStackProps}.
 */
export interface RestApiTopicStackProps extends TopicStackProps {
  /**
   * Defines the base path for the API.
   */
  basePath?: string

  /**
   * The ARN of an existing certificate.
   */
  certificateArn?: string

  /**
   * The properties for creation of a new KMS key.
   */
  certificateProps?: CertificateProps

  /**
   * The required domain name within an existing zone for the API.
   */
  domainName: string

  /**
   * The ARN of an existing log group to use.
   */
  logGroupArn?: string

  /**
   * Propteries for new log group creation.
   */
  logGroupProps?: LogGroupProps

  /**
   * Properties for REST API creation.
   */
  restApiProps?: RestApiProps

  /**
   * Defines quota settings for the API usage plan.
   */
  throttleSettings?: ThrottleSettings

  /**
   * Defines quota settings for the API usage plan.
   */
  quotaSettings?: QuotaSettings

  /**
   * The schemas to use for API resource creation.
   */
  schemas: JsonSchema[]
}

/**
 * Creates an API proxied to an SNS topic based on {@link TopicStack}.
 */
export class RestApiTopicStack extends TopicStack {
  /**
   * The REST API to recieve POSTed data.
   */
  readonly restApi: RestApi

  /**
   * Creates resources to proxy POSTed JSON to an SNS topic. Specifically:
   * Grants key use for the logs. Creates or imports a log group.
   * Adds a domain and certificate (as needed).
   *
   * @param scope Parent of this stack, usually an `App`.
   * @param id The construct ID of this stack.
   * @param props Stack properties as defined by `RestApiTopicStackProps`.
   */
  constructor(
    scope: Construct,
    id: string,
    props: Partial<RestApiTopicStackProps>
  ) {
    props = {
      basePath: `${Package.name}/${Package.version}`,
      schemas: defaultSchemas,
      throttleSettings: {
        rateLimit: 1000,
        burstLimit: 10000,
      },
      ...props,
    }

    if (!props.schemas) {
      throw new Error(
        'One or more JSON Schemas are required for resource creation.'
      )
    }

    super(scope, id, props)

    this.key.grantEncryptDecrypt(
      new ServicePrincipal(`logs.${this.region}.amazonaws.com`)
    )

    const schemaTitles = props.schemas
      .map((schema) => `${schema.title}s`)
      .join('/')

    this.restApi = new RestApi(this, 'RestApi', {
      apiKeySourceType: ApiKeySourceType.HEADER,
      cloudWatchRole: true,
      cloudWatchRoleRemovalPolicy: this.dataRemovalPolicy,
      description: `Publishes ${schemaTitles} to ${this.topic.topicArn}. `,
      deployOptions: {
        accessLogDestination: this.createLogGroupDestination(props),
        accessLogFormat: AccessLogFormat.jsonWithStandardFields(),
      },
      disableExecuteApiEndpoint: props.domainName ? true : false,
      endpointConfiguration: {
        types: [EndpointType.REGIONAL],
      },
      restApiName: `${Package.name}-${Package.version} ${schemaTitles}`,
      ...props.restApiProps,
    })

    this.restApi.node.addDependency(this.topic)
    this.restApi.applyRemovalPolicy(this.dataRemovalPolicy)

    props.domainName && this.createDomainName(this.restApi, props)

    //this.createGatewayResponses(this.restApi)
    this.createResources(this.restApi, props)

    //this.createWebAcl(this.restApi)
    this.createApiGatewayMetrics(this.restApi)
  }

  /**
   * Creates Cloudwatch dashboard widgets.
   */
  createApiGatewayMetrics(restApi: RestApi): void {
    const dimensionsMap: DimensionsMap = {
      ApiName: restApi.restApiName,
    }

    const namespace = 'AWS/ApiGateway'

    const latency = new Metric({
      dimensionsMap,
      namespace,
      metricName: 'Latency',
      statistic: 'min',
    })

    const integrationLatency = new Metric({
      dimensionsMap,
      namespace,
      metricName: 'IntegrationLatency',
      statistic: 'min',
    })

    this.dashboard.addWidgets(
      new GraphWidget({
        title: 'API Gateway / Requests & Errors',
        width: 8,
        height: 8,
        left: [
          new Metric({
            dimensionsMap,
            namespace,
            metricName: 'Count',
            statistic: 'sum',
          }),
        ],
        right: [
          new Metric({
            dimensionsMap,
            namespace,
            metricName: '4XXError',
            statistic: 'sum',
          }),
          new Metric({
            dimensionsMap,
            namespace,
            metricName: '5XXError',
            statistic: 'sum',
          }),
        ],
      }),
      new GraphWidget({
        title: 'API Gateway / Latency',
        width: 8,
        height: 8,
        left: [
          latency,
          latency.with({
            statistic: 'avg',
          }),
        ],
        right: [
          latency.with({
            statistic: 'max',
          }),
        ],
      }),
      new GraphWidget({
        title: 'API Gateway / SNS Latency',
        width: 8,
        height: 8,
        left: [
          integrationLatency,
          integrationLatency.with({
            statistic: 'avg',
          }),
        ],
        right: [
          integrationLatency.with({
            statistic: 'max',
          }),
        ],
      })
    )
  }

  /**
   * Creates a AWS WAF V2 Web Acl and associates it with the REST API.
   * @param restApi The REST API to use.
   */
  private createWebAcl(restApi: RestApi): CfnWebACL {
    const webAcl = new CfnWebACL(this, 'WebAcl', {
      scope: 'REGIONAL',
      defaultAction: {
        allow: {},
      },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: 'WebAclMetric',
        sampledRequestsEnabled: true,
      },
      rules: [
        {
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 1,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              name: 'AWSManagedRulesCommonRuleSet',
              vendorName: 'AWS',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedRulesCommonRuleSet',
            sampledRequestsEnabled: true,
          },
        },
      ],
    })

    webAcl.applyRemovalPolicy(this.dataRemovalPolicy)

    const webAclAssociation = new CfnWebACLAssociation(
      this,
      'WebAclAssociation',
      {
        webAclArn: webAcl.attrArn,
        resourceArn: `arn:aws:apigateway:${this.region}::/restapis/${restApi.restApiId}/stages/${restApi.deploymentStage.stageName}`,
      }
    )
    webAclAssociation.applyRemovalPolicy(this.dataRemovalPolicy)

    return webAcl
  }

  /**
   * Adds a domain name for the API to the existing hosted zone for the TLD.
   * Creates (or uses an existing) certificate and a corresponding A DNS record.
   *
   * @param restApi The REST API to use.
   * @param props An object containing domain and certificate properties.
   */
  private createDomainName(
    restApi: RestApi,
    props: Partial<RestApiTopicStackProps>
  ) {
    if (!restApi || !props.domainName) return

    const hostedZone = HostedZone.fromLookup(this, 'Zone', {
      domainName: props.domainName.split('.').slice(-2).join('.'),
    })

    const certificateName = 'Certificate'
    let certificate

    if (props.certificateArn) {
      certificate = Certificate.fromCertificateArn(
        this,
        certificateName,
        props.certificateArn
      )
    } else {
      certificate = new Certificate(this, certificateName, {
        domainName: props.domainName,
        validation: CertificateValidation.fromDns(hostedZone),
        ...props.certificateProps,
      })

      certificate.applyRemovalPolicy(this.dataRemovalPolicy)
    }

    restApi.addDomainName('Domain', {
      domainName: props.domainName,
      certificate: certificate,
      basePath: props.basePath,
      securityPolicy: SecurityPolicy.TLS_1_2,
    })

    const aliasRecord = new ARecord(this, 'AliasRecord', {
      recordName: props.domainName?.split('.')[0],
      target: RecordTarget.fromAlias(new ApiGateway(restApi)),
      zone: hostedZone,
    })

    this.export('AliasDomainName', aliasRecord.domainName)
    this.export('CertificateArn', certificate.certificateArn)

    aliasRecord.applyRemovalPolicy(this.dataRemovalPolicy)
  }

  /**
   * Creates gateway responses
   * @param restApi The REST API to use.
   * @param responses An array of GatewayResponseOptions.
   */
  private createGatewayResponses(
    restApi: RestApi,
    responses: GatewayResponseOptions[] = defaultResponses
  ) {
    restApi &&
      responses.length &&
      responses.forEach((response, index) => {
        restApi.addGatewayResponse(`Response${index}`, response)
      })
  }

  /**
   * Creates or uses an existing log group.
   *
   * @param props Properties with an ARN or log group settings.
   * @returns The log group destination.
   */
  private createLogGroupDestination(
    props: Partial<RestApiTopicStackProps>
  ): LogGroupLogDestination {
    const logGroupName = 'LogGroup'
    const logGroup = props.logGroupArn
      ? LogGroup.fromLogGroupArn(this, logGroupName, props.logGroupArn)
      : new LogGroup(this, logGroupName, {
          encryptionKey: this.key,
          logGroupClass: LogGroupClass.STANDARD,
          removalPolicy: this.dataRemovalPolicy,
          retention: RetentionDays.TWO_YEARS,
          ...props.logGroupProps,
        })

    logGroup.applyRemovalPolicy(this.dataRemovalPolicy)
    this.export('LogGroupArn', logGroup.logGroupArn)

    this.createLogMetrics(logGroup)

    return new LogGroupLogDestination(logGroup)
  }

  /**
   * Create REST API resources given a topic integration and a handful of schemas.
   * Optionally, add a usage plan if an API key is required.
   *
   * @param restApi The Rest API to use.
   * @param props Stack properties for resource creation.
   */
  private createResources(
    restApi: RestApi,
    props: Partial<RestApiTopicStackProps>
  ) {
    if (!restApi || !props.schemas) return

    const apiDocs = new CfnDocumentationPart(this, 'ApiDocs', {
      location: {
        type: 'API',
      },
      properties: JSON.stringify({
        summary: `Publishes data to SNS.`,
        description: `Publishes data to SNS ${this.topic.topicArn}.`,
      }),
      restApiId: this.restApi.restApiId,
    })
    apiDocs.applyRemovalPolicy(this.dataRemovalPolicy)

    // Create a role to allow key and topic use.

    const apiGatewayRole = new Role(this, 'ApiGatewayRole', {
      assumedBy: new ServicePrincipal('apigateway.amazonaws.com'),
    })

    this.key && this.key.grantEncryptDecrypt(apiGatewayRole)
    this.topic.grantPublish(apiGatewayRole)

    props.schemas.forEach((schema) => {
      const model = schema.title,
        resourceName = `${schema.title?.toLowerCase()}s`,
        resource = restApi.root.addResource(resourceName)

      const methodDocs = new CfnDocumentationPart(this, `${model}MethodDocs`, {
        location: {
          type: 'METHOD',
          path: resourceName,
          method: 'POST',
        },
        properties: JSON.stringify({
          summary: `Posts an ${model} to SNS`,
          description: `Publishes ${model} data to SNS topic ${this.topic.topicArn}.`,
        }),
        restApiId: this.restApi.restApiId,
      })
      methodDocs.applyRemovalPolicy(this.dataRemovalPolicy)

      const modelDocs = new CfnDocumentationPart(this, `${model}ModelDocs`, {
        location: {
          type: 'MODEL',
          name: model,
        },
        properties: JSON.stringify({
          summary: `Represents a ${model}`,
          description: schema.description,
        }),
        restApiId: this.restApi.restApiId,
      })
      modelDocs.applyRemovalPolicy(this.dataRemovalPolicy)

      const integration = new AwsIntegration({
        service: 'sns',
        action: 'Publish',
        options: {
          credentialsRole: apiGatewayRole,
          integrationResponses: [
            {
              responseTemplates: {
                'application/json': JSON.stringify({
                  metadata: {
                    package: {
                      name: Package.name,
                      version: Package.version,
                    },
                    topic: {
                      arn: this.topic.topicArn,
                    },
                  },
                  status: 'OK',
                }),
              },
              statusCode: '200',
            },
          ],
          passthroughBehavior: PassthroughBehavior.WHEN_NO_MATCH,
          requestParameters: {
            'integration.request.header.Content-Type':
              "'application/x-www-form-urlencoded'",
          },
          requestTemplates: {
            'application/json': [
              'Action=Publish',
              `Subject=${model}`,
              `TopicArn=$util.urlEncode('${this.topic.topicArn}')`,
              'Message=$util.urlEncode($input.body)',
              `MessageAttributes.entry.1.Name=Type`,
              `MessageAttributes.entry.1.Value.StringValue=${model}`,
              'MessageAttributes.entry.1.Value.DataType=String',
              `MessageAttributes.entry.2.Name=SourceIp`,
              `MessageAttributes.entry.2.Value.StringValue=$util.urlEncode($context.identity.sourceIp)`,
              'MessageAttributes.entry.2.Value.DataType=String',
              `MessageAttributes.entry.3.Name=Stage`,
              `MessageAttributes.entry.3.Value.StringValue=$util.urlEncode($context.stage)`,
              'MessageAttributes.entry.3.Value.DataType=String',
            ].join('&'),
          },
        },
      })

      resource.addMethod('POST', integration, {
        requestValidatorOptions: {
          validateRequestBody: true,
        },
        requestModels: {
          'application/json': new Model(this, `${model}`, {
            description: schema.description,
            modelName: model,
            restApi: restApi,
            schema: schema,
          }),
        },
        methodResponses: [
          {
            statusCode: '200',
          },
          {
            statusCode: '400',
          },
        ],
      })
    })

    new CfnDocumentationVersion(this, 'DocumentationVersion', {
      documentationVersion: Package.version,
      restApiId: this.restApi.restApiId,
    })

    const apiKey = restApi.addApiKey('ApiKey')
    apiKey.applyRemovalPolicy(this.dataRemovalPolicy)
    this.export('ApiKeyArn', apiKey.keyArn)

    const usagePlan = restApi.addUsagePlan('UsagePlan', {
      apiStages: [
        {
          api: restApi,
          stage: restApi.deploymentStage,
        },
      ],
      quota: props.quotaSettings,
      throttle: props.throttleSettings,
    })
    usagePlan.applyRemovalPolicy(this.dataRemovalPolicy)
    usagePlan.addApiKey(apiKey)
  }

  /**
   * Creates an IAM role for key use and topic publishing.
   * Creates an SNS service integration for the topic.
   *
   * @param topic The SNS topic topic.
   * @param key The KMS key for topic encryption.
   * @returns The SNS topic integration.
   */
  private createTopicIntegration(
    topic: ITopic,
    key?: IKey
  ): AwsIntegration | undefined {
    if (!topic) return

    const apiGatewayRole = new Role(this, 'ApiGatewayRole', {
      assumedBy: new ServicePrincipal('apigateway.amazonaws.com'),
    })

    key && key.grantEncryptDecrypt(apiGatewayRole)
    topic.grantPublish(apiGatewayRole)

    return new AwsIntegration({
      service: 'sns',
      action: 'Publish',
      options: {
        credentialsRole: apiGatewayRole,
        integrationResponses: [
          {
            responseTemplates: {
              'application/json': JSON.stringify({
                metadata: {
                  package: {
                    name: Package.name,
                    version: Package.version,
                  },
                  topic: {
                    arn: this.topic.topicArn,
                  },
                },
                status: 'OK',
              }),
            },
            statusCode: '200',
          },
        ],
        passthroughBehavior: PassthroughBehavior.WHEN_NO_MATCH,
        requestParameters: {
          'integration.request.header.Content-Type':
            "'application/x-www-form-urlencoded'",
        },
        requestTemplates: {
          'application/json': [
            'Action=Publish',
            'Subject=Message',
            `TopicArn=$util.urlEncode('${topic.topicArn}')`,
            'Message=$util.urlEncode($input.body)',
            'MessageAttributes.entry.1.Name=message',
            'MessageAttributes.entry.1.Value.StringValue=MessageReceived',
            'MessageAttributes.entry.1.Value.DataType=String',
          ].join('&'),
        },
      },
    })
  }
}
