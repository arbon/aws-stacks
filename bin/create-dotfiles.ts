/**
 * @license
 * Copyright (c) 2024 Zach Arbon. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

import * as fs from 'fs'
import * as path from 'path'

/**
 * Defines an interface for CloudFormation templates.
 */
interface CloudFormationTemplate {
  Metadata: {
    Package: {
      Name: string
      Author: string
      Version: string
      RepositoryUrl: string
    }
  }
  Resources: Record<string, CloudFormationResource>
  Outputs: {
    [key: string]: {
      Value: string | { 'Fn::GetAtt': string[] }
      Export?: { Name: string }
    }
  }
}

/**
 * Defines an interface for CloudFormation resources.
 */
interface CloudFormationResource {
  Type: string
  DependsOn?: string[]
  Properties: Record<string, object>
  Metadata?: {
    'aws:cdk:path': string
  }
}

/**
 * Parse a manifest to get artifacts.
 * @todo Let's use `CloudAssembly`!
 * @param {string} filePath - The manifest file path.
 * @returns {string[]} Returns an array of artifacts.
 */
function getArtifactsFromManifest(filePath: string): string[] {
  try {
    const manifestData = fs.readFileSync(filePath, 'utf8')
    const manifest = JSON.parse(manifestData)
    const artifacts = []

    for (const key in manifest.artifacts) {
      const artifact = manifest.artifacts[key]
      if (
        artifact.type === 'cdk:asset-manifest' &&
        artifact.properties &&
        artifact.properties.file
      ) {
        artifacts.push(
          path.join(
            cdkDir,
            artifact.properties.file.replace(/assets/g, 'template')
          )
        )
      }
    }

    return artifacts
  } catch (error) {
    console.error(error)
    return []
  }
}

/**
 * Creates a Graphviz DOT file for resources.
 * @see https://graphviz.org/doc/info/lang.html
 * @param {CloudFormationTemplate} template - The template to process.
 * @returns {string} Returns a DOT file as a string.
 */
function createDotFile(template: CloudFormationTemplate): string {
  let dotFile =
    'digraph Resources {\nnode [shape=box fontname="Avenir, Helvetica" fontsize=10];'

  for (const resourceName in template.Resources) {
    const resource = template.Resources[resourceName]
    const resourceNameWithQuotes = `"${resourceName}"`
    let label = resource.Type

    if (label === 'AWS::CDK::Metadata') continue

    Object.keys(resource.Properties).forEach((key) => {
      label += `\n${key}`
    })

    dotFile += `  ${resourceNameWithQuotes} [label="${label}"];\n`

    if (resource.DependsOn && Array.isArray(resource.DependsOn)) {
      for (const dependency of resource.DependsOn) {
        dotFile += `  ${resourceNameWithQuotes} -> "${dependency}";\n`
      }
    }
  }
  dotFile += '}\n'
  return dotFile
}

/**
 * Writes DOT files for artifacts.
 * @param {string[]} artifacts - An array of artifacts to iterate over.
 */
function createDotFiles(artifacts: string[]) {
  artifacts.forEach((artifactPath) => {
    const template: CloudFormationTemplate = JSON.parse(
      fs.readFileSync(artifactPath, 'utf8')
    )
    fs.writeFileSync(`${artifactPath}.dot`, createDotFile(template), 'utf8')
  })
}

const cdkDir = path.join('.', 'cdk.out')
const manifestPath = path.join(cdkDir, 'manifest.json')

createDotFiles(getArtifactsFromManifest(manifestPath))
