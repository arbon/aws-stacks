/**
 * @license
 * Copyright (c) 2024 Zach Arbon. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

import { CloudAssembly } from 'aws-cdk-lib/cx-api'

/**
 * Define a small interface for resource processing.
 * @todo Add properties as desired.
 */
interface Resource {
  Type: string
}

/**
 * Maintains counts for service resources.
 */
type ServiceGroup = {
  color: string
  services: { name: string; count: number }[]
}

/**
 * Maps a service to a color.
 */
type ServiceColorMap = { [key: string]: number }

/**
 * Defines 8-bit colors for services based on the existing AWS design aesthetic.
 * @see https://en.wikipedia.org/wiki/ANSI_escape_code#8-bit
 */
const colors: ServiceColorMap = {
  'AWS::ApiGateway': 198,
  'AWS::ApiGatewayV2': 198,
  'AWS::CDK': 170,
  'AWS::CertificateManager': 167,
  'AWS::CloudWatch': 198,
  'AWS::EC2': 36,
  'AWS::IAM': 167,
  'AWS::KMS': 167,
  'AWS::Lambda': 208,
  'AWS::Logs': 198,
  'AWS::Route53': 141,
  'AWS::S3': 106,
  'AWS::SNS': 198,
  'AWS::SQS': 198,
  // Add more services! :-)
}

/**
 * Maintains counts for service resources.
 */
type ServiceCount = { name: string; count: number }

/**
 * Maintains resources grouped buy service.
 */
type ServiceGroupMap = { [prefix: string]: ServiceCount[] }

/**
 * Groups services and maintains resource counts.
 * @param {string[]} services - The array of services to process.
 * @returns {ServiceGroup[]} Returns an array of resources grouped by service.
 */
function groupServices(services: string[]): ServiceGroup[] {
  services.sort()

  const serviceGroups: ServiceGroup[] = [],
    serviceGroupMap: ServiceGroupMap = {}

  services.forEach((service) => {
    const prefix = service.split('::').slice(0, 2).join('::')
    if (!serviceGroupMap[prefix]) {
      serviceGroupMap[prefix] = [
        {
          name: service,
          count: 1,
        },
      ]
    } else {
      const serviceEntry = serviceGroupMap[prefix].find(
        (entry) => entry.name === service
      )
      if (serviceEntry) {
        serviceEntry.count++
      } else {
        serviceGroupMap[prefix].push({
          name: service,
          count: 1,
        })
      }
    }
  })

  Object.entries(serviceGroupMap).forEach(([prefix, services]) => {
    const colorCode = colors[prefix] || 37,
      color = `\x1b[38;5;${colorCode}m`
    serviceGroups.push({ color, services })
  })

  return serviceGroups
}

/**
 * Logs ANSI 256 colorized resources.
 * Builds an array of resources, groups 'em, and processes each group.
 */
new CloudAssembly('cdk.out').stacks.map((stack) => {
  const resources: string[] = []

  Object.values(stack.template.Resources).forEach((resource) => {
    resources.push((resource as Resource).Type)
  })

  const grouped = groupServices(resources)

  console.log('Stack %s / %d Resources', stack.templateFile, resources.length)

  grouped.forEach((group) => {
    console.log(
      group.services
        .map(
          (s) =>
            `${group.color}${s.name}\x1b[37m ${
              s.count > 1 ? `(${s.count})` : ''
            }\x1b[0m`
        )
        .join('\n')
    )
  })

  console.log('')
})
