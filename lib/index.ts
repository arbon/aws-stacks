/**
 * @license
 * Copyright (c) 2024 Zach Arbon. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

import { App, Environment } from 'aws-cdk-lib'
import { readFileSync } from 'fs'
import * as appImports from './apps'
import { AppStack } from './stacks'

/**
 * Defines application context parameters.
 */

export enum Context {
  ACCOUNT = 'account',
  APPS = 'apps',
  REGION = 'region',
}

/**
 * Defines regions.
 */
export const Regions = {
  US_EAST: ['us-east-1', 'us-east-2'],
  US_WEST: ['us-west-1', 'us-west-2'],
  get US() {
    return [...this.US_EAST, ...this.US_WEST]
  },
}

/**
 * Provides package metadata.
 */
export const Package = JSON.parse(
  readFileSync('package.json', {
    encoding: 'utf-8',
  })
)

/**
 * Defines stack application stages.
 */
export enum Stage {
  DEVELOPMENT = 'dev',
  PRODUCTION = 'prod',
  STAGING = 'staging',
}

/**
 * Defines data classification types for stack metadata.
 */
export enum DataClassification {
  CONFIDENTIAL = 'confidential',
  INTERNAL = 'internal',
  PRIVATE = 'private',
  PUBLIC = 'public',
  RESTRICTED = 'restricted',
}

/**
 * Defines error messages to be used by stacks, etc.
 */
export enum ErrorMessage {
  DOMAIN_NAME_REQUIRED = 'A domain name for a Route53 hosted zone is required.',
  RECIPIENTS_REQUIRED = 'One or more recipients are required.',
}

/**
 * Defines storage types for bucket metrics.
 * NOTE: `AllStorageTypes` is used for the `NumberOfObjects` bucket metric.
 *
 * @see https://docs.aws.amazon.com/AmazonS3/latest/userguide/metrics-dimensions.html
 */
export enum CloudWatchStorageType {
  ALL_STORAGE_TYPES = 'AllStorageTypes',
  DEEP_ARCHIVE_OBJECT_OVERHEAD = 'DeepArchiveObjectOverhead',
  DEEP_ARCHIVE_S3_OBJECT_OVERHEAD = 'DeepArchiveS3ObjectOverhead',
  DEEP_ARCHIVE_STAGING_STORAGE = 'DeepArchiveStagingStorage',
  DEEP_ARCHIVE_STORAGE = 'DeepArchiveStorage',
  EXPRESS_ONE_ZONE = 'ExpressOneZone',
  GLACIER_OBJECT_OVERHEAD = 'GlacierObjectOverhead',
  GLACIER_S3_OBJECT_OVERHEAD = 'GlacierS3ObjectOverhead',
  GLACIER_STAGING_STORAGE = 'GlacierStagingStorage',
  GLACIER_STORAGE = 'GlacierStorage',
  INTELLIGENT_TIERING_FA_STORAGE = 'IntelligentTieringFAStorage',
  INTELLIGENT_TIERING_IA_STORAGE = 'IntelligentTieringIAStorage',
  ONE_ZONE_IA_SIZE_OVERHEAD = 'OneZoneIASizeOverhead',
  ONE_ZONE_IA_STORAGE = 'OneZoneIAStorage',
  REDUCED_REDUNDANCY_STORAGE = 'ReducedRedundancyStorage',
  STANDARD_IA_SIZE_OVERHEAD = 'StandardIASizeOverhead',
  STANDARD_IA_STORAGE = 'StandardIAStorage',
  STANDARD_STORAGE = 'StandardStorage',
}

/**
 * Retrieves the AWS account from the CDK app context or uses `CDK_DEFAULT_ACCOUNT`.
 * @param {App} app The CDK App instance.
 * @param {string} [defaultAccount] The default AWS account to use.
 * @returns {string} A string containing the AWS account.
 */
export function getAccount(app: App, defaultAccount?: string): string {
  return (
    app.node.tryGetContext('account') ||
    process.env.CDK_DEFAULT_ACCOUNT ||
    defaultAccount
  )
}

/**
 * Retrieves the AWS region from the CDK app context or uses `CDK_DEFAULT_REGION`.
 * @param {App} app The CDK App instance.
 * @param {string} [defaultRegion] The default AWS region to use.
 * @returns {string} A string containing the AWS region.
 */
export function getRegion(app: App, defaultRegion?: string): string {
  return (
    app.node.tryGetContext('region') ||
    process.env.CDK_DEFAULT_REGION ||
    defaultRegion
  )
}

/**
 * Gets environment settings for stack creation.
 * Try to use context and then fallback to the environment.
 * @param {App} app - The application scope or construct.
 * @param {string} [defaultAccount] The default AWS account to use.
 * @param {string} [defaultRegion] The default AWS region to use.
 * @returns {Environment} Returns an environment.
 */
export function getEnv(
  app: App,
  defaultAccount?: string,
  defaultRegion?: string
): Environment {
  return {
    account: getAccount(app, defaultAccount),
    region: getRegion(app, defaultRegion),
  }
}

/**
 * Standardizes output from stack creation functions.
 * We'd like to have access to various stacks and some metadata (for now, a description).
 */
export type StackResult = {
  stacks: AppStack[]
  description: string
}

/**
 * Standardizes functions used to create stacks.
 * Uses {@link App} and {@link Environment} for input and a {@link StackResult} for output.
 */
export interface StackCreator {
  (app: App, env?: Environment): StackResult
}

/**
 * Defines a type that reflects stack creator imports.
 */
export type StackCreators = {
  [key: string]: StackCreator
}

/**
 * Creates one or more apps defined by context {@link Context.APPS}.
 * @param {App} app - The application scope or construct.
 */
export function createApps(app: App): void {
  const env: Environment = getEnv(app),
    apps: string = app.node.tryGetContext(Context.APPS)

  if (apps in appImports) {
    const creator: StackCreator = (appImports as StackCreators)[apps]
    const result: StackResult = creator(app, env)

    console.log(
      'Created',
      result.stacks.length,
      result.stacks.length > 1 ? 'stacks:' : 'stack:',
      result.stacks.map((stack) => stack.templateFile)
    )
  } else {
    console.warn('Sorry, that sample app was not found. Please try:\n')
    Object.keys(appImports)
      .sort()
      .forEach((app) => console.log(app))
  }
}

export * from './stacks'
